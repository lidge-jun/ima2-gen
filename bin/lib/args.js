// Tiny argv parser — no dependencies.
// Supports: --long, --long=val, --long val, -s, -s val, repeatable flags, positional, --.

export function parseArgs(argv, spec = {}) {
  const shortMap = {};
  for (const [name, def] of Object.entries(spec.flags || {})) {
    if (def.short) shortMap[def.short] = name;
  }

  const out = { positional: [], _unknown: [] };
  for (const [name, def] of Object.entries(spec.flags || {})) {
    if (def.repeatable) out[name] = [];
    else if ("default" in def) out[name] = def.default;
  }

  let i = 0;
  let doubleDashSeen = false;
  while (i < argv.length) {
    const a = argv[i];
    if (doubleDashSeen) {
      out.positional.push(a);
      i++;
      continue;
    }
    if (a === "--") {
      doubleDashSeen = true;
      i++;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq > -1 ? a.slice(2, eq) : a.slice(2);
      const def = (spec.flags || {})[name];
      if (!def) {
        out._unknown.push(a);
        i++;
        continue;
      }
      if (def.type === "boolean") {
        out[name] = true;
        i++;
      } else {
        const val = eq > -1 ? a.slice(eq + 1) : argv[i + 1];
        if (eq === -1) i++;
        if (def.repeatable) out[name].push(val);
        else out[name] = val;
        i++;
      }
    } else if (a.startsWith("-") && a.length > 1 && !/^-\d/.test(a)) {
      const short = a.slice(1);
      const name = shortMap[short];
      if (!name) {
        out._unknown.push(a);
        i++;
        continue;
      }
      const def = spec.flags[name];
      if (def.type === "boolean") {
        out[name] = true;
        i++;
      } else {
        const val = argv[i + 1];
        if (def.repeatable) out[name].push(val);
        else out[name] = val;
        i += 2;
      }
    } else {
      out.positional.push(a);
      i++;
    }
  }
  return out;
}
