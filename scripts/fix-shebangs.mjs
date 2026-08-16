#!/usr/bin/env node
// Restore #!/usr/bin/env node shebang and the exec bit on emitted bin/*.js after tsc.
import { chmodSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SHEBANG = "#!/usr/bin/env node\n";
const BIN_DIR = "bin";
const ENTRY = join(BIN_DIR, "ima2.js");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = walk(BIN_DIR);
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // Only restore on entry files that originally had the shebang.
  // tsc strips it, and also emits mode 0644, which breaks the global bin symlink.
  if (f !== ENTRY) continue;
  if (!src.startsWith("#!")) {
    writeFileSync(f, SHEBANG + src);
    console.log(`shebang restored: ${f}`);
  }
  try {
    chmodSync(f, 0o755);
    console.log(`exec bit ensured: ${f}`);
  } catch (err) {
    console.warn(`failed to chmod ${f}: ${err?.message ?? err}`);
  }
}
