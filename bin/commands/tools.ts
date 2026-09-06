// `ima2 tools` — machine contract entrypoint for AI agents (070 WP7).
// Envelope + rules per devlog 070/071: pure JSON on stdout with --json,
// diagnostics to stderr, typed errors, offline snapshot fallback ONLY on
// SERVER_UNREACHABLE (or explicit --offline).
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "../../config.js";
import { buildCatalog } from "../../lib/contracts/catalog.js";
import {
  buildToolShow,
  buildToolsList,
  catalogVersion,
  errorEnvelope,
  executionBindingFor,
  okEnvelope,
} from "../../lib/contracts/discovery.js";
import { loadAllBundledSnapshots, readLocalSnapshot } from "../../lib/mcp/snapshotStore.js";
import type { ToolContract } from "../../lib/contracts/types.js";
import { parseArgs, type ParsedArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { json, out, exitCodeForError } from "../lib/output.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HELP = `
  ima2 tools <list|show|schema|call> [id] [--json] [--offline] [--server <url>] [--input '<json>']

  Machine-readable tool contract surface (agents: start with 'ima2 tools list --json').

  Subcommands:
    list             All known tools: id, namespace, availability, executable
    show <id>        Full contract incl. execution binding (normalized input contract)
    schema <id>      Input schema only (re-check right before calling)
    call <id>        Execute a bound tool: --input '<json>' matching the execution.inputContract

  Rules:
    - documented/installed tools are rejected before any network call (auth_required)
    - offline fallback happens only when the server is unreachable (or --offline)
    - error envelopes carry typed codes; never parse 'message' for logic
`;

const FLAGS = {
  json: { type: "boolean" },
  offline: { type: "boolean" },
  server: { type: "string" },
  input: { type: "string" },
  help: { short: "h", type: "boolean" },
};

function cliVersion(): string {
  try { return (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { version?: string }).version || "?"; } catch { return "?"; }
}

function localEntries(): ToolContract[] {
  const snapshots = [];
  for (const provider of config.mcp.enabledProviders) {
    const snapshot = readLocalSnapshot(config.mcp.snapshotDir, provider)
      ?? loadAllBundledSnapshots(config.storage.packageRoot).find((s) => s.provenance.provider === provider);
    if (snapshot) snapshots.push(snapshot);
  }
  return buildCatalog({ snapshots });
}

function localMeta(entries: ToolContract[]) {
  return { catalogVersion: catalogVersion(entries), cliVersion: cliVersion() };
}

async function fromServer(args: ParsedArgs, path: string): Promise<Record<string, unknown> | null> {
  if (args.offline) return null;
  try {
    const server = await resolveServer({ serverFlag: args.server });
    return await request(server.base, path, { timeoutMs: 8000 }) as Record<string, unknown>;
  } catch (error) {
    if ((error as { code?: string }).code === "SERVER_UNREACHABLE" && !args.server && !process.env.IMA2_SERVER) return null; // offline fallback
    throw error;
  }
}

function emit(payload: unknown, asJson: boolean): void {
  if (asJson) { json(payload); return; }
  json(payload); // machine surface: JSON is the primary output either way
}

async function runToolsCommand(argv: string[]): Promise<void> {
  const args = parseArgs(argv, { flags: FLAGS });
  if (args.help) { out(HELP); return; }
  const [sub, id] = args.positional;
  const asJson = Boolean(args.json);

  if (sub === "list") {
    const server = await fromServer(args, "/api/contracts");
    if (server) { emit(server, asJson); return; }
    const entries = localEntries();
    emit(okEnvelope({ tools: buildToolsList(entries), source: "local-snapshot" }, localMeta(entries)), asJson);
    return;
  }

  if ((sub === "show" || sub === "schema") && id) {
    const server = await fromServer(args, `/api/contracts/${encodeURIComponent(id)}`);
    if (server) {
      if (sub === "schema" && (server as { data?: { tool?: { inputSchema?: unknown } } }).data?.tool) {
        const tool = (server as { data: { tool: Record<string, unknown> } }).data.tool;
        emit({ ...server, data: { id: tool.id, inputSchema: tool.inputSchema, execution: tool.execution ?? null } }, asJson);
      } else emit(server, asJson);
      return;
    }
    const entries = localEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) { emit(errorEnvelope("unknown_tool", `no contract: ${id}`, localMeta(entries)), asJson); process.exitCode = 1; return; }
    const shown = buildToolShow(entry);
    emit(okEnvelope(sub === "schema" ? { id: entry.id, inputSchema: entry.inputSchema, execution: shown.execution } : { tool: shown }, localMeta(entries)), asJson);
    return;
  }

  if (sub === "call" && id) {
    await callTool(args, id, asJson);
    return;
  }

  out(HELP);
  process.exitCode = sub ? 1 : 0;
}

export default async function toolsCommand(argv: string[]): Promise<void> {
  try { await runToolsCommand(argv); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    const code = (error as Error & { code?: string }).code;
    const exit = exitCodeForError(error);
    if (exit !== 4 && code !== "SERVER_UNREACHABLE") throw error;
    const envelope = errorEnvelope("server_error", error.message, { catalogVersion: "unavailable", cliVersion: cliVersion() });
    json({ ...envelope, error: { ...envelope.error, code: code ?? "SERVER_ACCESS_DENIED" } });
    process.exitCode = exit;
  }
}

async function callTool(args: ParsedArgs, id: string, asJson: boolean): Promise<void> {
  const entries = localEntries();
  const meta = localMeta(entries);
  const entry = entries.find((e) => e.id === id);
  if (!entry) { emit(errorEnvelope("unknown_tool", `no contract: ${id}`, meta), asJson); process.exitCode = 1; return; }
  const binding = executionBindingFor(entry);
  if (!binding) {
    emit(errorEnvelope("execution_unbound", `${id} has no execution binding; see 'ima2 tools show ${id}'`, meta), asJson);
    process.exitCode = 1;
    return;
  }
  // Pre-network availability gate: a documented snapshot is never callable.
  const server = await fromServer(args, `/api/contracts/${encodeURIComponent(id)}`);
  const availability = (server as { data?: { tool?: { availability?: { state?: string } } } })?.data?.tool?.availability?.state
    ?? entry.availability.state;
  if (availability !== "callable") {
    const code = availability === "stale" ? "schema_changed" : availability === "connected" ? "unavailable" : "auth_required";
    emit(errorEnvelope(code, `tool availability is '${availability}' — connect the provider first`, meta), asJson);
    process.exitCode = 1;
    return;
  }
  let input: Record<string, unknown>;
  try { input = JSON.parse(String(args.input ?? "{}")); } catch {
    emit(errorEnvelope("invalid_input", "--input must be valid JSON matching execution.inputContract", meta), asJson);
    process.exitCode = 1;
    return;
  }
  const serverInfo = await resolveServer({ serverFlag: args.server });
  const path = binding.binding === "mcp-generate" ? "/api/mcp/generate" : "/api/mcp/media-action";
  const response = await request(serverInfo.base, path, { method: "POST", body: input, timeoutMs: 30_000 });
  emit(okEnvelope({ submitted: response, note: "async job: watch /api/events or 'ima2 inflight ls'" }, meta), asJson);
}
