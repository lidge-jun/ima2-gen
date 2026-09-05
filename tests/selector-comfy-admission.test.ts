import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import type { LaneCatalogSnapshot } from "../ui/src/lib/laneCatalog";

const ui = fileURLToPath(new URL("../ui/", import.meta.url));
const requireUi = createRequire(ui + "package.json");
const react = requireUi("react") as typeof import("../ui/node_modules/@types/react/index");
const server = requireUi("react-dom/server") as { renderToStaticMarkup(element: unknown): string };
type Props = { onChange(value: string): void; groups: Array<{ items: Array<{ value: string; disabled?: boolean }> }> };
type Fixture = { state: Record<string, unknown>; snapshot: LaneCatalogSnapshot;
  controls: Record<string, Props>; calls: unknown[][]; providers: unknown[] };
let compiled: Promise<string> | undefined;

async function selectorBundle(): Promise<string> {
  try {
    compiled ??= build({ entryPoints: [ui + "src/components/GenProviderModelSelect.tsx"],
      bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      external: ["react", "react/jsx-runtime"], logLevel: "silent",
      define: { "import.meta.env": '{}', "process.env.NODE_ENV": '"production"' },
      plugins: [{ name: "public-selector-props", setup(builder) {
        const modules: Record<string, string> = {
          "../store/useAppStore": "export const useAppStore = Object.assign((select)=>select(__fixture.state),{getState:()=>__fixture.state,setState:()=>{throw Error('unexpected state write')}});",
          "../hooks/useLaneCatalog": "export const useLaneCatalog=()=>({...__fixture.snapshot,refresh:async()=>{throw Error('unexpected refresh')}});",
          "../lib/laneCatalog": "export const getLaneCatalogSnapshot=()=>__fixture.snapshot;",
          "../lib/mcpProviders": "export const useMcpProviders=()=>({providers:__fixture.providers,loading:false,error:null});export const getMcpModelCatalog=()=>{throw Error('SSR must not fetch')};",
          "../store/storeSettingsImpl": "export const hydrateMcpSelectionImpl=()=>{};export const reconcileMcpPresetStateImpl=()=>{};export const setMcpProviderImpl=(x)=>__fixture.calls.push(['mcp-provider',x]);export const setMcpModelImpl=(x)=>__fixture.calls.push(['mcp',x]);export const setMcpModelWithKindImpl=(x,k)=>__fixture.calls.push(['mcp-kind',x,k]);",
          "../i18n": "export const useI18n=()=>({t:(key)=>key,locale:'en'});",
          "./controls/Select": "export function Select(props){__fixture.controls[props.id]=props;return null;}",
        };
        builder.onResolve({ filter: /.*/ }, (args) => args.importer.endsWith("GenProviderModelSelect.tsx")
          && Object.hasOwn(modules, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: modules[args.path], loader: "js" }));
      } }],
    }).then((result) => result.outputFiles[0].text);
    return await compiled;
  } catch (error) { throw new Error(`Selector fixture compilation failed: ${String(error)}`); }
}

function ready(): LaneCatalogSnapshot {
  return { phase: "ready", observedAt: 1, error: null, catalog: { comfy: { status: "ready",
    models: { image: [{ id: "cedar", label: "Cedar" }], video: [{ id: "motion", label: "Motion" }] } } } };
}

async function render(patch: Record<string, unknown> = {}, snapshot = ready()): Promise<Fixture> {
  const f: Fixture = { state: {}, snapshot, controls: {}, calls: [], providers: [] };
  const call = (name: string) => (value: unknown) => { f.calls.push([name, value]); };
  f.state = { provider: "comfy", imageModel: "gpt-5.6-luna", videoModelSelected: false,
    mcpProvider: null, mcpModel: null, mcpMediaKind: "image", comfyWorkflow: "cedar", comfyVideoWorkflow: null,
    reasoningEffort: "low", setProvider: call("provider"), setImageModel: call("image"),
    selectVideoModel: call("grok-video"), setComfyWorkflow: call("comfy-image"),
    setComfyVideoWorkflow: call("comfy-video"), setReasoningEffort: call("effort"), ...patch };
  if (f.state.mcpProvider) f.providers = [{ id: f.state.mcpProvider, enabled: true, executable: true, status: { state: "connected" } }];
  const module = { exports: {} as { GenProviderModelSelect: () => unknown } };
  const context = { __fixture: f, module, exports: module.exports,
    require(name: string) { assert.ok(["react", "react/jsx-runtime"].includes(name), `Unexpected dependency:${name}`); return requireUi(name); } };
  runInNewContext(await selectorBundle(), context, { timeout: 2000 });
  server.renderToStaticMarkup(react.createElement(module.exports.GenProviderModelSelect as never));
  assert.equal(typeof f.controls["sidebar-generation-model"]?.onChange, "function");
  return f;
}

test("actual selector Comfy image/video callbacks admit only current eligible workflows", async () => {
  for (const [value, expected] of [["cedar", ["comfy-image", "cedar"]], ["comfy-video:motion", ["comfy-video", "motion"]]] as const) {
    const f = await render(); f.controls["sidebar-generation-model"].onChange(value);
    assert.deepEqual(f.calls, [expected]);
  }
  for (const value of ["ghost", "comfy-video:ghost", "video:grok-imagine-video-1.5", "effort:high"]) {
    const f = await render(); f.controls["sidebar-generation-model"].onChange(value); assert.deepEqual(f.calls, []);
  }
});

test("captured callbacks reject fresh-loading, disconnected, locked and stale-context state", async () => {
  for (const change of [
    (f: Fixture) => { f.snapshot = { ...f.snapshot, phase: "loading" }; },
    (f: Fixture) => { f.snapshot.catalog!.comfy.status = "disconnected"; },
    (f: Fixture) => { f.snapshot.catalog!.comfy.models.video[0].executable = false; },
    (f: Fixture) => { f.snapshot.catalog!.comfy.models.video[0].description = "origin (offline)"; },
    (f: Fixture) => { f.state.provider = "oauth"; },
    (f: Fixture) => { f.state.mcpProvider = "runway"; },
  ]) {
    const f = await render(); const previous = f.controls["sidebar-generation-model"].onChange;
    change(f); previous("comfy-video:motion"); assert.deepEqual(f.calls, []);
  }
});

test("MCP and other core contexts never interpret reserved Comfy values as setters", async () => {
  const mcp = await render({ mcpProvider: "runway" });
  mcp.controls["sidebar-generation-model"].onChange("comfy-video:motion"); assert.deepEqual(mcp.calls, []);
  mcp.controls["sidebar-generation-model"].onChange("img:fixture-model");
  assert.deepEqual(mcp.calls.map((row) => Array.from(row)), [["mcp-kind", "fixture-model", "image"]]);
  const gpt = await render({ provider: "oauth", comfyWorkflow: null });
  gpt.controls["sidebar-generation-model"].onChange("comfy-video:motion"); assert.deepEqual(gpt.calls, []);
  gpt.controls["sidebar-generation-model"].onChange("effort:high"); assert.deepEqual(gpt.calls, [["effort", "high"]]);
});

test("missing lane retains Comfy setup option and unavailable selected ID without enabling it", async () => {
  const f = await render({ comfyWorkflow: "deleted" }, { phase: "ready", observedAt: 1, error: null,
    catalog: { oauth: { status: "ready", models: { image: [], video: [] } } } });
  assert.ok(f.controls["sidebar-generation-provider"].groups.flatMap((g) => g.items).some((i) => i.value === "core:comfy"));
  const ghost = f.controls["sidebar-generation-model"].groups.flatMap((g) => g.items).find((i) => i.value === "deleted");
  assert.equal(ghost?.disabled, true);
  f.controls["sidebar-generation-model"].onChange("deleted"); assert.deepEqual(f.calls, []);
});
