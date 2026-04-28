import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname, basename, join } from "node:path";

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function fileToDataUri(path) {
  const b64 = (await readFile(path)).toString("base64");
  const ext = extname(path).slice(1).toLowerCase();
  const mime = MIME[ext] || "image/png";
  return `data:${mime};base64,${b64}`;
}

export async function dataUriToFile(dataUri, outPath) {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  const raw = m ? m[2] : dataUri;
  await mkdir(dirname(outPath) || ".", { recursive: true });
  await writeFile(outPath, Buffer.from(raw, "base64"));
  return outPath;
}

export function defaultOutName(index, total, ext = "png") {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  if (total <= 1) return `ima2-${stamp}.${ext}`;
  return `ima2-${stamp}-${index}.${ext}`;
}

export async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf-8").trim();
}
