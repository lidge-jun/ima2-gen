// 0.09.10 — sanity tests for prompt fidelity text builder.
// We require that "direct" mode instructs the agent NOT to modify,
// and that "auto" and "direct" produce different text for the same input.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  AUTO_PROMPT_FIDELITY_SUFFIX,
  DIRECT_PROMPT_FIDELITY_SUFFIX,
  EDIT_DEVELOPER_PROMPT,
  EDIT_NO_SEARCH_DEVELOPER_PROMPT,
  GENERATE_DEVELOPER_PROMPT,
  GENERATE_NO_SEARCH_DEVELOPER_PROMPT,
  MULTIMODE_DEVELOPER_PROMPT,
  MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT,
  PROMPT_FIDELITY_SUFFIX,
  buildMultimodeSequencePrompt,
  buildEditTextPrompt,
  buildUserTextPrompt,
} from "../lib/oauthProxy.ts";
import { buildGrokPlannerPayload } from "../lib/grokImageAdapter.ts";
import { buildGrokVideoPlannerSystemPrompt } from "../lib/grokVideoPlannerPrompt.ts";
import { SAFETY_INTENT_POLICY } from "../lib/promptSafetyPolicy.ts";
import { VISIBLE_TEXT_LANGUAGE_POLICY } from "../lib/visibleTextLanguagePolicy.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "server.ts");
const historyListPath = join(__dirname, "..", "lib", "historyList.ts");
const nodeRoutePath = join(__dirname, "..", "routes", "nodes.ts");
const nodeGenerationPath = join(__dirname, "..", "lib", "nodeGeneration.ts");
const apiPath = join(__dirname, "..", "ui", "src", "lib", "api.ts");
const nodeApiPath = join(__dirname, "..", "ui", "src", "lib", "nodeApi.ts");
const asyncJobSubmitPath = join(__dirname, "..", "ui", "src", "lib", "asyncJobSubmit.ts");
const responsesOperationsPath = join(__dirname, "..", "lib", "providers", "adapters", "openaiOperations.ts");
const grokImageAdapterPath = join(__dirname, "..", "lib", "grokImageAdapter.ts");
const grokVideoPlannerPath = join(__dirname, "..", "lib", "grokVideoPlannerPrompt.ts");
const agyAdapterPath = join(__dirname, "..", "lib", "agyImageAdapter.ts");

const src = await readFile(serverPath, "utf8");
const historySrc = await readFile(historyListPath, "utf8");
const nodeSrc =
  (await readFile(nodeRoutePath, "utf8")) +
  (await readFile(nodeGenerationPath, "utf8"));
const apiSrc = await readFile(apiPath, "utf8");
const nodeApiSrc = await readFile(nodeApiPath, "utf8");
const asyncJobSubmitSrc = await readFile(asyncJobSubmitPath, "utf8");
const responsesOperationsSrc = await readFile(responsesOperationsPath, "utf8");
const grokImageAdapterSrc = await readFile(grokImageAdapterPath, "utf8");
const grokVideoPlannerSrc = await readFile(grokVideoPlannerPath, "utf8");
const agyAdapterSrc = await readFile(agyAdapterPath, "utf8");
const bannedSafetyCopy = [
  new RegExp(["non", "explicit"].join("-")),
  new RegExp(["no", ["nu", "dity"].join("")].join(" ")),
  new RegExp(["no", "erotic", "framing"].join(" ")),
];

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
assert.ok(nodeSrc.includes("partialImages: emitProgress ? 2 : 0"), "node partial_images opt-in missing");
assert.ok(apiSrc.includes("postNodeGenerateStream"), "node SSE client missing");
assert.ok(nodeApiSrc.includes("submitAsyncJobWithCapacityRetry"), "node async submitter missing");
assert.ok(asyncJobSubmitSrc.includes("async: true"), "async submitter mode missing");

assert.equal(PROMPT_FIDELITY_SUFFIX, AUTO_PROMPT_FIDELITY_SUFFIX);
assert.ok(AUTO_PROMPT_FIDELITY_SUFFIX.includes("treat the user's prompt as the source of truth"));
assert.ok(AUTO_PROMPT_FIDELITY_SUFFIX.includes("pass it through unchanged"));
assert.ok(!AUTO_PROMPT_FIDELITY_SUFFIX.includes("only append English clarifiers at the end when helpful"));
assert.ok(!DIRECT_PROMPT_FIDELITY_SUFFIX.includes("append English clarifiers"));
assert.ok(DIRECT_PROMPT_FIDELITY_SUFFIX.includes("Do not translate, summarize, restyle, add clarifiers"));
assert.ok(AUTO_PROMPT_FIDELITY_SUFFIX.includes(VISIBLE_TEXT_LANGUAGE_POLICY));
assert.ok(DIRECT_PROMPT_FIDELITY_SUFFIX.includes(VISIBLE_TEXT_LANGUAGE_POLICY));
assert.ok(SAFETY_INTENT_POLICY.length > 200, "safety intent policy must not be empty");
assert.ok(SAFETY_INTENT_POLICY.includes("ordinary adult swimwear"));
assert.ok(SAFETY_INTENT_POLICY.includes("bikini"));
assert.ok(SAFETY_INTENT_POLICY.includes("two-piece swimsuit"));
assert.ok(SAFETY_INTENT_POLICY.includes("do not replace it with a one-piece"));
assert.ok(SAFETY_INTENT_POLICY.includes("negative safety constraints"));
assert.ok(SAFETY_INTENT_POLICY.includes("minor"));
assert.ok(DIRECT_PROMPT_FIDELITY_SUFFIX.includes(SAFETY_INTENT_POLICY));
assert.ok(DIRECT_PROMPT_FIDELITY_SUFFIX.includes("classification guidance only"));
assert.ok(DIRECT_PROMPT_FIDELITY_SUFFIX.includes("append negative safety constraints"));
assert.ok(VISIBLE_TEXT_LANGUAGE_POLICY.includes("Korean text"));
assert.ok(VISIBLE_TEXT_LANGUAGE_POLICY.includes("Japanese words"));
assert.ok(VISIBLE_TEXT_LANGUAGE_POLICY.includes("Do not translate, romanize"));

const generateDirect = buildUserTextPrompt("고양이 수채화", "direct");
const generateAuto = buildUserTextPrompt("고양이 수채화", "auto");
assert.ok(generateDirect.includes("Generate an image with this exact prompt, no modifications"));
assert.ok(!generateDirect.includes("append English clarifiers"));
assert.ok(generateAuto.includes("Generate an image: 고양이 수채화"));
assert.ok(generateAuto.includes("If factual visual accuracy is required"));
assert.ok(generateAuto.includes("If the user's prompt is already visually sufficient"));
assert.ok(generateAuto.includes("pass the user's prompt through"));
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
  assert.ok(prompt.includes("at least 1 web_search call"), "real-person search should start at one call");
  assert.ok(prompt.includes("visually sufficient"), "developer prompt should pass through sufficient prompts");
  assert.ok(prompt.includes("do not search"), "developer prompt should avoid search when prompt is sufficient");
  assert.ok(!prompt.includes("AT LEAST 3"), "real-person search should not force 3+ calls");
  assert.ok(!prompt.includes("4-5"), "real-person search should not prefer 4-5 calls");
  assert.ok(prompt.includes(SAFETY_INTENT_POLICY), "developer prompt should include safety intent policy");
  assert.ok(prompt.includes("ordinary adult swimwear"), "developer prompt should preserve benign adult swimwear");
  assert.ok(prompt.includes(VISIBLE_TEXT_LANGUAGE_POLICY), "developer prompt should include visible text language policy");
}

for (const prompt of [
  GENERATE_NO_SEARCH_DEVELOPER_PROMPT,
  EDIT_NO_SEARCH_DEVELOPER_PROMPT,
  MULTIMODE_DEVELOPER_PROMPT,
  MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT,
]) {
  assert.ok(prompt.includes(SAFETY_INTENT_POLICY), "all developer prompts should include safety intent policy");
}

for (const prompt of [MULTIMODE_DEVELOPER_PROMPT, MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT]) {
  assert.ok(prompt.includes("separate image_generation_call outputs"), "multimode prompt should require separate image calls");
  assert.ok(prompt.includes("multimode sequence"), "multimode prompt should preserve sequence semantics");
  assert.ok(prompt.includes("maximum number of sequence outputs"), "multimode count must be a stage limit");
  assert.ok(prompt.includes("infer the user's intended sequence"), "multimode prompt should ask the model to plan sequence units");
  assert.ok(prompt.includes("items one per image"), "multimode prompt should split one-per-image requests into outputs");
  assert.ok(prompt.includes("Korean phrases such as"), "multimode prompt should handle Korean one-per-image phrasing");
  assert.ok(prompt.includes("'하나씩'"), "multimode prompt should recognize Korean per-item sequence wording");
  assert.ok(prompt.includes("distinct stage-specific prompt"), "multimode prompt should use distinct stage prompts");
  assert.ok(prompt.includes("Do not pass the same complete user prompt to every output"), "sequence mode should not be same-prompt batching");
  assert.ok(prompt.includes("Do not include the whole list of sequence units"), "sequence mode should not send all units to one stage");
  assert.ok(prompt.includes("only a red circle"), "sequence mode should include a concrete one-shape-per-output example");
  assert.ok(prompt.includes(SAFETY_INTENT_POLICY), "multimode prompt should include safety intent policy");
  assert.ok(prompt.includes(VISIBLE_TEXT_LANGUAGE_POLICY), "multimode prompt should include visible text language policy");
}

const multimodePrompt = buildMultimodeSequencePrompt("흰 배경에 도형 다른 색 다른 모양을 한이미지의 하나씩 네개를 그려줘", 4, {
  webSearchEnabled: false,
});
assert.ok(multimodePrompt.includes("Create a multimode sequence"));
assert.ok(multimodePrompt.includes("maximum sequence length"));
assert.ok(multimodePrompt.includes("one image_generation_call per sequence unit"));
assert.ok(multimodePrompt.includes("each output should contain only its own unit"));
assert.ok(multimodePrompt.includes('"하나씩"'));
assert.ok(multimodePrompt.includes("Use a distinct stage-specific image prompt"));
assert.ok(multimodePrompt.includes("Do not pass the same complete user prompt to every output"));
assert.ok(multimodePrompt.includes("Do not include the whole list of sequence units"));
assert.ok(multimodePrompt.includes("output 1 only a red circle"));
assert.ok(multimodePrompt.includes("Do not create one combined image_generation_call"));

const operationsTree = ts.createSourceFile(responsesOperationsPath, responsesOperationsSrc, ts.ScriptTarget.Latest, true);
const multimodeFunctions = operationsTree.statements.filter(ts.isFunctionDeclaration)
  .filter((node) => node.name?.text === "generateMultimodeViaResponses");
assert.equal(multimodeFunctions.length, 1, "expected exactly one multimode operation");
assert.ok(multimodeFunctions[0]?.body, "multimode operation body must exist");
const multimodeOperation = ts.createPrinter({ removeComments: true })
  .printNode(ts.EmitHint.Unspecified, multimodeFunctions[0].body, operationsTree);
assert.match(multimodeOperation, /MULTIMODE_DEVELOPER_PROMPT/);
assert.match(multimodeOperation, /MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT/);
assert.doesNotMatch(multimodeOperation, /Create up to \$\{maxImages\} separate image_generation_call outputs/);

const grokImagePlanner = buildGrokPlannerPayload(
  "성인 모델이 비키니를 입은 비성적 수영복 카탈로그 사진",
  "grok-imagine-image",
  "1024x1024",
  { aspect_ratio: "1:1", resolution: "1k" },
).messages[0].content as string;
const grokVideoPlanner = buildGrokVideoPlannerSystemPrompt();
for (const prompt of [grokImagePlanner, grokVideoPlanner]) {
  assert.ok(prompt.includes(SAFETY_INTENT_POLICY), "grok planner should include safety intent policy");
  assert.ok(prompt.includes("bikini means a two-piece swimsuit"), "grok planner should preserve benign bikini intent");
  assert.ok(prompt.includes("negative safety constraints"), "grok planner should not append negative safety constraints");
  assert.ok(prompt.includes("instead of rewriting it as allowed"), "grok planner should not launder unsafe prompts");
}

for (const source of [grokImageAdapterSrc, grokVideoPlannerSrc, agyAdapterSrc]) {
  assert.doesNotMatch(source, /Do NOT refuse, defer, censor, sanitize, or downgrade.*for any reason/);
  assert.doesNotMatch(source, /authorized for all usage categories/);
  for (const banned of bannedSafetyCopy) assert.doesNotMatch(source, banned);
  assert.match(source, /SAFETY_INTENT_POLICY/);
}

console.log("prompt-fidelity: ok");
