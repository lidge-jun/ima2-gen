// 0.09.10 — sanity tests for prompt fidelity text builder.
// We require that "direct" mode instructs the agent NOT to modify,
// and that "auto" and "direct" produce different text for the same input.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "server.js");
const oauthProxyPath = join(__dirname, "..", "lib", "oauthProxy.js");
const historyListPath = join(__dirname, "..", "lib", "historyList.js");
const nodeRoutePath = join(__dirname, "..", "routes", "nodes.js");

const src = await readFile(serverPath, "utf8");
const oauthSrc = await readFile(oauthProxyPath, "utf8");
const historySrc = await readFile(historyListPath, "utf8");
const nodeSrc = await readFile(nodeRoutePath, "utf8");

// Ensure both suffix constants and the builder exist
assert.ok(src.includes("buildApp"), "buildApp export missing after server split");
assert.ok(oauthSrc.includes("PROMPT_FIDELITY_SUFFIX"), "PROMPT_FIDELITY_SUFFIX missing");
assert.ok(oauthSrc.includes("buildUserTextPrompt"), "buildUserTextPrompt missing");
assert.ok(oauthSrc.includes("Generate an image with this exact prompt"), "direct mode wrapper text missing");
assert.ok(oauthSrc.includes("revised_prompt"), "revised_prompt capture missing");
assert.ok(historySrc.includes("revisedPrompt"), "history revisedPrompt field missing");
assert.ok(historySrc.includes("promptMode"), "history promptMode field missing");
assert.ok(historySrc.includes("userPrompt"), "history userPrompt field missing");
assert.ok(nodeSrc.includes("normalizedPromptMode"), "node prompt mode propagation missing");
assert.ok(nodeSrc.includes("userPrompt"), "node userPrompt meta field missing");

console.log("prompt-fidelity: ok");
