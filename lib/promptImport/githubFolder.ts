import { createHash } from "node:crypto";
import { promptImportError } from "./errors.js";
import type { PromptImportLimits } from "./types.js";

import { errInfo } from "../errInfo.js";
const GITHUB_HOST = "github.com";
const GITHUB_API_HOST = "api.github.com";
const RAW_HOST = "raw.githubusercontent.com";
const SUPPORTED_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/;

export interface GitHubFolderSource {
  kind: "github-folder";
  owner: string;
  repo: string;
  ref: string;
  path: string;
  htmlUrl: string;
  apiUrl: string;
  tags: string[];
  fromTreeUrl: boolean;
  ambiguousTree: boolean;
}

export interface GitHubFolderFile {
  name: string;
  path: string;
  extension: string;
  sizeBytes: number;
  htmlUrl: string;
  downloadUrl: string;
  selected: boolean;
  warnings: string[];
}

interface GitHubFolderItemRaw {
  type?: unknown;
  path?: unknown;
  name?: unknown;
  size?: unknown;
  html_url?: unknown;
  download_url?: unknown;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Invalid encoded GitHub folder path");
  }
}

function safePath(path: unknown): string {
  const raw = String(path || "").trim();
  const lower = raw.toLowerCase();
  if (raw.includes("\0") || lower.includes("%00")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder path contains a null byte");
  }
  if (/%2f|%5c/i.test(raw)) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder path contains an encoded slash");
  }
  const decoded = safeDecode(raw);
  if (decoded.includes("\\") || decoded.split("/").includes("..")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder traversal is not allowed");
  }
  return decoded.replace(/^\/+|\/+$/g, "");
}

function assertOwnerRepo(owner: string | undefined, repo: string | undefined): void {
  if (!OWNER_REPO_RE.test(owner || "") || !OWNER_REPO_RE.test(repo || "")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Invalid GitHub owner or repository");
  }
}

function extensionForPath(path: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? "";
}

function supportedExtension(path: string): string {
  const extension = extensionForPath(path);
  return SUPPORTED_EXTENSIONS.has(extension) ? extension : "";
}

function encodeApiPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

interface BuildApiUrlInput {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

function buildApiUrl({ owner, repo, ref, path }: BuildApiUrlInput): string {
  const encodedPath = encodeApiPath(path);
  const suffix = encodedPath ? `/${encodedPath}` : "";
  return `https://${GITHUB_API_HOST}/repos/${owner}/${repo}/contents${suffix}?ref=${encodeURIComponent(ref)}`;
}

function folderTags(source: GitHubFolderSource): string[] {
  return ["github", `repo:${source.owner}/${source.repo}`, `ref:${source.ref}`, `folder:${source.path || "/"}`];
}

function fromUrl(input: string): GitHubFolderSource | null {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== GITHUB_HOST) {
    throw promptImportError("GITHUB_FOLDER_UNSUPPORTED", "Only github.com folder URLs are supported", 400);
  }
  const [owner, repo, marker, rawRef, ...pathParts] = url.pathname.split("/").filter(Boolean);
  assertOwnerRepo(owner, repo);
  if (marker !== "tree") {
    throw promptImportError("GITHUB_FOLDER_UNSUPPORTED", "Enter a GitHub folder URL or owner/repo:path/", 422);
  }
  const ref = safeDecode(rawRef || "main");
  const path = safePath(pathParts.join("/"));
  return makeSource({ owner, repo, ref, path, fromTreeUrl: true, ambiguousTree: path.includes("/") });
}

function fromShorthand(input: string): GitHubFolderSource {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([^:]+))?:(.*)$/.exec(input);
  if (!match) {
    throw promptImportError("GITHUB_FOLDER_UNSUPPORTED", "Enter a GitHub folder URL or owner/repo:path/", 422);
  }
  const [, owner, repo, rawRef, rawPath] = match;
  assertOwnerRepo(owner, repo);
  const ref = rawRef ? safeDecode(rawRef.trim()) : "main";
  if (ref.includes("/")) {
    throw promptImportError("AMBIGUOUS_GITHUB_REF", "Branches with slashes need a later Git ref resolver", 422);
  }
  return makeSource({ owner, repo, ref, path: safePath(rawPath) });
}

interface MakeSourceInput {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  fromTreeUrl?: boolean;
  ambiguousTree?: boolean;
}

function makeSource({ owner, repo, ref, path, fromTreeUrl = false, ambiguousTree = false }: MakeSourceInput): GitHubFolderSource {
  return {
    kind: "github-folder",
    owner,
    repo,
    ref,
    path,
    htmlUrl: `https://${GITHUB_HOST}/${owner}/${repo}/tree/${encodeURIComponent(ref)}${path ? `/${path}` : ""}`,
    apiUrl: buildApiUrl({ owner, repo, ref, path }),
    tags: [],
    fromTreeUrl,
    ambiguousTree,
  };
}

function assertGithubApiUrl(rawUrl: string): void {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder fetch returned an invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== GITHUB_API_HOST) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder fetch used an unsupported host");
  }
}

function assertRawDownloadUrl(rawUrl: string): void {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder file has an invalid download URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== RAW_HOST) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub folder file download host is unsupported");
  }
  const path = safePath(url.pathname.split("/").filter(Boolean).slice(3).join("/"));
  if (!supportedExtension(path)) {
    throw promptImportError("UNSUPPORTED_EXTENSION", "Only .md, .markdown, and .txt files are supported");
  }
}

interface NormalizeItemResult {
  warning?: string;
  file?: GitHubFolderFile;
}

function normalizeItem(source: GitHubFolderSource, item: unknown): NormalizeItemResult {
  if (!item || typeof item !== "object") return { warning: "invalid-item" };
  const raw = item as GitHubFolderItemRaw;
  const type = typeof raw.type === "string" ? raw.type : "";
  const path = safePath(raw.path);
  const name = typeof raw.name === "string" ? raw.name : (path.split("/").pop() || "");
  const extension = supportedExtension(path);
  if (type !== "file") return { warning: `${path || name}: folder-deferred` };
  if (!extension) return { warning: `${path || name}: unsupported-extension` };
  if (!insideFolder(source.path, path)) return { warning: `${path || name}: outside-folder` };
  if (typeof raw.download_url !== "string" || !raw.download_url) {
    return { warning: `${path || name}: missing-download-url` };
  }
  return {
    file: {
      name,
      path,
      extension,
      sizeBytes: Number(raw.size || 0),
      htmlUrl: typeof raw.html_url === "string" ? raw.html_url : "",
      downloadUrl: raw.download_url,
      selected: false,
      warnings: [],
    },
  };
}

function insideFolder(folderPath: string, filePath: string): boolean {
  if (!folderPath) return true;
  return filePath === folderPath || filePath.startsWith(`${folderPath}/`);
}

interface FetchJsonResult {
  notFound?: boolean;
  json?: unknown;
}

async function fetchJson(url: string, limits: PromptImportLimits): Promise<FetchJsonResult> {
  assertGithubApiUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.fetchTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    assertGithubApiUrl(response.url || url);
    if (response.status === 404) return { notFound: true };
    if (!response.ok) {
      throw promptImportError("GITHUB_FOLDER_NOT_FOUND", `GitHub folder fetch failed with ${response.status}`, 422);
    }
    return { json: await response.json() };
  } catch (error) {
    const err = errInfo(error);
    if (err.name === "AbortError") {
      throw promptImportError("REMOTE_FETCH_TIMEOUT", "GitHub folder fetch timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeGitHubFolderSource(input: unknown): GitHubFolderSource {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) {
    throw promptImportError("GITHUB_FOLDER_UNSUPPORTED", "GitHub folder source is required", 400);
  }
  const source = fromUrl(trimmed) ?? fromShorthand(trimmed);
  source.tags = folderTags(source);
  return source;
}

interface FolderFetchResult {
  source: GitHubFolderSource;
  files: GitHubFolderFile[];
  warnings: string[];
}

export async function fetchGitHubFolderFiles(source: GitHubFolderSource, limits: PromptImportLimits): Promise<FolderFetchResult> {
  const fetched = await fetchJson(source.apiUrl, limits);
  if (fetched.notFound && source.ambiguousTree) {
    throw promptImportError("AMBIGUOUS_GITHUB_REF", "GitHub tree URL is ambiguous; slash branches are not resolved in PR3", 422);
  }
  if (fetched.notFound) {
    throw promptImportError("GITHUB_FOLDER_NOT_FOUND", "GitHub folder was not found", 404);
  }
  if (!Array.isArray(fetched.json)) {
    throw promptImportError("GITHUB_FOLDER_UNSUPPORTED", "GitHub source is not a folder", 422);
  }

  const warnings: string[] = [];
  const maxFolderFiles = limits.maxFolderFiles ?? Infinity;
  if (fetched.json.length > maxFolderFiles) {
    warnings.push(`folder-raw-too-large:${fetched.json.length}`);
  }
  const files: GitHubFolderFile[] = [];
  for (const item of fetched.json) {
    const normalized = normalizeItem(source, item);
    if (normalized.warning) warnings.push(normalized.warning);
    if (normalized.file) files.push(normalized.file);
  }
  if (files.length > maxFolderFiles) {
    warnings.push(`folder-too-large:${files.length}`);
  }
  return { source, files: files.slice(0, maxFolderFiles), warnings };
}

function assertSelectedPath(source: GitHubFolderSource, rawPath: unknown, allowed: Map<string, GitHubFolderFile>): string {
  const path = safePath(rawPath);
  if (!path || !supportedExtension(path) || !insideFolder(source.path, path) || !allowed.has(path)) {
    throw promptImportError("GITHUB_FOLDER_SELECTION_EMPTY", `Selected file is not in the listed folder: ${path}`, 422);
  }
  return path;
}

export interface SelectedGitHubFolderFile extends GitHubFolderFile {
  text: string;
  contentHash: string;
}

interface SelectedFolderResult {
  source: GitHubFolderSource;
  files: SelectedGitHubFolderFile[];
  warnings: string[];
}

export async function fetchSelectedGitHubFolderFiles(source: GitHubFolderSource, selectedPaths: unknown, limits: PromptImportLimits): Promise<SelectedFolderResult> {
  const selected = Array.isArray(selectedPaths) ? selectedPaths : [];
  if (selected.length === 0) {
    throw promptImportError("GITHUB_FOLDER_SELECTION_EMPTY", "Select at least one folder file to preview", 422);
  }
  if (selected.length > (limits.maxFolderPreviewFiles ?? Infinity)) {
    throw promptImportError("GITHUB_FOLDER_SELECTION_TOO_LARGE", "Too many folder files selected", 413);
  }

  const listing = await fetchGitHubFolderFiles(source, limits);
  const allowed = new Map<string, GitHubFolderFile>(listing.files.map((file) => [file.path, file]));
  const paths = selected.map((path) => assertSelectedPath(source, path, allowed));
  const warnings: string[] = [...listing.warnings];
  const files: SelectedGitHubFolderFile[] = [];
  let firstError: unknown = null;

  for (const path of paths) {
    const file = allowed.get(path);
    if (!file) continue;
    try {
      const fetched = await fetchRawFile(file.downloadUrl, limits);
      files.push({ ...file, text: fetched.text, contentHash: fetched.contentHash });
    } catch (error) {
      const err = errInfo(error);
      if (!firstError) firstError = error;
      warnings.push(`${path}: ${err.message || "file fetch failed"}`);
    }
  }
  if (files.length === 0 && firstError) throw firstError;
  return { source, files, warnings };
}

interface RawFileResult {
  text: string;
  contentHash: string;
}

async function fetchRawFile(rawUrl: string, limits: PromptImportLimits): Promise<RawFileResult> {
  assertRawDownloadUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.fetchTimeoutMs);
  try {
    const response = await fetch(rawUrl, { signal: controller.signal });
    assertRawDownloadUrl(response.url || rawUrl);
    if (!response.ok) {
      throw promptImportError("INVALID_GITHUB_SOURCE", `GitHub folder file fetch failed with ${response.status}`, 422);
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > limits.maxFileBytesForPreview) {
      throw promptImportError("GITHUB_FOLDER_FILE_TOO_LARGE", "Folder file is too large", 413);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > limits.maxFileBytesForPreview) {
      throw promptImportError("GITHUB_FOLDER_FILE_TOO_LARGE", "Folder file is too large", 413);
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return {
      text,
      contentHash: createHash("sha256").update(Buffer.from(buffer)).digest("hex"),
    };
  } catch (error) {
    const err = errInfo(error);
    if (err.name === "AbortError") {
      throw promptImportError("REMOTE_FETCH_TIMEOUT", "GitHub folder file fetch timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
