// 0.09.10 — sanity tests for prompt fidelity text builder.
// We require that "direct" mode instructs the agent NOT to modify,
// and that "auto" and "direct" produce different text for the same input.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  AUTO_PROMPT_FIDELITY_SUFFIX,
  DIRECT_PROMPT_FIDELITY_SUFFIX,
  EDIT_DEVELOPER_PROMPT,
  GENERATE_DEVELOPER_PROMPT,
  PROMPT_FIDELITY_SUFFIX,
  buildEditTextPrompt,
  buildUserTextPrompt,
} from "../lib/oauthProxy.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "server.ts");
const historyListPath = join(__dirname, "..", "lib", "historyList.ts");
const nodeRoutePath = join(__dirname, "..", "routes", "nodes.ts");
const apiPath = join(__dirname, "..", "ui", "src", "lib", "api.ts");
const nodeApiPath = join(__dirname, "..", "ui", "src", "lib", "nodeApi.ts");

const src = await readFile(serverPath, "utf8");
const historySrc = await readFile(historyListPath, "utf8");
const nodeSrc = await readFile(nodeRoutePath, "utf8");
const apiSrc = await readFile(apiPath, "utf8");
const nodeApiSrc = await readFile(nodeApiPath, "utf8");

// Ensure both suffix constants and the builder exist
assert.ok(src.includes("buildApp"), "buildApp export missing after server split");
assert.ok(historySrc.includes("revisedPrompt"), "history revisedPrompt field missing");
assert.ok(historySrc.includes("promptMode"), "history promptMode field missing");
assert.ok(historySrc.includes("userPrompt"), "history userPrompt field missing");
assert.ok(historySrc.includes("refsCount"), "history refsCount field missing");
assert.ok(historySrc.includes("requestId"), "history requestId field missing");
assert.ok(nodeSrc.includes("normalizedPromptMode"), "node prompt mode propagation missing");
assert.ok(nodeSrc.includes("userPrompt"), "node userPrompt meta field missing");
assert.ok(nodeSrc.includes("refsCount"), "node refsCount meta field missing");
assert.ok(nodeSrc.includes("partialImages: streamResponse ? 2 : 0"), "node partial_images opt-in missing");
assert.ok(apiSrc.includes("postNodeGenerateStream"), "node SSE client missing");
assert.ok(nodeApiSrc.includes('Accept: "text/event-stream"'), "node SSE Accept header missing");

assert.equal(PROMPT_FIDELITY_SUFFIX, AUTO_PROMPT_FIDELITY_SUFFIX);
assert.ok(AUTO_PROMPT_FIDELITY_SUFFIX.includes("only append English clarifiers at the end when helpful"));
assert.ok(!DIRECT_PROMPT_FIDELITY_SUFFIX.includes("append English clarifiers"));
assert.ok(DIRECT_PROMPT_FIDELITY_SUFFIX.includes("Do not translate, summarize, restyle, add clarifiers"));

const generateDirect = buildUserTextPrompt("고양이 수채화", "direct");
const generateAuto = buildUserTextPrompt("고양이 수채화", "auto");
assert.ok(generateDirect.includes("Generate an image with this exact prompt, no modifications"));
assert.ok(!generateDirect.includes("append English clarifiers"));
assert.ok(generateAuto.includes("Generate an image: 고양이 수채화"));
assert.ok(generateAuto.includes("If the subject matter requires factual accuracy"));
assert.notEqual(generateDirect, generateAuto);

const editDirect = buildEditTextPrompt("배경만 바꿔", "direct");
const editAuto = buildEditTextPrompt("배경만 바꿔", "auto");
assert.ok(editDirect.includes("Edit this image with this exact prompt, no modifications"));
assert.ok(!editDirect.includes("append English clarifiers"));
assert.ok(editAuto.includes("Edit this image: 배경만 바꿔"));
assert.notEqual(editDirect, editAuto);

for (const prompt of [GENERATE_DEVELOPER_PROMPT, EDIT_DEVELOPER_PROMPT]) {
  assert.ok(prompt.includes("absolute quality"), "developer prompt should use neutral quality language");
  assert.ok(!prompt.includes("8k UHD"), "developer prompt should not force 8k/photo boilerplate");
  assert.ok(!prompt.includes("default to photorealistic"), "developer prompt should not force photorealism");
}

console.log("prompt-fidelity: ok");
