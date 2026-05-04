import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { out, die, dieWithError, color, json } from "../lib/output.js";

import { errInfo } from "../../lib/errInfo.js";
const SPEC = {
  flags: {
    json: { type: "boolean" },
    server: { type: "string" },
    help: { short: "h", type: "boolean" },
  },
};

const HELP = `
  ima2 cancel <requestId> [--json]

  Mark an in-flight job as canceled in the local ima2 server registry.
`;

export default async function cancelCmd(argv: string[]) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out(HELP); return; }

  const requestId = args.positional[0];
  if (!requestId) die(2, "requestId required");

  let server;
  try { server = await resolveServer({ serverFlag: args.server }); }
  catch (e) {
    const err = errInfo(e);
    if (args.json) json({ ok: false, requestId, error: err.message, code: err.code, status: err.status });
    dieWithError(e);
  }

  try {
    await request(server.base, `/api/inflight/${encodeURIComponent(requestId)}`, {
      method: "DELETE",
      timeoutMs: 30_000,
    });
  } catch (e) {
    const err = errInfo(e);
    if (args.json) json({ ok: false, requestId, error: err.message, code: err.code, status: err.status });
    dieWithError(e);
  }

  if (args.json) json({ ok: true, requestId });
  else out(color.green("✓ ") + `canceled ${requestId}`);
}
