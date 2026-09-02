import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

function parseStringArray(source: string, name: string): string[] {
  const body = new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(source)?.[1];
  assert.ok(body, `missing ${name} source array`);
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
}

function assertIncludesAll(document: string, values: readonly string[], owner: string): void {
  for (const value of values) {
    assert.ok(document.includes(value), `${owner} is missing code-owned value: ${value}`);
  }
}

describe("studio surface documentation contract", () => {
  const en = JSON.parse(read("ui/src/i18n/en.json"));
  const ko = JSON.parse(read("ui/src/i18n/ko.json"));
  const constants = read("lib/promptBuilder/constants.ts");
  const backends = parseStringArray(constants, "PROMPT_BUILDER_BACKENDS");
  const autoOrder = parseStringArray(constants, "PROMPT_BUILDER_AUTO_ORDER");
  const routeSource = read("routes/promptBuilder.ts");
  const assetRouteSource = read("routes/assetDerived.ts");
  const configKeysSource = read("lib/configKeys.ts");

  it("keeps packaged skills and README aligned with runtime labels, keys, and backend order", () => {
    const core = read("skills/ima2/SKILL.md");
    const front = read("skills/ima2-front/SKILL.md");
    const assetRequirements = read("skills/ima2-front/references/asset-requirements.md");
    const readme = read("README.md");
    const labels = [
      en.nai.positivePrompt.label,
      en.nai.negativePrompt.label,
      en.canvas.toolbar.exportAs.svg,
      en.canvas.toolbar.exportAs.vector,
    ];
    const configKeys = ["promptBuilder.backend", "promptBuilder.model"]
      .filter((key) => configKeysSource.includes(`"${key}"`));

    assertIncludesAll(core, labels, "skills/ima2/SKILL.md");
    assertIncludesAll(core, configKeys, "skills/ima2/SKILL.md");
    assertIncludesAll(core, autoOrder, "skills/ima2/SKILL.md");
    assertIncludesAll(readme, labels, "README.md");
    assertIncludesAll(readme, configKeys, "README.md");
    assertIncludesAll(readme, backends, "README.md");
    assert.ok(front.includes("ima2 vectorize"));
    assert.ok(front.includes("asset-requirements.md"));
    assert.ok(assetRequirements.includes("ima2 vectorize"));
    assert.ok(assetRequirements.includes("photographs"));
    assert.ok(assetRequirements.includes("small text"));
  });

  it("keeps English and Korean site pairs aligned with route and locale sources", () => {
    const apiPaths = [
      "/api/assets/derived",
      "/api/prompt-builder/chat",
      "/api/prompt-builder/config",
    ].filter((path) => routeSource.includes(path) || assetRouteSource.includes(path));
    const apiTokens = [...apiPaths, "vector-svg", "negativePrompt"];
    const envKeys = ["IMA2_PROMPT_BUILDER_BACKEND", "IMA2_PROMPT_BUILDER_MODEL"]
      .filter((key) => configKeysSource.includes(key));

    for (const path of [
      "site/src/pages/docs/reference/api.astro",
      "site/src/pages/ko/docs/reference/api.astro",
    ]) assertIncludesAll(read(path), apiTokens, path);

    for (const path of [
      "site/src/pages/docs/reference/config.astro",
      "site/src/pages/ko/docs/reference/config.astro",
    ]) assertIncludesAll(read(path), [...envKeys, "promptBuilder.backend", "promptBuilder.model"], path);

    const enModes = read("site/src/pages/docs/concepts/modes.astro");
    const koModes = read("site/src/pages/ko/docs/concepts/modes.astro");
    assertIncludesAll(enModes, [en.nai.positivePrompt.label, en.nai.negativePrompt.label], "English modes");
    assertIncludesAll(koModes, [ko.nai.positivePrompt.label, ko.nai.negativePrompt.label], "Korean modes");
  });

  it("keeps structure SoT aligned with code-owned routes, components, and response metadata", () => {
    const server = read("structure/03-server-api.md");
    const frontend = read("structure/04-frontend-architecture.md");
    const canvasMenu = read("ui/src/components/canvas-mode/CanvasExportMenu.tsx");
    const promptPanel = read("ui/src/components/prompt-builder/PromptBuilderPanel.tsx");
    const componentNames = [
      "NegativePromptField.tsx",
      "PromptComposer.tsx",
      "HomePromptComposer.tsx",
      "MobileComposeSheet.tsx",
      "VectorizePanel.tsx",
    ];

    assertIncludesAll(server, ["/api/assets/derived", "/api/prompt-builder/config", ...autoOrder], "server SoT");
    assertIncludesAll(frontend, componentNames, "frontend SoT");
    assert.ok(canvasMenu.includes('id: "vector"'));
    assert.ok(frontend.includes(en.canvas.toolbar.exportAs.vector));
    assert.ok(promptPanel.includes("lastBackend"));
    assert.ok(frontend.includes("answering backend"));
  });
});
