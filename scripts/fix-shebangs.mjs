#!/usr/bin/env node
// Restore #!/usr/bin/env node shebang on emitted bin/*.js after tsc.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SHEBANG = "#!/usr/bin/env node\n";
const BIN_DIR = "bin";

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
  if (src.startsWith("#!")) continue;
  // Only restore on entry files that originally had the shebang
  // We'll restore on bin/ima2.js specifically; tsc strips it.
  if (f === join("bin", "ima2.js")) {
    writeFileSync(f, SHEBANG + src);
    console.log(`shebang restored: ${f}`);
  }
}
