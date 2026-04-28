import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { out, die, color, json, table, exitCodeForError } from "../lib/output.js";

const SPEC = {
  flags: {
    count:  { short: "n", type: "string", default: "20" },
    json:   { type: "boolean" },
    server: { type: "string" },
    help:   { short: "h", type: "boolean" },
  },
};

export default async function lsCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out("ima2 ls [-n count] [--json]"); return; }

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e) { die(exitCodeForError(e), e.message); }

  const limit = parseInt(args.count) || 20;
  let resp;
  try { resp = await request(server.base, "/api/history"); }
  catch (e) { die(exitCodeForError(e), e.message); }

  const items = (resp.items || resp.history || []).slice(0, limit);

  if (args.json) { json({ items }); return; }

  if (items.length === 0) {
    out(color.dim("(no history)"));
    return;
  }
  table(items, [
    { key: "filename", label: "FILENAME" },
    { key: "quality",  label: "Q" },
    { key: "size",     label: "SIZE" },
    { key: "createdAt", label: "WHEN", format: (v) => {
      if (!v) return "";
      const d = new Date(v);
      return d.toISOString().replace("T", " ").slice(0, 19);
    } },
    { key: "prompt", label: "PROMPT", format: (v) => {
      const s = String(v || "").replace(/\s+/g, " ");
      return s.length > 48 ? s.slice(0, 45) + "…" : s;
    } },
  ]);
}
