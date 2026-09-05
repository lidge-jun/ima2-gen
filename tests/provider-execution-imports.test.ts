import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EXECUTION_CALLERS, collectCallArguments, collectRuntimeEdges, forbiddenExecutionEdges, inspectExecutionCaller,
} from "./_executionImportEdges.mjs";

const caller = "lib/generatePipeline.ts";
const owner = "./responsesImageAdapter.js";
const seam = 'import { prepareImageExecution as prepare } from "./providers/execution/index.js";';

test("exactly four production callers prepare and execute through the public seam", () => {
  assert.deepEqual(EXECUTION_CALLERS, [
    "lib/generatePipeline.ts", "lib/nodeGeneration.ts", "lib/multimodePipeline.ts", "routes/edit.ts",
  ]);
  for (const file of EXECUTION_CALLERS) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const result = inspectExecutionCaller(source, file);
    assert.deepEqual(result.forbiddenEdges, [], `${file}: concrete runtime edge`);
    assert.ok(result.prepareCalls > 0, `${file}: missing actual public prepare call`);
    assert.ok(result.executeCalls > 0, `${file}: missing execute on prepared result`);
  }
});

test("all runtime import and reexport forms are detected, including aliases and mixed types", () => {
  for (const statement of [
    `import { generateViaResponses as renamed } from "${owner}";`,
    `import * as adapter from "${owner}";`, `import adapter from "${owner}";`,
    `import "${owner}";`, `import {} from "${owner}";`,
    `import { type Options, generateViaResponses as run } from "${owner}";`,
    `import adapter, { type Options } from "${owner}";`,
    `const adapter = await import("${owner}");`,
    `const adapter = await import(\`${owner}\`);`,
    `export { generateViaResponses as renamed } from "${owner}";`,
    `export { type Options, generateViaResponses } from "${owner}";`,
    `export * from "${owner}";`, `export * as adapter from "${owner}";`,
    `export {} from "${owner}";`, `import adapter = require("${owner}");`,
  ]) {
    assert.equal(forbiddenExecutionEdges(statement, caller).length, 1, statement);
  }
});

test("every concrete owner and private legacy module is forbidden for every caller", () => {
  const owners = [
    "responsesImageAdapter", "grokImageAdapter", "grokMultimodeAdapter", "grokImageCore",
    "agyImageAdapter", "geminiApiImageAdapter", "atlasCloudImageAdapter",
    "minimaxImageAdapter", "naiImageAdapter", "comfyImageAdapter",
    "providers/execution/legacy", "providers/execution/legacyClassic",
    "providers/execution/legacyNode", "providers/execution/legacyEdit", "providers/execution/legacyMultimode",
  ];
  for (const file of EXECUTION_CALLERS) for (const name of owners) for (const ext of ["js", "ts"]) {
    const prefix = file.startsWith("routes/") ? "../lib/" : "./";
    const source = `import { run as alias } from "${prefix}unused/../${name}.${ext}";`;
    assert.equal(forbiddenExecutionEdges(source, file).length, 1, `${file}: ${source}`);
  }
});

test("genuine type-only edges, policy helpers and internal execution imports are permitted", () => {
  for (const source of [
    `import type { Options } from "${owner}";`, `import type * as T from "${owner}";`,
    `import type Options from "${owner}";`, `import type T = require("${owner}");`,
    `import { type Options as T } from "${owner}";`,
    `export type * from "${owner}";`, `export type { Options } from "${owner}";`,
    `export { type Options } from "${owner}";`,
    `type T = import("${owner}").Options;`, `type T = typeof import("${owner}");`,
  ]) assert.deepEqual(collectRuntimeEdges(source, caller), [], source);
  for (const name of ["providers/derive", "naiOptions", "refs", "generationErrors", "inflight", "providers/execution/index", "providers/execution/admission"]) {
    assert.deepEqual(forbiddenExecutionEdges(`import * as helper from "./${name}.js";`, caller), []);
  }
  const internal = 'import { generateViaResponses } from "../../responsesImageAdapter.js";';
  assert.equal(collectRuntimeEdges(internal, "lib/providers/execution/legacyClassic.ts").length, 1);
  assert.deepEqual(forbiddenExecutionEdges(internal, "lib/providers/execution/legacyClassic.ts"), []);
});

test("comments and strings cannot fake edges or execution activation", () => {
  const source = `${seam}
    // prepare(ctx, request); execution.execute(); import "${owner}";
    const example = 'prepare(ctx, request); execution.execute(); import "${owner}";';`;
  assert.deepEqual(inspectExecutionCaller(source, caller), { forbiddenEdges: [], prepareCalls: 0, executeCalls: 0 });
  assert.deepEqual(collectCallArguments(source, caller, "prepare"), []);
  assert.deepEqual(collectCallArguments('run(prompt, { /* references: bad */ model, ...options });', caller, "run"), [
    ["prompt", "{ model, ...options }"],
  ]);
});

test("prepare and execute must be linked to the real import and prepared binding", () => {
  for (const body of [
    "const execution = await prepare(ctx, request); await execution.execute();",
    "await (await prepare(ctx, request)).execute();",
    'const execution = await prepare(ctx, request); await execution["execute"]();',
  ]) {
    const result = inspectExecutionCaller(`${seam} async function run() { ${body} }`, caller);
    assert.equal(result.prepareCalls, 1, body);
    assert.equal(result.executeCalls, 1, body);
  }
  const namespace = 'import * as seam from "./providers/execution/index.ts"; await (await seam.prepareImageExecution(ctx, request)).execute();';
  assert.equal(inspectExecutionCaller(namespace, caller).executeCalls, 1);
  for (const body of [
    "const execution = await prepare(ctx, request); await unrelated.execute();",
    "const execution = await prepare(ctx, request); function shadow(execution) { execution.execute(); }",
    "function shadow(prepare) { const execution = prepare(ctx, request); execution.execute(); }",
    "const execution = await prepare(ctx, request); void execution.execute;",
  ]) assert.equal(inspectExecutionCaller(`${seam} ${body}`, caller).executeCalls, 0, body);
  assert.equal(inspectExecutionCaller("function prepareImageExecution() {} prepareImageExecution(ctx, request);", caller).prepareCalls, 0);
});

test("in-memory caller mutations cannot pass by retaining imports or comments", () => {
  for (const file of EXECUTION_CALLERS) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const prefix = file.startsWith("routes/") ? "../lib/" : "./";
    const bypass = `${source}\nexport { generateViaResponses as hidden } from "${prefix}responsesImageAdapter.ts";`;
    assert.equal(inspectExecutionCaller(bypass, file).forbiddenEdges.length, 1, file);
    const withoutExecute = source.replace(/\.execute\s*\(/g, ".notExecute(");
    assert.notEqual(withoutExecute, source, `${file}: mutation must activate`);
    const result = inspectExecutionCaller(`${withoutExecute}\n// execution.execute()`, file);
    assert.ok(result.prepareCalls > 0, `${file}: preserve the real prepare call`);
    assert.equal(result.executeCalls, 0, `${file}: import/prepare alone must not pass`);
    const withoutPublicBinding = source.replace(/\bprepareImageExecution\b/g, "unrelatedPrepare");
    assert.notEqual(withoutPublicBinding, source, `${file}: prepare mutation must activate`);
    assert.equal(inspectExecutionCaller(withoutPublicBinding, file).prepareCalls, 0, file);
  }
});
