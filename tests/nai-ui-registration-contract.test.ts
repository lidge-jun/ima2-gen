// The NovelAI lane must be selectable in the UI without any raw id or missing
// label leaking through, and it must not offer affordances the server refuses.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { errorCodes, resolveErrorSpec, type ImaErrorCode } from "../ui/src/lib/errorCodes.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");
const LOCALES = ["en", "ko", "zh-Hans", "zh-Hant"] as const;
const NAI_MODELS = [
  "nai-diffusion-5-full",
  "nai-diffusion-5-curated",
  "nai-diffusion-4-5-full",
  "nai-diffusion-4-5-curated",
] as const;

function dictionary(locale: string): Record<string, unknown> {
  return JSON.parse(read(`ui/src/i18n/${locale}.json`)) as Record<string, unknown>;
}

function lookup(dict: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>(
    (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
    dict,
  );
}

test("the generated catalog carries the nai lane and its models", () => {
  const generated = read("ui/src/generated/providers.ts");
  assert.match(generated, /"nai"/);
  for (const model of NAI_MODELS) assert.match(generated, new RegExp(model));
  // Codegen output: a hand edit here would be overwritten by the next run.
  assert.match(generated, /Do not edit/);
});

test("every nai model has a label option, so no raw id reaches the UI", () => {
  const source = read("ui/src/lib/imageModels.ts");
  for (const model of NAI_MODELS) {
    assert.match(source, new RegExp(`value: "${model}"`), `${model} has no option row`);
  }
  assert.match(source, /provider === "nai"/, "no option list is returned for the nai provider");
});

test("every nai label key resolves in all four dictionaries", () => {
  const keys = [
    "provider.naiApiKeyRequired",
    "settings.apiKeys.nai.label",
    "settings.apiKeys.nai.placeholder",
    "settings.imageModel.naiDiffusion5Full",
    "settings.imageModel.naiDiffusion5Curated",
    "settings.imageModel.naiDiffusion45Full",
    "settings.imageModel.naiDiffusion45Curated",
  ];
  for (const locale of LOCALES) {
    const dict = dictionary(locale);
    for (const key of keys) {
      const value = lookup(dict, key);
      assert.equal(typeof value, "string", `${locale} is missing ${key}`);
      assert.notEqual(String(value).trim(), "", `${locale} has an empty ${key}`);
    }
  }
});

test("the provider is offered everywhere a user picks one", () => {
  assert.match(read("ui/src/components/GenProviderModelSelect.tsx"), /value: "nai", label: "NovelAI"/);
  assert.match(read("ui/src/components/settings/ProviderStatusSelect.tsx"), /value: "nai"/);
  assert.match(read("ui/src/components/home/HomePromptComposer.tsx"), /nai: "NovelAI"/);
  assert.match(read("ui/src/components/ResultMetadataModal.tsx"), /nai: "NovelAI API"/);
  assert.match(read("ui/src/components/AccountSettings.tsx"), /provider="nai"/);
});

test("switching to nai coerces the model, and away from nai clears it", () => {
  // Without both halves a user can hold a model the selected provider cannot
  // serve, which only surfaces as an upstream rejection.
  const store = read("ui/src/store/storeSettingsImpl.ts");
  assert.ok(
    store.includes('provider === "nai" && !isNaiImageModel(currentModel)'),
    "switching to nai does not coerce the model",
  );
  assert.ok(
    store.includes("isNaiImageModel(imageModel)"),
    "selecting a nai model does not switch the provider",
  );
  assert.ok(store.includes('provider !== "nai"'), "the reset guard does not exclude nai");
});

test("the UI offers no reference attachment for nai", () => {
  // The routes answer NAI_REF_UNSUPPORTED, so the tray must cap at zero.
  const limits = read("ui/src/lib/referenceLimits.ts");
  assert.match(limits, /LANES_WITHOUT_REFERENCE_SUPPORT/);
  assert.ok(limits.includes('new Set(["nai"])'), "nai is not in the no-reference lane set");
  // oauth and api also have empty manifest limits but legitimately defer to the
  // server cap; deriving the set from emptiness would silently break them.
  assert.ok(
    !limits.includes("limits.image === undefined && limits.edit === undefined"),
    "the set is derived from empty manifest limits, which would also catch oauth and api",
  );
});

test("every NAI_* code the server can throw has UI text", () => {
  // wp4 audit blocker #1: the adapter grew codes the registry never learned, so
  // real NovelAI failures collapsed into a generic card. Enumerate the throw
  // sites instead of hand-listing, so a new throw fails here rather than in prod.
  const sources = [
    "lib/naiImageAdapter.ts",
    "lib/naiZip.ts",
    "lib/generatePipeline.ts",
    "routes/edit.ts",
  ];
  const thrown = new Set<string>();
  for (const rel of sources) {
    for (const match of read(rel).matchAll(/"(NAI_[A-Z0-9_]+)"/g)) thrown.add(match[1]);
  }
  assert.ok(thrown.size >= 13, `expected the NAI throw sites to be discovered, found ${thrown.size}`);
  for (const code of thrown) {
    assert.ok(code in errorCodes, `${code} is thrown by the server but absent from errorCodes`);
  }
});

test("nai auth and billing failures keep NovelAI copy instead of the sign-in card", () => {
  // The server tags these with an errorClass, and the priority class card says
  // "sign in again from Settings" — wrong for a lane that uses a pasted token.
  const cases: Array<[ImaErrorCode, string]> = [
    ["NAI_API_KEY_MISSING", "AUTH_INVALID"],
    ["NAI_AUTH_FAILED", "AUTH_INVALID"],
    ["NAI_SUBSCRIPTION_REQUIRED", "BILLING_REQUIRED"],
  ];
  for (const [code, errorClass] of cases) {
    const resolved = resolveErrorSpec(Object.assign(new Error("nai failure"), { code, errorClass }));
    assert.equal(resolved.code, code, `${code} was reclassified`);
    assert.notEqual(resolved.spec.cardKey, "errorCard.authClass", `${code} fell back to the sign-in card`);
  }
  // A code with no NovelAI-specific copy must still defer to the class card.
  const generic = resolveErrorSpec(Object.assign(new Error("expired"), { code: "AUTH_CHATGPT_EXPIRED", errorClass: "AUTH_EXPIRED" }));
  assert.equal(generic.spec.cardKey, "errorCard.authClass");
});
