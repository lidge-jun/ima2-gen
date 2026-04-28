import { createHash } from "node:crypto";
import { promptImportError } from "./errors.js";

const GITHUB_HOST = "github.com";
const GITHUB_API_HOST = "api.github.com";
const RAW_HOST = "raw.githubusercontent.com";
const SUPPORTED_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Invalid encoded GitHub folder path");
  }
}

function safePath(path) {
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

function assertOwnerRepo(owner, repo) {
  if (!OWNER_REPO_RE.test(owner || "") || !OWNER_REPO_RE.test(repo || "")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Invalid GitHub owner or repository");
  }
}

function extensionForPath(path) {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? "";
}

function supportedExtension(path) {
  const extension = extensionForPath(path);
  return SUPPORTED_EXTENSIONS.has(extension) ? extension : "";
}

function encodeApiPath(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildApiUrl({ owner, repo, ref, path }) {
  const encodedPath = encodeApiPath(path);
  const suffix = encodedPath ? `/${encodedPath}` : "";
  return `https://${GITHUB_API_HOST}/repos/${owner}/${repo}/contents${suffix}?ref=${encodeURIComponent(ref)}`;
}

function folderTags(source) {
  return ["github", `repo:${source.owner}/${source.repo}`, `ref:${source.ref}`, `folder:${source.path || "/"}`];
}

function fromUrl(input) {
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

function fromShorthand(input) {
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

function makeSource({ owner, repo, ref, path, fromTreeUrl = false, ambiguousTree = false }) {
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

function assertGithubApiUrl(rawUrl) {
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

function assertRawDownloadUrl(rawUrl) {
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

function normalizeItem(source, item) {
  if (!item || typeof item !== "object") return { warning: "invalid-item" };
  const type = typeof item.type === "string" ? item.type : "";
  const path = safePath(item.path || "");
  const name = typeof item.name === "string" ? item.name : path.split("/").pop();
  const extension = supportedExtension(path);
  if (type !== "file") return { warning: `${path || name}: folder-deferred` };
  if (!extension) return { warning: `${path || name}: unsupported-extension` };
  if (!insideFolder(source.path, path)) return { warning: `${path || name}: outside-folder` };
  if (typeof item.download_url !== "string" || !item.download_url) {
    return { warning: `${path || name}: missing-download-url` };
  }
  return {
    file: {
      name,
      path,
      extension,
      sizeBytes: Number(item.size || 0),
      htmlUrl: typeof item.html_url === "string" ? item.html_url : "",
      downloadUrl: item.download_url,
      selected: false,
      warnings: [],
    },
  };
}

function insideFolder(folderPath, filePath) {
  if (!folderPath) return true;
  return filePath === folderPath || filePath.startsWith(`${folderPath}/`);
}

async function fetchJson(url, limits) {
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
    if (error?.name === "AbortError") {
      throw promptImportError("REMOTE_FETCH_TIMEOUT", "GitHub folder fetch timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeGitHubFolderSource(input) {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) {
    throw promptImportError("GITHUB_FOLDER_UNSUPPORTED", "GitHub folder source is required", 400);
  }
  const source = fromUrl(trimmed) ?? fromShorthand(trimmed);
  source.tags = folderTags(source);
  return source;
}

export async function fetchGitHubFolderFiles(source, limits) {
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

  const warnings = [];
  if (fetched.json.length > limits.maxFolderFiles) {
    warnings.push(`folder-raw-too-large:${fetched.json.length}`);
  }
  const files = [];
  for (const item of fetched.json) {
    const normalized = normalizeItem(source, item);
    if (normalized.warning) warnings.push(normalized.warning);
    if (normalized.file) files.push(normalized.file);
  }
  if (files.length > limits.maxFolderFiles) {
    warnings.push(`folder-too-large:${files.length}`);
  }
  return { source, files: files.slice(0, limits.maxFolderFiles), warnings };
}

function assertSelectedPath(source, rawPath, allowed) {
  const path = safePath(rawPath);
  if (!path || !supportedExtension(path) || !insideFolder(source.path, path) || !allowed.has(path)) {
    throw promptImportError("GITHUB_FOLDER_SELECTION_EMPTY", `Selected file is not in the listed folder: ${path}`, 422);
  }
  return path;
}

export async function fetchSelectedGitHubFolderFiles(source, selectedPaths, limits) {
  const selected = Array.isArray(selectedPaths) ? selectedPaths : [];
  if (selected.length === 0) {
    throw promptImportError("GITHUB_FOLDER_SELECTION_EMPTY", "Select at least one folder file to preview", 422);
  }
  if (selected.length > limits.maxFolderPreviewFiles) {
    throw promptImportError("GITHUB_FOLDER_SELECTION_TOO_LARGE", "Too many folder files selected", 413);
  }

  const listing = await fetchGitHubFolderFiles(source, limits);
  const allowed = new Map(listing.files.map((file) => [file.path, file]));
  const paths = selected.map((path) => assertSelectedPath(source, path, allowed));
  const warnings = [...listing.warnings];
  const files = [];
  let firstError = null;

  for (const path of paths) {
    const file = allowed.get(path);
    try {
      const fetched = await fetchRawFile(file.downloadUrl, limits);
      files.push({ ...file, text: fetched.text, contentHash: fetched.contentHash });
    } catch (error) {
      if (!firstError) firstError = error;
      warnings.push(`${path}: ${error?.message || "file fetch failed"}`);
    }
  }
  if (files.length === 0 && firstError) throw firstError;
  return { source, files, warnings };
}

async function fetchRawFile(rawUrl, limits) {
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
    if (error?.name === "AbortError") {
      throw promptImportError("REMOTE_FETCH_TIMEOUT", "GitHub folder file fetch timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
