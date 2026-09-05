import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { inventoryUiSourceInputs } from "../../scripts/lib/uiBuildReceipt.mjs";

const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const inside = (path, root) => path === root || path.startsWith(root + sep);
const textInput = /\.(?:html|[cm]?[jt]sx?|json|mdx?|vue|svelte|astro)$/i;
const entryImport = /^\s*@import\s+["']tailwindcss["'];/;

/** Strict fixture build only; ordinary Vite/Tailwind behavior is unchanged. */
export function fixtureTailwindSources() {
  let uiRoot, repoRoot, entry, sources = "", transformed = false;
  const inputs = new Set(), dependencyRoots = [];
  return {
    name: "ima2-fixture-tailwind-sources", enforce: "pre", apply: "build",
    async configResolved(config) {
      if (process.env.IMA2_UI_RECEIPT_BUILD !== "1" || config.mode !== "production") fail("UI_RECEIPT_OPTIONS");
      uiRoot = await realpath(config.root); repoRoot = dirname(uiRoot);
      if (uiRoot !== resolve(repoRoot, "ui")) fail("UI_RECEIPT_PATH");
      entry = resolve(uiRoot, "src/index.css");
      for (const directory of [resolve(repoRoot, "node_modules"), resolve(uiRoot, "node_modules")]) {
        const metadata = await lstat(directory);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail("UI_RECEIPT_PATH");
        dependencyRoots.push(await realpath(directory));
      }
    },
    async buildStart() {
      const files = await inventoryUiSourceInputs(repoRoot);
      const directives = [];
      for (const file of files) {
        const absolute = resolve(repoRoot, file.path); inputs.add(absolute);
        if (file.path.endsWith(".css")) {
          const content = await readFile(absolute, "utf8");
          if (/@(?:source|config|plugin)\b/.test(content)) fail("UI_RECEIPT_TAILWIND_SOURCE");
          if (absolute === entry) {
            if (!entryImport.test(content) || /tailwindcss/.test(content.replace(entryImport, ""))) fail("UI_RECEIPT_TAILWIND_SOURCE");
          } else if (/tailwindcss/.test(content)) fail("UI_RECEIPT_TAILWIND_SOURCE");
        }
        if ((/^ui\/(?:src|public|dev|e2e)\//.test(file.path) || file.path === "ui/index.html") && textInput.test(file.path)) {
          const path = relative(dirname(entry), absolute).split(sep).join("/");
          if (/[!*?{}\[\]\\\x00-\x1f]/.test(path)) fail("UI_RECEIPT_SOURCE_PATTERN");
          directives.push(`@source ${JSON.stringify(path.startsWith(".") ? path : `./${path}`)};`);
        }
      }
      if (!inputs.has(entry)) fail("UI_RECEIPT_TAILWIND_SOURCE");
      sources = directives.join("\n");
    },
    transform(code, id) {
      if (resolve(id.split("?")[0]) !== entry) return null;
      if (!entryImport.test(code)) fail("UI_RECEIPT_TAILWIND_SOURCE");
      transformed = true;
      return { code: code.replace(entryImport, `@import "tailwindcss" source(none);\n${sources}`), map: null };
    },
    async generateBundle() {
      if (!transformed) fail("UI_RECEIPT_TAILWIND_SOURCE");
      for (const id of this.getWatchFiles()) {
        // Rollup virtual modules are not filesystem inputs. Real paths never use this marker.
        if (id.startsWith("\0")) continue;
        const path = isAbsolute(id) ? id.split("?")[0] : resolve(uiRoot, id.split("?")[0]);
        let canonical, metadata;
        try { canonical = await realpath(path); metadata = await lstat(path); }
        catch { fail("UI_RECEIPT_DEPENDENCY"); }
        if (dependencyRoots.some((root) => inside(canonical, root))) continue;
        if (metadata.isDirectory() && [...inputs].some((input) => inside(input, canonical))) continue;
        if (metadata.isSymbolicLink() || !metadata.isFile() || !inputs.has(canonical)) fail("UI_RECEIPT_DEPENDENCY");
      }
    },
  };
}
