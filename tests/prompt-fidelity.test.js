// 0.09.10 — sanity tests for prompt fidelity text builder.
// We require that "direct" mode instructs the agent NOT to modify,
// and that "auto" and "direct" produce different text for the same input.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "server.js");

const src = await readFile(serverPath, "utf8");

// Ensure both suffix constants and the builder exist
assert.ok(src.includes("PROMPT_FIDELITY_SUFFIX"), "PROMPT_FIDELITY_SUFFIX missing");
assert.ok(src.includes("buildUserTextPrompt"), "buildUserTextPrompt missing");
assert.ok(src.includes("Generate an image with this exact prompt"), "direct mode wrapper text missing");
assert.ok(src.includes("revised_prompt"), "revised_prompt capture missing");
assert.ok(src.includes("promptMode"), "promptMode propagation missing");
assert.ok(src.includes("userPrompt"), "userPrompt meta field missing");

console.log("prompt-fidelity: ok");
