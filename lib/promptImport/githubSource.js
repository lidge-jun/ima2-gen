import { promptImportError } from "./errors.js";

const ALLOWED_HOSTS = new Set(["github.com", "raw.githubusercontent.com"]);
const SUPPORTED_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Invalid encoded GitHub path");
  }
}

function assertCleanPath(path) {
  const lower = path.toLowerCase();
  if (path.includes("\0") || lower.includes("%00")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub path contains a null byte");
  }
  if (/%2f|%5c/i.test(path)) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub path contains an encoded slash");
  }
  const decoded = safeDecode(path);
  if (decoded.includes("\\") || decoded.split("/").includes("..")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub path traversal is not allowed");
  }
  return decoded.replace(/^\/+/, "");
}

function extensionForPath(path) {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? "";
}

function assertSupportedFilePath(path) {
  const ext = extensionForPath(path);
  if (!ext) {
    throw promptImportError("FOLDER_IMPORT_DEFERRED", "Folder import is planned for a later version", 422);
  }
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw promptImportError("UNSUPPORTED_EXTENSION", "Only .md, .markdown, and .txt files are supported");
  }
  return ext;
}

function assertOwnerRepo(owner, repo) {
  if (!OWNER_REPO_RE.test(owner || "") || !OWNER_REPO_RE.test(repo || "")) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Invalid GitHub owner or repository");
  }
}

function normalizeUrlInput(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Only http(s) GitHub URLs are supported");
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Only GitHub file URLs are supported");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "github.com") {
    const [owner, repo, marker, ref, ...pathParts] = parts;
    assertOwnerRepo(owner, repo);
    if (marker !== "blob") {
      throw promptImportError("FOLDER_IMPORT_DEFERRED", "Only GitHub file URLs are supported in PR1", 422);
    }
    if (!ref || pathParts.length === 0) {
      throw promptImportError("FOLDER_IMPORT_DEFERRED", "Folder import is planned for a later version", 422);
    }
    const path = assertCleanPath(pathParts.join("/"));
    const ext = assertSupportedFilePath(path);
    return {
      kind: "github",
      owner,
      repo,
      ref: safeDecode(ref),
      path,
      extension: ext,
      htmlUrl: url.toString(),
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(safeDecode(ref))}/${path}`,
      tags: ["github", `repo:${owner}/${repo}`, `ref:${safeDecode(ref)}`, `file:${path.split("/").pop()}`, `ext:${ext}`],
    };
  }

  const [owner, repo, ref, ...pathParts] = parts;
  assertOwnerRepo(owner, repo);
  if (!ref || pathParts.length === 0) {
    throw promptImportError("FOLDER_IMPORT_DEFERRED", "Folder import is planned for a later version", 422);
  }
  const path = assertCleanPath(pathParts.join("/"));
  const ext = assertSupportedFilePath(path);
  return {
    kind: "github",
    owner,
    repo,
    ref: safeDecode(ref),
    path,
    extension: ext,
    htmlUrl: `https://github.com/${owner}/${repo}/blob/${safeDecode(ref)}/${path}`,
    rawUrl: url.toString(),
    tags: ["github", `repo:${owner}/${repo}`, `ref:${safeDecode(ref)}`, `file:${path.split("/").pop()}`, `ext:${ext}`],
  };
}

function normalizeShorthand(input) {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([^:]+))?:(.+)$/.exec(input);
  if (!match) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "Enter a GitHub file URL or owner/repo:path");
  }
  const [, owner, repo, rawRef, rawPath] = match;
  assertOwnerRepo(owner, repo);
  const ref = rawRef ? safeDecode(rawRef.trim()) : "main";
  if (ref.includes("/")) {
    throw promptImportError("AMBIGUOUS_GITHUB_REF", "Branches with slashes need GitHub API folder support planned for PR3");
  }
  const path = assertCleanPath(rawPath.trim());
  const ext = assertSupportedFilePath(path);
  return {
    kind: "github",
    owner,
    repo,
    ref,
    path,
    extension: ext,
    htmlUrl: `https://github.com/${owner}/${repo}/blob/${ref}/${path}`,
    rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`,
    tags: ["github", `repo:${owner}/${repo}`, `ref:${ref}`, `file:${path.split("/").pop()}`, `ext:${ext}`],
  };
}

function validateFinalFetchUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub fetch returned an invalid final URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub fetch returned an unsupported protocol");
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub fetch redirected to an unsupported host");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "github.com") {
    const marker = parts[2];
    if (parts.length < 5 || marker !== "blob") {
      throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub fetch redirected to a non-file page");
    }
    const finalPath = assertCleanPath(parts.slice(4).join("/"));
    assertSupportedFilePath(finalPath);
    return;
  }
  if (parts.length < 4) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub fetch returned a non-file path");
  }
  const finalPath = assertCleanPath(parts.slice(3).join("/"));
  assertSupportedFilePath(finalPath);
}

export function normalizeGitHubSource(input) {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) {
    throw promptImportError("INVALID_GITHUB_SOURCE", "GitHub source is required");
  }
  return normalizeUrlInput(trimmed) ?? normalizeShorthand(trimmed);
}

export async function fetchGitHubSourceText(source, limits) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.fetchTimeoutMs);
  try {
    const response = await fetch(source.rawUrl, { signal: controller.signal });
    validateFinalFetchUrl(response.url);
    if (!response.ok) {
      throw promptImportError("INVALID_GITHUB_SOURCE", `GitHub file fetch failed with ${response.status}`, 422);
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > limits.maxFileBytesForPreview) {
      throw promptImportError("REMOTE_FILE_TOO_LARGE", "Remote file is too large", 413);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > limits.maxFileBytesForPreview) {
      throw promptImportError("REMOTE_FILE_TOO_LARGE", "Remote file is too large", 413);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw promptImportError("REMOTE_FETCH_TIMEOUT", "GitHub fetch timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function isSupportedPromptFileName(filename) {
  return SUPPORTED_EXTENSIONS.has(extensionForPath(filename || ""));
}
