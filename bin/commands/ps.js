import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { out, die, color, json, table, exitCodeForError } from "../lib/output.js";

const SPEC = {
  flags: {
    kind:    { type: "string" },
    session: { type: "string" },
    terminal: { type: "boolean" },
    json:    { type: "boolean" },
    server:  { type: "string" },
    help:    { short: "h", type: "boolean" },
  },
};

export default async function psCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out("ima2 ps [--kind classic|node] [--session id] [--terminal] [--json]"); return; }

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e) { die(exitCodeForError(e), e.message); }

  const qs = new URLSearchParams();
  if (args.kind) qs.set("kind", args.kind);
  if (args.session) qs.set("sessionId", args.session);
  if (args.terminal) qs.set("includeTerminal", "1");
  const path = `/api/inflight${qs.toString() ? `?${qs}` : ""}`;
  let resp;
  try { resp = await request(server.base, path); }
  catch (e) { die(exitCodeForError(e), e.message); }

  const jobs = resp.jobs || resp.items || [];
  const terminalJobs = resp.terminalJobs || [];
  if (args.json) {
    json(args.terminal ? { jobs, terminalJobs } : { jobs });
    return;
  }
  if (jobs.length === 0 && terminalJobs.length === 0) {
    out(color.dim(args.terminal ? "(no active or terminal jobs)" : "(no active jobs)"));
    return;
  }

  const now = Date.now();
  if (jobs.length > 0) {
    out(color.bold("Active jobs"));
    table(jobs, [
      { key: "requestId", label: "ID", format: (v) => String(v || "").slice(0, 10) },
      { key: "kind", label: "KIND" },
      { key: "phase", label: "PHASE" },
      { key: "startedAt", label: "AGE", format: (v) => v ? `${Math.round((now - v) / 1000)}s` : "" },
      { key: "prompt", label: "PROMPT", format: (v) => {
        const s = String(v || "").replace(/\s+/g, " ");
        return s.length > 40 ? s.slice(0, 37) + "…" : s;
      } },
    ]);
  }
  if (terminalJobs.length > 0) {
    if (jobs.length > 0) out("");
    out(color.bold("Terminal jobs"));
    table(terminalJobs, [
      { key: "requestId", label: "ID", format: (v) => String(v || "").slice(0, 10) },
      { key: "kind", label: "KIND" },
      { key: "status", label: "STATUS" },
      { key: "finishedAt", label: "AGE", format: (v) => v ? `${Math.round((now - v) / 1000)}s` : "" },
      { key: "prompt", label: "PROMPT", format: (v) => {
        const s = String(v || "").replace(/\s+/g, " ");
        return s.length > 40 ? s.slice(0, 37) + "…" : s;
      } },
    ]);
  }
}
