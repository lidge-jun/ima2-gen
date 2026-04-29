import { readFile, writeFile } from "fs/promises";
import { parseArgs } from "../lib/args.js";
import { resolveServer, request } from "../lib/client.js";
import { readStdin } from "../lib/files.js";
import { out, die, color, json, exitCodeForError, table } from "../lib/output.js";

const HELP = `
  ima2 prompt <subcommand> [options]

  Core:
    ls [--folder <id>] [--search <q>] [--favorites] [--json]
    show <id> [--json]
    create --text <t|@file|->  [--name <n>] [--folder <id>] [--tag <t>...] [--mode <m>]
    edit <id> [--name] [--text <t|@file|->] [--folder] [--tag <t>...] [--mode]
    rm <id> [--yes]
    favorite <id>
    export [-o <file>]                       Dump all non-trash prompts + folders

  Folders:
    folder ls
    folder create <name>
    folder rename <id> <name>
    folder rm <id> [--strategy move|delete] [--yes]

  Import:
    import sources                           List curated + discovery sources
    import refresh --source <id>             Refresh curated cache
    import curated --source <id> [-q <q>] [--limit <n>] [--folder <id>] [--dry-run]
    import discovery -q <q> --seed <repo>... [--limit <n>] [--folder <id>] [--dry-run]
    import folder <path> [--folder <id>] [--dry-run]

  Common options:
        --server <url>                       Override server URL
        --json                               JSON output
        --yes                                Skip destructive confirmation
`;

const COMMON_FLAGS = {
  json: { type: "boolean" },
  server: { type: "string" },
  yes: { type: "boolean" },
  out: { short: "o", type: "string" },
  text: { type: "string" },
  name: { type: "string" },
  folder: { type: "string" },
  tag: { type: "string", repeatable: true },
  mode: { type: "string" },
  search: { type: "string" },
  favorites: { type: "boolean" },
  source: { type: "string" },
  q: { short: "q", type: "string" },
  query: { type: "string" },
  seed: { type: "string", repeatable: true },
  limit: { type: "string" },
  strategy: { type: "string" },
  "dry-run": { type: "boolean" },
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

async function resolveText(value): Promise<string | null> {
  if (!value) return null;
  if (value === "-") return await readStdin();
  if (value.startsWith("@")) return await readFile(value.slice(1), "utf-8");
  return value;
}

// ---------- core ----------

async function lsSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const server = await getServer(args);
  const qs = new URLSearchParams();
  if (args.folder) qs.set("folderId", args.folder);
  if (args.search) qs.set("search", args.search);
  if (args.favorites) qs.set("favoritesOnly", "1");
  const path = qs.toString() ? `/api/prompts?${qs.toString()}` : "/api/prompts";
  const resp: any = await request(server.base, path).catch(handle);
  const prompts = resp.prompts || resp.items || [];
  if (args.json) { json({ prompts }); return; }
  if (prompts.length === 0) { out(color.dim("(no prompts)")); return; }
  table(prompts, [
    { key: "id", label: "ID" },
    { key: "name", label: "NAME" },
    { key: "folder_id", label: "FOLDER" },
    { key: "is_favorite", label: "★", format: (v) => v ? "★" : "" },
    { key: "text", label: "TEXT", format: (v) => {
      const s = String(v || "").replace(/\s+/g, " ");
      return s.length > 48 ? s.slice(0, 45) + "…" : s;
    } },
  ]);
}

async function showSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const id = args.positional[0];
  if (!id) die(2, "prompt id required");
  const server = await getServer(args);
  const resp = await request(server.base, `/api/prompts/${encodeURIComponent(id)}`).catch(handle);
  json(resp);
}

async function createSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const text = await resolveText(args.text);
  if (!text) die(2, "--text <value|@file|-> required");
  const body: any = { text };
  if (args.name) body.name = args.name;
  if (args.folder) body.folderId = args.folder;
  if (args.tag?.length) body.tags = args.tag;
  if (args.mode) body.mode = args.mode;
  const server = await getServer(args);
  const resp = await request(server.base, "/api/prompts", { method: "POST", body }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green("✓ ") + ((resp as any).id || (resp as any).prompt?.id || "(no id)"));
}

async function editSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const id = args.positional[0];
  if (!id) die(2, "prompt id required");
  const body: any = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.text !== undefined) body.text = await resolveText(args.text);
  if (args.folder !== undefined) body.folderId = args.folder;
  if (args.tag?.length) body.tags = args.tag;
  if (args.mode !== undefined) body.mode = args.mode;
  if (Object.keys(body).length === 0) die(2, "no fields to update");
  const server = await getServer(args);
  const resp = await request(server.base, `/api/prompts/${encodeURIComponent(id)}`, {
    method: "PATCH", body,
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green("✓ updated"));
}

async function rmSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const id = args.positional[0];
  if (!id) die(2, "prompt id required");
  if (!args.yes && !process.stdin.isTTY) die(2, "destructive: pass --yes for non-TTY");
  if (!args.yes) {
    process.stdout.write(`Delete prompt ${id}? [y/N] `);
    const ans = await readLine();
    if (!/^y(es)?$/i.test(ans.trim())) { out("(canceled)"); return; }
  }
  const server = await getServer(args);
  await request(server.base, `/api/prompts/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(handle);
  out(color.green("✓ deleted"));
}

async function favoriteSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const id = args.positional[0];
  if (!id) die(2, "prompt id required");
  const server = await getServer(args);
  const resp: any = await request(server.base, `/api/prompts/${encodeURIComponent(id)}/favorite`, {
    method: "POST",
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green(resp?.isFavorite ? "✓ favorited" : "✓ unfavorited"));
}

async function exportSub(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const server = await getServer(args);
  const resp = await request(server.base, "/api/prompts/export").catch(handle);
  const text = JSON.stringify(resp, null, 2);
  if (args.out) {
    await writeFile(args.out, text);
    out(color.green("✓ ") + args.out);
  } else {
    process.stdout.write(text + "\n");
  }
}

// ---------- folders ----------

async function folderSub(argv) {
  const action = argv[0];
  const rest = argv.slice(1);
  if (action === "ls") return folderLs(rest);
  if (action === "create") return folderCreate(rest);
  if (action === "rename") return folderRename(rest);
  if (action === "rm") return folderRm(rest);
  die(2, "usage: prompt folder <ls|create|rename|rm> ...");
}

async function folderLs(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const server = await getServer(args);
  const resp: any = await request(server.base, "/api/prompts/folders").catch(handle);
  const folders = resp.folders || resp.items || [];
  if (args.json) { json({ folders }); return; }
  if (folders.length === 0) { out(color.dim("(no folders)")); return; }
  table(folders, [
    { key: "id", label: "ID" },
    { key: "name", label: "NAME" },
  ]);
}

async function folderCreate(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const name = args.positional.join(" ").trim();
  if (!name) die(2, "folder name required");
  const server = await getServer(args);
  const resp = await request(server.base, "/api/prompts/folders", {
    method: "POST", body: { name },
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green("✓ ") + ((resp as any).id || (resp as any).folder?.id || "(no id)"));
}

async function folderRename(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const [id, ...rest] = args.positional;
  const name = rest.join(" ").trim();
  if (!id || !name) die(2, "usage: prompt folder rename <id> <name>");
  const server = await getServer(args);
  await request(server.base, `/api/prompts/folders/${encodeURIComponent(id)}`, {
    method: "PATCH", body: { name },
  }).catch(handle);
  out(color.green("✓ renamed"));
}

async function folderRm(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const id = args.positional[0];
  if (!id) die(2, "folder id required");
  if (!args.yes && !process.stdin.isTTY) die(2, "destructive: pass --yes for non-TTY");
  if (!args.yes) {
    process.stdout.write(`Delete folder ${id}? [y/N] `);
    const ans = await readLine();
    if (!/^y(es)?$/i.test(ans.trim())) { out("(canceled)"); return; }
  }
  // CLI alias: --strategy delete → server's deleteItems; default → moveToRoot
  const cliStrategy = (args.strategy || "").toLowerCase();
  const serverStrategy = cliStrategy === "delete" || cliStrategy === "deleteitems"
    ? "deleteItems"
    : "moveToRoot";
  const server = await getServer(args);
  await request(server.base,
    `/api/prompts/folders/${encodeURIComponent(id)}?strategy=${serverStrategy}`,
    { method: "DELETE" },
  ).catch(handle);
  out(color.green(`✓ deleted (strategy: ${serverStrategy})`));
}

// ---------- import ----------

async function importSub(argv) {
  const action = argv[0];
  const rest = argv.slice(1);
  if (action === "sources") return importSources(rest);
  if (action === "refresh") return importRefresh(rest);
  if (action === "curated") return importCurated(rest);
  if (action === "discovery") return importDiscovery(rest);
  if (action === "folder") return importFolder(rest);
  die(2, "usage: prompt import <sources|refresh|curated|discovery|folder> ...");
}

async function importSources(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const server = await getServer(args);
  const [curated, discovery] = await Promise.all([
    request(server.base, "/api/prompts/import/curated-sources").catch(() => ({})),
    request(server.base, "/api/prompts/import/discovery").catch(() => ({})),
  ]);
  if (args.json) { json({ curated, discovery }); return; }
  out(color.bold("Curated sources:"));
  out(JSON.stringify(curated, null, 2));
  out("");
  out(color.bold("Discovery candidates:"));
  out(JSON.stringify(discovery, null, 2));
}

async function importRefresh(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  if (!args.source) die(2, "--source <id> required");
  const server = await getServer(args);
  const resp = await request(server.base, "/api/prompts/import/curated-refresh", {
    method: "POST", body: { sourceId: args.source },
  }).catch(handle);
  if (args.json) { json(resp); return; }
  out(color.green("✓ refreshed"));
}

async function importCurated(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  if (!args.source) die(2, "--source <id> required (run `prompt import sources`)");
  const server = await getServer(args);
  const limit = args.limit ? parseInt(args.limit) : undefined;
  const search: any = await request(server.base, "/api/prompts/import/curated-search", {
    method: "POST",
    body: {
      q: args.q || args.query || "",
      sourceIds: [args.source],
      ...(limit ? { limit } : {}),
    },
  }, ).catch(handle);
  const candidates = search.candidates || [];
  if (candidates.length === 0) { out(color.dim("(no candidates)")); return; }
  out(`${candidates.length} candidates`);
  if (args["dry-run"]) { json({ candidates }); return; }
  const commit: any = await request(server.base, "/api/prompts/import/commit", {
    method: "POST",
    body: { candidates, ...(args.folder ? { folderId: args.folder } : {}) },
  }).catch(handle);
  if (args.json) { json(commit); return; }
  out(color.green(`✓ imported ${commit.imported || candidates.length}`));
}

async function importDiscovery(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const q = args.q || args.query;
  if (!q) die(2, "-q <query> required for discovery import");
  const seeds = args.seed || [];
  if (!seeds.length) die(2, "--seed <repo>... required (at least 1)");
  const server = await getServer(args);
  const limit = args.limit ? parseInt(args.limit) : undefined;
  const search: any = await request(server.base, "/api/prompts/import/discovery-search", {
    method: "POST",
    body: { q, seeds, ...(limit ? { limit } : {}) },
    timeoutMs: 120_000,
  }).catch(handle);
  const candidates = search.candidates || [];
  if (candidates.length === 0) { out(color.dim("(no candidates)")); return; }
  out(`${candidates.length} candidates`);
  if (args["dry-run"]) { json({ candidates }); return; }
  const commit: any = await request(server.base, "/api/prompts/import/commit", {
    method: "POST",
    body: { candidates, ...(args.folder ? { folderId: args.folder } : {}) },
  }).catch(handle);
  if (args.json) { json(commit); return; }
  out(color.green(`✓ imported ${commit.imported || candidates.length}`));
}

async function importFolder(argv) {
  const args = parseArgs(argv, { flags: COMMON_FLAGS });
  const path = args.positional[0];
  if (!path) die(2, "usage: prompt import folder <path>");
  const server = await getServer(args);
  // Folder import body shapes are opaque (handled by buildFolderFiles/buildFolderPreview helpers).
  // Conservative attempt: send { source: { input: <path> } } and { paths } chains; surface server errors verbatim.
  const filesResp: any = await request(server.base, "/api/prompts/import/folder-files", {
    method: "POST",
    body: { source: { input: path }, input: path },
  }).catch(handle);
  const previewResp: any = await request(server.base, "/api/prompts/import/folder-preview", {
    method: "POST",
    body: {
      source: { input: path }, input: path,
      files: filesResp.files,
      paths: (filesResp.files || []).map((f) => f.path).filter(Boolean),
    },
  }).catch(handle);
  const candidates = previewResp.candidates || [];
  if (candidates.length === 0) { out(color.dim("(no candidates)")); return; }
  if (candidates.length > 100 && !args["dry-run"]) {
    if (!process.stdin.isTTY && !args.yes) die(2, `${candidates.length} candidates: pass --yes for non-TTY`);
    if (process.stdin.isTTY && !args.yes) {
      process.stdout.write(`Import ${candidates.length} prompts? [y/N] `);
      const ans = await readLine();
      if (!/^y(es)?$/i.test(ans.trim())) { out("(canceled)"); return; }
    }
  }
  out(`${candidates.length} candidates`);
  if (args["dry-run"]) { json({ candidates }); return; }
  const commit: any = await request(server.base, "/api/prompts/import/commit", {
    method: "POST",
    body: { candidates, ...(args.folder ? { folderId: args.folder } : {}) },
  }).catch(handle);
  if (args.json) { json(commit); return; }
  out(color.green(`✓ imported ${commit.imported || candidates.length}`));
}

const SUB: Record<string, (argv: any[]) => Promise<void>> = {
  ls: lsSub,
  show: showSub,
  create: createSub,
  edit: editSub,
  rm: rmSub,
  favorite: favoriteSub,
  export: exportSub,
  folder: folderSub,
  import: importSub,
};

export default async function promptCmd(argv) {
  const sub = argv[0];
  if (!sub || sub === "--help" || sub === "-h") { out(HELP); return; }
  const handler = SUB[sub];
  if (!handler) die(2, `unknown subcommand: ${sub}\n${HELP}`);
  return handler(argv.slice(1));
}
