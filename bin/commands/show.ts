import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { openUrl } from "../lib/platform.js";
import { out, die, color, json, exitCodeForError } from "../lib/output.js";

const SPEC = {
  flags: {
    json:   { type: "boolean" },
    reveal: { type: "boolean" },
    server: { type: "string" },
    help:   { short: "h", type: "boolean" },
  },
};

export default async function showCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out("ima2 show <filename> [--json] [--reveal]"); return; }
  const name = args.positional[0];
  if (!name) die(2, "filename required");

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e) { die(exitCodeForError(e), e.message); }

  let resp;
  try { resp = await request(server.base, "/api/history"); }
  catch (e) { die(exitCodeForError(e), e.message); }

  const items = resp.items || resp.history || [];
  const item = items.find((it) => it.filename === name || (it.filename && it.filename.endsWith(name)));
  if (!item) die(1, `not found: ${name}`);

  if (args.json) { json(item); }
  else {
    out(color.bold(item.filename));
    out(color.dim(`  prompt:`)   + ` ${item.prompt || ""}`);
    out(color.dim(`  size:`)     + ` ${item.size || ""}  quality: ${item.quality || ""}`);
    if (item.createdAt) out(color.dim(`  when:`) + ` ${new Date(item.createdAt).toISOString()}`);
    if (item.url) out(color.dim(`  url:`) + ` ${server.base}${item.url}`);
  }

  if (args.reveal) {
    const url = item.url ? `${server.base}${item.url}` : null;
    if (!url) { out(color.yellow("(no url)")); return; }
    const res = openUrl(url);
    if (!res.ok) out(color.yellow("(could not reveal)"));
  }
}
