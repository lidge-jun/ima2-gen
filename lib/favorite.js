import { readFile, writeFile, rename } from "node:fs/promises";
import { join, normalize, isAbsolute, sep } from "node:path";

export class InvalidFilenameError extends Error {
  constructor(msg) { super(msg); this.code = "INVALID_FILENAME"; this.status = 400; }
}
export class SidecarMissingError extends Error {
  constructor(msg) { super(msg); this.code = "SIDECAR_MISSING"; this.status = 404; }
}

function validateFilename(baseDir, filename) {
  if (!filename || typeof filename !== "string") {
    throw new InvalidFilenameError("filename required");
  }
  if (isAbsolute(filename)) {
    throw new InvalidFilenameError("filename must be relative");
  }
  const norm = normalize(filename);
  if (norm.startsWith("..") || norm.split(sep).includes("..")) {
    throw new InvalidFilenameError("filename must not escape base directory");
  }
  const full = join(baseDir, norm);
  if (!full.startsWith(baseDir)) {
    throw new InvalidFilenameError("filename resolves outside base directory");
  }
  return full;
}

export async function setFavoriteFlag(baseDir, filename, value) {
  const full = validateFilename(baseDir, filename);
  const sidecarPath = `${full}.json`;

  let meta;
  try {
    const raw = await readFile(sidecarPath, "utf-8");
    meta = JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new SidecarMissingError(`sidecar not found: ${filename}`);
    }
    throw err;
  }

  meta.favorite = Boolean(value);

  const tmpPath = `${sidecarPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(meta));
  await rename(tmpPath, sidecarPath);

  return { filename, favorite: meta.favorite };
}
