import { createServer } from "net";
import { accessSync, constants, existsSync, statSync } from "fs";
import { execFileSync } from "child_process";
import { dirname } from "path";
import { config as runtimeConfig } from "../../config.js";
import { isSensitiveConfigKey } from "../../lib/configKeys.js";
import { checkNativeBinding, checkPackagedSkills } from "./doctor-runtime.js";

export type DoctorCheckLine = {
  code: string;
  kind: "pass" | "fail" | "warn" | "info";
  text: string;
  lane?: string;
  evidence?: "local" | "local-http" | "remote-auth";
};

function hasSensitiveValue(value: unknown, path = ""): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (isSensitiveConfigKey(nextPath) && nested) return true;
    if (hasSensitiveValue(nested, nextPath)) return true;
  }
  return false;
}

async function probePort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}


function probeNpmVersion(): DoctorCheckLine {
  try {
    const raw = execFileSync("npm", ["-v"], { encoding: "utf8", timeout: 4000 }).trim();
    const major = Number.parseInt(raw.split(".")[0] || "", 10);
    if (Number.isFinite(major) && major >= 9) return { code: "NPM_READY", kind: "pass", text: `npm ${raw} (>= 9)` };
    return { code: "NPM_OLD", kind: "warn", text: `npm ${raw} (recommend >= 9)` };
  } catch {
    return { code: "NPM_MISSING", kind: "warn", text: "npm not found on PATH" };
  }
}

function probeDbPathWritable(dbPath: string): DoctorCheckLine {
  try {
    accessSync(dirname(dbPath), constants.W_OK);
    return { code: "DB_PARENT_WRITABLE", kind: "pass", text: `dbPath writable: ${dbPath}` };
  } catch {
    return { code: "DB_PARENT_UNWRITABLE", kind: "fail", text: `dbPath not writable: ${dbPath}` };
  }
}

function configPermissionLine(configFile: string, fileConfig: unknown): DoctorCheckLine | null {
  if (process.platform === "win32" || !existsSync(configFile) || !hasSensitiveValue(fileConfig)) {
    return null;
  }
  const mode = statSync(configFile).mode;
  if ((mode & 0o077) === 0) return null;
  return {
    code: "CONFIG_PERMISSIONS",
    kind: "warn",
    text: `${configFile} is readable by group/other; consider chmod 600`,
  };
}

export async function buildHardeningDoctorLines({
  root,
  configFile,
  fileConfig,
  includeInstallationChecks = true,
}: {
  root: string;
  configFile: string;
  fileConfig: unknown;
  includeInstallationChecks?: boolean;
}): Promise<DoctorCheckLine[]> {
  const lines: DoctorCheckLine[] = [];
  const portAvailable = await probePort(runtimeConfig.server.host, runtimeConfig.server.port);
  lines.push({
    code: portAvailable ? "PORT_AVAILABLE" : "PORT_IN_USE",
    kind: "info",
    text: `Preferred backend port ${runtimeConfig.server.port}: ${portAvailable ? "available" : "in use"}`,
  });
  lines.push({
    code: runtimeConfig.features.cardNews ? "FEATURE_ENABLED" : "FEATURE_DISABLED",
    kind: "info",
    text: `Card News: ${runtimeConfig.features.cardNews ? "enabled" : "disabled"}`,
  });

  if (includeInstallationChecks) lines.push(...checkPackagedSkills(root), checkNativeBinding(root));
  lines.push(probeNpmVersion());
  lines.push(probeDbPathWritable(runtimeConfig.storage.dbPath));

  const perm = configPermissionLine(configFile, fileConfig);
  if (perm) lines.push(perm);
  return lines;
}
