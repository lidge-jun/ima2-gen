import { writeFile, access } from "fs/promises";
import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { out, die, color, json, exitCodeForError } from "../lib/output.js";

const HELP = `
  ima2 comfy <subcommand> [options]

  Subcommands:
    export <filename> [-o <out>] [--force]
`;

const FLAGS = {
  json: { type: "boolean" },
  server: { type: "string" },
  out: { short: "o", type: "string" },
  force: { type: "boolean" },
  help: { short: "h", type: "boolean" },
};

async function exportSub(argv) {
  const args = parseArgs(argv, { flags: FLAGS });
  const filename = args.positional[0];
  if (!filename) die(2, "filename required");
  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e: any) { die(exitCodeForError(e), e.message); throw e; }
  const resp: any = await request(server.base, "/api/comfy/export-image", {
    method: "POST",
    body: { filename },
  }).catch((e) => die(exitCodeForError(e), `${e.message}${e.code ? ` (${e.code})` : ""}`));
  const target = args.out || `${filename}.workflow.json`;
  if (!args.force) {
    try {
      await access(target);
      die(2, `${target} already exists. Pass --force to overwrite.`);
    } catch { /* file does not exist — proceed */ }
  }
  await writeFile(target, JSON.stringify(resp, null, 2));
  if (args.json) { json({ path: target }); return; }
  out(color.green("✓ ") + target);
}

const SUB: Record<string, (argv: any[]) => Promise<void>> = {
  export: exportSub,
};

export default async function comfyCmd(argv) {
  const sub = argv[0];
  if (!sub || sub === "--help" || sub === "-h") { out(HELP); return; }
  const handler = SUB[sub];
  if (!handler) die(2, `unknown subcommand: ${sub}\n${HELP}`);
  return handler(argv.slice(1));
}
