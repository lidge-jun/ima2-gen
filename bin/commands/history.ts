import { readFile } from "fs/promises";
import { extname, basename } from "path";
import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { out, die, color, json, exitCodeForError } from "../lib/output.js";
import { getCliBrowserId } from "../lib/browser-id.js";

const HELP = `
  ima2 history <subcommand> [options]

  Subcommands:
    rm <filename> [--permanent] [--yes]    Soft-delete (default) or hard-delete
    restore <filename> --trash-id <id>     Restore from trash
    favorite <filename>                    Toggle favorite status
    import <localfile>                     Import a local image into history

  Common options:
        --server <url>                     Override server URL
        --json                             JSON output
        --yes                              Skip destructive confirmation
`;

const COMMON_FLAGS = {
  json: { type: "boolean" },
  server: { type: "string" },
  yes: { type: "boolean" },
  permanent: { type: "boolean" },
  "trash-id": { type: "string" },
  help: { short: "h", type: "boolean" },
};

async function getServer(args) {
  try { return await resolveServer({ serverFlag: args.server }); }
  catch (e: any) { die(exitCodeForError(e), e.message); throw e; }
}

function handle(e) {
  die(exitCodeForError(e), `${e.message}${e.code ? ` (${e.code})` : ""}`);
}

async function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf-8");
    const onData = (chunk) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        resolve(buf.slice(0, nl));
      }
    };
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function rmSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const filename = args.positional[0];
  if (!filename) die(2, "filename required");
  if (!args.yes && !process.stdin.isTTY) die(2, "destructive: pass --yes for non-TTY");
  if (!args.yes) {
    process.stdout.write(`${args.permanent ? "PERMANENTLY delete" : "Soft-delete"} ${filename}? [y/N] `);
    const ans = await readLine();
    if (!/^y(es)?$/i.test(ans.trim())) { out("(canceled)"); return; }
  }
  const server = await getServer(args);
  const path = args.permanent
    ? `/api/history/${encodeURIComponent(filename)}/permanent`
    : `/api/history/${encodeURIComponent(filename)}`;
  const resp = await request(server.base, path, { method: "DELETE" }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green(args.permanent ? "✓ permanently deleted" : "✓ moved to trash"));
  if (resp?.trashId) out(color.dim(`  trashId: ${resp.trashId}`));
}

async function restoreSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const filename = args.positional[0];
  if (!filename) die(2, "filename required");
  const trashId = args["trash-id"];
  if (!trashId) die(2, "--trash-id required (returned by `history rm <filename>`)");
  const server = await getServer(args);
  const resp = await request(server.base, `/api/history/${encodeURIComponent(filename)}/restore`, {
    method: "POST",
    body: { trashId },
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green("✓ restored"));
}

async function favoriteSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const filename = args.positional[0];
  if (!filename) die(2, "filename required");
  const server = await getServer(args);
  const browserId = getCliBrowserId();
  const resp: any = await request(server.base, "/api/history/favorite", {
    method: "POST",
    body: { filename },
    headers: { "X-Ima2-Browser-Id": browserId },
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green(resp.isFavorite ? "✓ favorited" : "✓ unfavorited"));
}

async function importSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const filepath = args.positional[0];
  if (!filepath) die(2, "filename required");
  const buf = await readFile(filepath);
  const ext = extname(filepath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".webp" ? "image/webp" : "image/png";
  const server = await getServer(args);
  const resp: any = await request(server.base, "/api/history/import-local", {
    method: "POST",
    body: buf,
    raw: true,
    headers: {
      "Content-Type": mime,
      "X-Ima2-Original-Filename": basename(filepath),
    },
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green("✓ imported as ") + (resp?.item?.filename || "(unknown)"));
}

const SUB: Record<string, (argv: any[]) => Promise<void>> = {
  rm: rmSub,
  restore: restoreSub,
  favorite: favoriteSub,
  import: importSub,
};

export default async function historyCmd(argv) {
  const sub = argv[0];
  if (!sub || sub === "--help" || sub === "-h") { out(HELP); return; }
  const handler = SUB[sub];
  if (!handler) die(2, `unknown subcommand: ${sub}\n${HELP}`);
  return handler(argv.slice(1));
}
