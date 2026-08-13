import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, cpSync } from "fs";
import { dirname, join, relative, basename, extname, resolve } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { parseArgs } from "../lib/args.js";
import { die, json, out } from "../lib/output.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS_DIR = join(ROOT, "skills");
const PACKAGE_PATH = join(ROOT, "package.json");

const KNOWN_SKILLS: Record<string, { dir: string; description: string }> = {
  ima2: {
    dir: "ima2",
    description: "Core CLI reference, prompting protocol, provider routing",
  },
  front: {
    dir: "ima2-front",
    description: "Frontend implementation: assets, motion, responsive, a11y, anti-slop",
  },
  uiux: {
    dir: "ima2-uiux",
    description: "Design direction discovery, UX judgment, image-first ism workflow",
  },
};

const HELP = `
  ima2 skill [<name>] [path|refs|ref <name>|install] [--json]

  Print packaged ima2 Markdown skills and reference modules for agents.
  Each skill ships a SKILL.md + a references/ directory. Reference modules
  are loaded by agents via relative paths from the SKILL.md.

  Commands:
    ima2 skill              Print skills/ima2/SKILL.md (core)
    ima2 skill front        Print skills/ima2-front/SKILL.md (frontend)
    ima2 skill uiux         Print skills/ima2-uiux/SKILL.md (design)
    ima2 skill ls            List all available skills
    ima2 skill <name> path   Print skill file path

  Install to agent skill directory:
    ima2 skill install --dir <path>          Copy all skills to <path>/
    ima2 skill install front --dir <path>    Copy only the frontend skill
    ima2 skill install uiux --dir <path>     Copy only the design skill
    ima2 skill install --tmp                 Copy to $TMPDIR/ima2-skills/ (ephemeral)
    ima2 skill install front --tmp           Copy one skill to temp dir

    Each skill is a directory (e.g. <path>/ima2-front/) with SKILL.md +
    references/. The agent determines its own skill path and passes --dir.
    Use --tmp when no persistent path is available.

  Reference modules (ad-hoc, without install):
    ima2 skill <name> refs          List reference modules for a skill
    ima2 skill <name> ref <name>    Print one reference module

  Examples:
    ima2 skill install --dir ~/.codex/skills        Install all skills
    ima2 skill install front --dir ~/.codex/skills   Install frontend only
    ima2 skill install --tmp                         Install to temp dir
    ima2 skill front refs                            List frontend references
    ima2 skill front ref motion                      Print references/motion.md
    ima2 skill uiux ref design-isms                  Print references/design-isms.md

  Agent integration:
    The agent is responsible for resolving its own skill directory path.
    Pass that path to --dir. After install, the agent reads SKILL.md and
    follows references/ paths natively — no stdout piping needed.

  Options:
    --json         Print JSON wrapper
    --dir <path>   Target directory for install
    --tmp          Use $TMPDIR/ima2-skills/ as target
    -h, --help     Show help
`;

const FLAGS = {
  json: { type: "boolean" },
  help: { short: "h", type: "boolean" },
  "with-refs": { type: "boolean" },
  dir: { type: "string" },
  tmp: { type: "boolean" },
};

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf-8")) as { version?: string };
    return pkg.version || "?";
  } catch {
    return "?";
  }
}

function resolveSkillPath(name: string): string {
  const entry = KNOWN_SKILLS[name];
  if (!entry) die(2, `unknown skill: "${name}". Available: ${Object.keys(KNOWN_SKILLS).join(", ")}`);
  return join(SKILLS_DIR, entry.dir, "SKILL.md");
}

function readSkill(path: string): string {
  if (!existsSync(path)) {
    die(5, `packaged skill not found: ${path}`);
  }
  return readFileSync(path, "utf-8");
}

// ── Reference discovery helpers ──

interface RefEntry {
  name: string;
  file: string;
  relPath: string;
  absPath: string;
  lines: number;
}

function discoverRefs(skillDir: string): RefEntry[] {
  const refsDir = join(skillDir, "references");
  if (!existsSync(refsDir)) return [];
  const entries: RefEntry[] = [];

  function walk(dir: string, prefix: string) {
    for (const item of readdirSync(dir)) {
      const full = join(dir, item);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full, prefix ? `${prefix}/${item}` : item);
      } else if (extname(item) === ".md") {
        const nameNoExt = basename(item, ".md");
        const qualName = prefix ? `${prefix}/${nameNoExt}` : nameNoExt;
        const relFile = prefix ? `${prefix}/${item}` : item;
        entries.push({
          name: qualName,
          file: relFile,
          relPath: `references/${relFile}`,
          absPath: full,
          lines: readFileSync(full, "utf-8").split("\n").length,
        });
      }
    }
  }

  walk(refsDir, "");
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveRef(skillDir: string, refName: string): RefEntry | null {
  const refs = discoverRefs(skillDir);
  const exact = refs.find((r) => r.name === refName);
  if (exact) return exact;
  const byBase = refs.filter((r) => {
    const parts = r.name.split("/");
    const last = parts[parts.length - 1];
    return last === refName;
  });
  if (byBase.length === 1) return byBase[0] ?? null;
  const partial = refs.filter((r) => r.name.includes(refName));
  if (partial.length === 1) return partial[0] ?? null;
  return null;
}

// ── Install helpers ──

function copySkillDir(srcDir: string, destDir: string): { files: number } {
  mkdirSync(destDir, { recursive: true });
  cpSync(srcDir, destDir, { recursive: true });
  // Count files copied
  let count = 0;
  function countFiles(dir: string) {
    for (const item of readdirSync(dir)) {
      const full = join(dir, item);
      if (statSync(full).isDirectory()) countFiles(full);
      else count++;
    }
  }
  countFiles(destDir);
  return { files: count };
}

function resolveInstallDir(args: Record<string, unknown>): string | null {
  if (args.dir) return resolve(String(args.dir));
  if (args.tmp) return join(tmpdir(), "ima2-skills");
  return null;
}

function installSkills(targetBase: string, only: string[] | null, asJson: boolean) {
  const results: Array<{ name: string; dir: string; dest: string; files: number }> = [];

  for (const [name, info] of Object.entries(KNOWN_SKILLS)) {
    if (only && !only.includes(name)) continue;
    const srcDir = join(SKILLS_DIR, info.dir);
    if (!existsSync(join(srcDir, "SKILL.md"))) continue;
    const destDir = join(targetBase, info.dir);
    const { files } = copySkillDir(srcDir, destDir);
    results.push({ name, dir: info.dir, dest: destDir, files });
  }

  if (results.length === 0 && only) {
    die(2, `unknown skill: "${only.join(", ")}". Available: ${Object.keys(KNOWN_SKILLS).join(", ")}`);
  }

  if (asJson) {
    json({
      installed: results.map((r) => ({
        name: r.name,
        dir: r.dir,
        path: r.dest,
        files: r.files,
      })),
      target: targetBase,
    });
  } else {
    out(`\n  Installed ${results.length} ima2 skill${results.length === 1 ? "" : "s"} to ${targetBase}\n`);
    for (const r of results) {
      out(`    ✓  ${r.dir.padEnd(12)} ${r.files} files → ${r.dest}`);
    }
    out(`\n  Agents can now read SKILL.md + references/ via filesystem paths.\n`);
  }
}

// ── Main command ──

export default async function skillCmd(argv: string[]) {
  const args = parseArgs(argv, { flags: FLAGS });
  if (args.help) {
    out(HELP);
    return;
  }

  const positional = args.positional as string[];

  // ima2 skill install — copy skills to filesystem
  if (positional[0] === "install") {
    const targetBase = resolveInstallDir(args);
    if (!targetBase) {
      die(2, "specify --dir <path> or --tmp. The agent determines its own skill directory path.\n\n  Examples:\n    ima2 skill install --dir ~/.codex/skills\n    ima2 skill install front --dir ./skills\n    ima2 skill install --tmp");
    }
    // Collect optional skill names after "install"
    const installNames = positional.slice(1).filter((p) => KNOWN_SKILLS[p]);
    installSkills(targetBase, installNames.length > 0 ? installNames : null, !!args.json);
    return;
  }

  // ima2 skill ls — list available skills
  if (positional[0] === "ls" || positional[0] === "list") {
    if (args.json) {
      const skills = Object.entries(KNOWN_SKILLS).map(([name, info]) => {
        const skillPath = join(SKILLS_DIR, info.dir, "SKILL.md");
        return {
          name,
          dir: info.dir,
          description: info.description,
          path: relative(ROOT, skillPath),
          installed: existsSync(skillPath),
        };
      });
      json({ skills });
    } else {
      out("\n  Available ima2 skills:\n");
      for (const [name, info] of Object.entries(KNOWN_SKILLS)) {
        const skillPath = join(SKILLS_DIR, info.dir, "SKILL.md");
        const status = existsSync(skillPath) ? "✓" : "✗";
        out(`    ${status}  ${name.padEnd(8)} ${info.description}`);
      }
      out(`\n  Usage: ima2 skill <name>         Print a skill`);
      out(`         ima2 skill <name> path     Print its file path`);
      out(`         ima2 skill <name> refs     List reference modules`);
      out(`         ima2 skill install [<name>] --dir <path>\n`);
    }
    return;
  }

  // Determine which skill to read
  let skillName = "ima2";
  let wantPath = false;
  let wantRefs = false;
  let wantRef: string | null = null;

  const firstPos = positional[0];
  if (positional.length > 0 && firstPos && firstPos !== "path" && firstPos !== "refs" && firstPos !== "ref" && KNOWN_SKILLS[firstPos]) {
    skillName = firstPos;
    if (positional[1] === "path") wantPath = true;
    else if (positional[1] === "refs") wantRefs = true;
    else if (positional[1] === "ref" && positional[2]) wantRef = positional.slice(2).join("/");
  } else if (positional[0] === "path") {
    wantPath = true;
  } else if (positional[0] === "refs") {
    wantRefs = true;
  } else if (positional[0] === "ref" && positional[1]) {
    wantRef = positional.slice(1).join("/");
  }

  const targetPath = resolveSkillPath(skillName);

  if (wantPath) {
    out(targetPath);
    return;
  }

  const skillDir = dirname(targetPath);

  // ima2 skill <name> refs — list reference modules
  if (wantRefs) {
    const refs = discoverRefs(skillDir);
    if (refs.length === 0) {
      if (args.json) {
        json({ skill: skillName, refs: [] });
      } else {
        out(`\n  No reference modules for skill "${skillName}".\n`);
      }
      return;
    }
    if (args.json) {
      json({
        skill: skillName,
        refs: refs.map((r) => ({
          name: r.name,
          file: r.relPath,
          lines: r.lines,
        })),
      });
    } else {
      out(`\n  Reference modules for "${skillName}" (${refs.length} files):\n`);
      for (const r of refs) {
        out(`    ${r.name.padEnd(30)} ${String(r.lines).padStart(4)} lines`);
      }
      out(`\n  Load one:  ima2 skill ${skillName} ref <name>`);
      out(`  Install:   ima2 skill install ${skillName} --dir <path>\n`);
    }
    return;
  }

  // ima2 skill <name> ref <refname> — print one reference module
  if (wantRef) {
    const ref = resolveRef(skillDir, wantRef);
    if (!ref) {
      const refs = discoverRefs(skillDir);
      const available = refs.map((r) => r.name).join(", ");
      die(2, `reference "${wantRef}" not found in skill "${skillName}". Available: ${available}`);
    }
    const content = readFileSync(ref.absPath, "utf-8");
    if (args.json) {
      json({
        skill: skillName,
        ref: ref.name,
        file: ref.relPath,
        lines: ref.lines,
        content,
      });
    } else {
      out(content.replace(/\n$/, ""));
    }
    return;
  }

  // --with-refs: bundle SKILL.md + all reference modules (hidden, discouraged)
  if (args["with-refs"]) {
    const content = readSkill(targetPath);
    // Inline bundle — kept for backward compat but not recommended
    const refs = discoverRefs(skillDir);
    let bundled = content.replace(/\n$/, "");
    if (refs.length > 0) {
      bundled += "\n\n---\n\n# Bundled Reference Modules\n";
      for (const ref of refs) {
        const rc = readFileSync(ref.absPath, "utf-8").replace(/\n$/, "");
        bundled += `\n## [ref: ${ref.name}] (${ref.relPath})\n\n${rc}\n`;
      }
    }
    process.stderr.write("  hint: prefer 'ima2 skill install --dir <path>' — agents read references natively from disk.\n");
    if (args.json) {
      json({
        name: skillName === "ima2" ? "ima2" : `ima2-${skillName}`,
        format: "markdown-skill-bundled",
        formatVersion: "1",
        packageVersion: readPackageVersion(),
        path: relative(ROOT, targetPath),
        refCount: discoverRefs(skillDir).length,
        source: "package",
        content: bundled,
      });
    } else {
      out(bundled.replace(/\n$/, ""));
    }
    return;
  }

  const content = readSkill(targetPath);
  if (args.json) {
    json({
      name: skillName === "ima2" ? "ima2" : `ima2-${skillName}`,
      format: "markdown-skill",
      formatVersion: "1",
      packageVersion: readPackageVersion(),
      path: relative(ROOT, targetPath),
      source: "package",
      content,
    });
    return;
  }

  out(content.replace(/\n$/, ""));
}
