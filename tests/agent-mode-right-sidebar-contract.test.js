import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("Agent Mode right sidebar contract", () => {
  it("mounts image, prompt library, forms, quality, model, and queue tabs", () => {
    const workspace = readSource("ui/src/components/agent/AgentWorkspace.tsx");
    const chat = readSource("ui/src/components/agent/AgentChatPane.tsx");
    const sidebar = readSource("ui/src/components/agent/AgentRightSidebar.tsx");
    const tabs = readSource("ui/src/components/agent/AgentSidebarTabs.tsx");
    const serverSettings = readSource("lib/agentSettings.ts");
    const uiSettings = readSource("ui/src/lib/agentGenerationSettings.ts");
    const shellSidebar = readSource("ui/src/components/Sidebar.tsx");
    const quality = readSource("ui/src/components/agent/AgentQualityPanel.tsx");
    const model = readSource("ui/src/components/agent/AgentModelSelector.tsx");
    const globalModel = readSource("ui/src/components/ImageModelSelect.tsx");
    const promptLibrary = readSource("ui/src/components/agent/AgentPromptLibraryPanel.tsx");
    const css = readSource("ui/src/styles/agent-workspace-sidebar.css");
    const ko = readSource("ui/src/i18n/ko.json");
    const en = readSource("ui/src/i18n/en.json");

    assert.match(workspace, /AgentRightSidebar/);
    assert.match(workspace, /settings={selectedSettings}/);
    assert.match(workspace, /<AgentSessionRail[\s\S]*?onOpenDrawer/);
    assert.match(workspace, /onSettingsChange={updateGenerationSettings}/);
    assert.match(chat, /AgentModelSelector/);
    assert.doesNotMatch(workspace, /AgentModelSheet/);
    assert.doesNotMatch(workspace, /setModelSheetOpen/);
    assert.doesNotMatch(chat, /agent-model-chip/);
    assert.doesNotMatch(chat, /formatModelSummary/);
    assert.match(sidebar, /AgentImagePane/);
    assert.match(sidebar, /agent-dialog--tools/);
    assert.match(sidebar, /useAgentDialogFocus/);
    assert.match(sidebar, /SidebarBody/);
    assert.match(sidebar, /AgentPromptLibraryPanel/);
    assert.match(sidebar, /AgentFormTemplatePanel/);
    assert.match(sidebar, /AgentFormTemplatePanel/);
    assert.match(sidebar, /AgentQualityPanel/);
    assert.match(sidebar, /AgentModelSelector/);
    assert.match(sidebar, /AgentQueuePanel/);
    assert.match(tabs, /\["image", "library", "forms", "quality", "model", "queue"\]/);
    assert.match(quality, /generationStrategy/);
    assert.match(model, /image-model-select__trigger--pill/);
    assert.match(model, /image-model-select__menu/);
    assert.match(model, /AGENT_LLM_MODEL_OPTIONS/);
    assert.doesNotMatch(globalModel, /AGENT_LLM_MODEL_OPTIONS/);
    assert.match(model, /getAgentLlmModelOption/);
    assert.match(model, /REASONING_EFFORT_OPTIONS/);
    assert.match(model, /reasoningEffort/);
    assert.match(model, /provider: option\.provider/);
    assert.match(model, /role="menuitemradio"/);
    assert.match(serverSettings, /reasoningEffort: "none"/);
    assert.match(uiSettings, /reasoningEffort: "none"/);
    assert.match(promptLibrary, /agent:form/);
    assert.match(css, /\.agent-right-sidebar/);
    assert.match(css, /\.agent-sidebar-tabs/);
    assert.match(en, /"quickSettingsMenu": "Model and reasoning quick settings"/);
    assert.match(ko, /"quickSettingsMenu": "모델 및 추론 빠른 설정"/);
  });

  it("syncs sidebar settings and queue actions through the server-backed workspace", () => {
    const workspace = readSource("ui/src/components/agent/AgentWorkspace.tsx");
    const api = readSource("ui/src/lib/agentApi.ts");
    const types = readSource("ui/src/components/agent/agentTypes.ts");

    assert.match(types, /type AgentGenerationSettings/);
    assert.match(types, /queueBySession: Record<string, AgentQueueItem\[\]>/);
    assert.match(types, /runSummaryBySession: Record<string, AgentSessionRunSummary>/);
    assert.match(workspace, /updateGenerationSettings/);
    assert.match(workspace, /onSettingsChange={updateGenerationSettings}/);
    assert.match(workspace, /queueItems={queueItems}/);
    assert.match(workspace, /runSummary={selectedRunSummary}/);
    assert.match(workspace, /cancelAgentQueueItem/);
    assert.match(workspace, /retryAgentQueueItem/);
    assert.match(api, /enqueueAgentTurn/);
    assert.match(api, /cancelAgentQueueItem/);
    assert.match(api, /retryAgentQueueItem/);
  });

  it("keeps Agent model dropdown scoped to LLM model and reasoning", () => {
    const model = readSource("ui/src/components/agent/AgentModelSelector.tsx");
    const globalModel = readSource("ui/src/components/ImageModelSelect.tsx");
    const agentGen = readSource("lib/agentImageVideoGen.ts");
    const grokAdapter = readSource("lib/grokImageAdapter.ts");
    const grokVideo = readSource("lib/grokVideoAdapter.ts");
    const types = readSource("ui/src/components/agent/agentTypes.ts");
    const css = readSource("ui/src/styles/provider-controls.css");

    assert.match(types, /provider: Extract<CoreProviderId, AgentLlmModelOption\["provider"\]>/);
    const options = readSource("ui/src/lib/agentModelOptions.ts");
    assert.match(model, /AGENT_LLM_MODEL_OPTIONS/);
    assert.match(options, /value: "gpt-5\.4-mini"[\s\S]*?shortLabel: "5\.4m"[\s\S]*?provider: "oauth"/);
    assert.match(options, /value: "gpt-5\.5"[\s\S]*?shortLabel: "5\.5"[\s\S]*?provider: "oauth"/);
    assert.match(options, /value: "gpt-5\.4"[\s\S]*?shortLabel: "5\.4"[\s\S]*?provider: "oauth"/);
    assert.match(options, /value: "grok-4\.3"[\s\S]*?shortLabel: "4\.3"[\s\S]*?provider: "grok"/);
    assert.match(model, /REASONING_EFFORT_OPTIONS/);
    assert.match(model, /image-model-select__trigger--pill/);
    assert.match(model, /image-model-select__menu/);
    assert.match(model, /provider: option\.provider/);
    assert.doesNotMatch(model, /<select value=\{settings\.provider\}/);
    assert.doesNotMatch(model, /<option value="grok">Grok<\/option>/);
    assert.doesNotMatch(model, /GROK_IMAGE_MODEL_OPTIONS|GEMINI_IMAGE_MODEL_OPTIONS|VIDEO_MODEL_OPTIONS/);
    assert.doesNotMatch(model, /ProviderCard/);
    assert.doesNotMatch(model, /getProviderIdentity\(provider\)/);
    assert.doesNotMatch(model, /isGrokImageModel\(settings\.model\)/);
    assert.doesNotMatch(model, /provider === "grok"/);
    assert.doesNotMatch(css, /\.agent-provider-options/);
    assert.match(agentGen, /import \{ DEFAULT_GROK_PLANNER_MODEL \} from "\.\.\/config\.js"/);
    assert.match(agentGen, /AGENT_GROK_PLANNER_MODELS = new Set\(\[DEFAULT_GROK_PLANNER_MODEL, "grok-4\.5", "grok-4\.3"\]\)/);
    assert.match(agentGen, /rawModel: grokPlannerModel \? undefined : options\.model/);
    assert.match(agentGen, /plannerModel: grokPlannerModel/);
    assert.match(grokAdapter, /plannerModel\?: string/);
    assert.match(grokAdapter, /const plannerModel = options\.plannerModel \|\| planner\.model/);
    assert.match(grokVideo, /const plannerModel = options\.plannerModel \|\| cfg\.plannerModel/);
  });
});
