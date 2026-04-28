import { parseArgs } from "../lib/args.js";
import { resolveServer } from "../lib/client.js";
import { out, die, color, json, exitCodeForError } from "../lib/output.js";

const SPEC = {
  flags: {
    json:   { type: "boolean" },
    server: { type: "string" },
    help:   { short: "h", type: "boolean" },
  },
};

export default async function pingCmd(argv) {
  const args = parseArgs(argv, SPEC);
  if (args.help) { out("ima2 ping [--json]"); return; }

  try {
    const { base, health } = await resolveServer({ serverFlag: args.server });
    const h: any = health;
    if (args.json) {
      json({ ok: true, base, ...h });
    } else {
      out(color.green("✓ ") + `${base}  v${h.version}  uptime ${h.uptimeSec}s  activeJobs ${h.activeJobs}`);
    }
  } catch (e) {
    if (args.json) { json({ ok: false, error: e.message }); process.exit(exitCodeForError(e)); }
    die(exitCodeForError(e), e.message);
  }
}
