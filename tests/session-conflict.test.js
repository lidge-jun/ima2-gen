import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const storePath = join(__dirname, "..", "ui", "src", "store", "useAppStore.ts");
const sessionRoutesPath = join(__dirname, "..", "routes", "sessions.js");

const storeSrc = await readFile(storePath, "utf8");
const routeSrc = await readFile(sessionRoutesPath, "utf8");

assert.ok(
  storeSrc.includes('localStorage.getItem("ima2.activeSessionId")'),
  "active graph session should be persisted per browser",
);
assert.ok(
  storeSrc.includes("const savedExists = savedId ? sessions.some"),
  "session loader should prefer the browser's saved session when present",
);
assert.ok(
  !storeSrc.includes("if (!current && sessions.length > 0)"),
  "new browsers must not auto-attach to the most recent shared session",
);
assert.ok(
  routeSrc.includes('code !== "GRAPH_VERSION_CONFLICT"'),
  "graph version conflicts should have an explicit handling branch",
);
assert.ok(
  routeSrc.includes('code !== "GRAPH_VERSION_CONFLICT"'),
  "graph version conflicts should be treated as expected concurrency responses",
);
assert.ok(
  !routeSrc.includes('logEvent("session", "graph_conflict"'),
  "graph version conflicts should not spam the terminal",
);

console.log("session-conflict: ok");
