import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { fileToDataUri } from "../lib/files.js";
import { out, die, json, exitCodeForError } from "../lib/output.js";

const SPEC = {
  flags: {
    json: { type: "boolean" },
    server: { type: "string" },
    help: { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 metadata <imagefile> [--json]

  Read embedded metadata from any local image file.
  POSTs { dataUrl } to /api/metadata/read.
`;

export default async function metadataCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }
  const file = args.positional[0];
  if (!file) die(2, "image file required");
  const dataUrl = await fileToDataUri(file);
  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e: any) { die(exitCodeForError(e), e.message); throw e; }
  const resp = await request(server.base, "/api/metadata/read", {
    method: "POST",
    body: { dataUrl },
  }).catch((e) => die(exitCodeForError(e), `${e.message}${e.code ? ` (${e.code})` : ""}`));
  if (args.json) { json(resp); }
  else out(JSON.stringify(resp, null, 2));
}
