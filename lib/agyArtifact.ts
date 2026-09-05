import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { homedir } from "node:os";
import { agyError } from "./agyProcess.js";

export function parseAgyOutput(stdout: string): { artifactPath: string; ext: string } {
  const lines = stdout.replace(/\r/g, "").trim().split("\n").filter((l) => l.trim().length > 0);
  const resultLine = lines.find((l) => l.startsWith("RESULT|"));
  if (resultLine) {
    const parts = resultLine.split("|");
    const artifactPath = parts[1];
    const ext = parts[2];
    if (parts.length >= 3 && artifactPath && ext) {
      return { artifactPath: artifactPath.trim(), ext: ext.trim() };
    }
    throw agyError(`Malformed RESULT line: ${resultLine}`, 502, "AGY_MALFORMED_RESULT");
  }

  const errorLine = lines.find((l) => l.startsWith("ERROR|"));
  if (errorLine) {
    const msg = errorLine.slice("ERROR|".length).trim() || "Unknown agy error";
    const lower = msg.toLowerCase();
    if (lower.includes("resource exhausted") || lower.includes("exhausted your capacity") || lower.includes("quota will reset")) {
      throw agyError(`Agy generation failed: ${msg}`, 429, "AGY_QUOTA_EXHAUSTED");
    }
    throw agyError(`Agy generation failed: ${msg}`, 502, "AGY_GENERATION_FAILED");
  }

  const fullLower = stdout.toLowerCase();
  if (fullLower.includes("resource exhausted") || fullLower.includes("exhausted your capacity")) {
    throw agyError(`Agy quota exhausted: ${stdout.trim().slice(0, 200)}`, 429, "AGY_QUOTA_EXHAUSTED");
  }

  const savedPathLine = lines.find((l) => l.startsWith("SAVED_PATH="));
  if (savedPathLine) {
    const p = savedPathLine.slice("SAVED_PATH=".length).trim();
    const ext = p.split(".").pop() || "png";
    return { artifactPath: p, ext };
  }

  const normalizedStdout = stdout.replace(/\r/g, "").replace(/\\/g, "/");
  const pathMatch = normalizedStdout.match(
    /(?:[A-Za-z]:)?\/[^\s"']+\/(brain|artifacts|\.gemini)\/[^\s"']+\.(png|jpg|jpeg|webp)/i,
  );
  if (pathMatch) {
    const matched = pathMatch[0];
    const artifactPath = process.platform === "win32" ? matched.replace(/\//g, "\\") : matched;
    const ext = extname(artifactPath).slice(1) || "png";
    return { artifactPath, ext };
  }

  throw agyError(
    `Could not parse artifact path from agy output (${stdout.length} chars): ${stdout.slice(0, 200)}`,
    502,
    "AGY_PARSE_FAILED",
  );
}

export async function findRecentAgyArtifact(sinceMs: number, rootOverrides?: string[]): Promise<string | null> {
  const roots = rootOverrides ?? [
    join(homedir(), ".gemini", "antigravity-cli", "brain"),
    join(homedir(), ".gemini"),
  ];

  const candidates: { path: string; mtimeMs: number }[] = [];
  const seen = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5 || seen.has(dir)) return;
    seen.add(dir);

    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const p = join(dir, entry.name);

      if (!entry.isSymbolicLink() && entry.isDirectory()) {
        await walk(p, depth + 1);
        continue;
      }

      if (!/^ima2_generated.*\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
        continue;
      }

      const s = await stat(p).catch(() => null);
      if (!s) continue;

      if (s.mtimeMs >= sinceMs - 5_000) {
        candidates.push({ path: p, mtimeMs: s.mtimeMs });
      }
    }
  }

  for (const root of roots) {
    await walk(root, 0);
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path ?? null;
}
