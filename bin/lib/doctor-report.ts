import { listProviders } from "../../lib/providers/registry.js";
import type { DoctorCheckLine } from "./doctor-checks.js";

type Evidence = "local" | "local-http" | "remote-auth";
export interface DoctorReport {
  schemaVersion: 1;
  version: string;
  mode: "standard" | "installation";
  checks: Array<{ code: string; kind: DoctorCheckLine["kind"]; lane?: string;
    evidence: Evidence; message: string; action?: string }>;
  summary: { passed: number; failed: number; warned: number; exitCode: 0 | 1 };
}

const REINSTALL = "Reinstall the same approved package version.";
const CODES: Record<string, { message: string; action?: string }> = {
  NODE_RUNTIME_OK: { message: "Node satisfies the package engine requirement." },
  NODE_RUNTIME_UNSUPPORTED: { message: "Node does not satisfy the package engine requirement.", action: "Install a Node version satisfying package.json engines.node." },
  ENGINE_REQUIREMENT_INVALID: { message: "The package Node engine requirement is invalid.", action: "Inspect package.json engines.node." },
  INSTALL_PACKAGE_OK: { message: "Package metadata is present." },
  INSTALL_PACKAGE_MISSING: { message: "Package metadata is missing or invalid.", action: REINSTALL },
  INSTALL_DEPENDENCIES_OK: { message: "Required runtime dependencies and CLI entries resolve." },
  INSTALL_DEPENDENCY_MISSING: { message: "A required runtime dependency or CLI entry is missing.", action: REINSTALL },
  INSTALL_NATIVE_OK: { message: "The in-memory SQLite native binding loads." },
  INSTALL_NATIVE_FAILED: { message: "The SQLite native binding could not load.", action: REINSTALL },
  INSTALL_SKILLS_OK: { message: "Packaged skills are present." },
  INSTALL_SKILL_MISSING: { message: "A packaged skill is missing.", action: REINSTALL },
  INSTALL_UI_OK: { message: "The packaged UI build is available." },
  INSTALL_UI_MISSING: { message: "The packaged UI build is missing.", action: REINSTALL },
  INSTALL_UI_STALE: { message: "The source checkout UI build is stale.", action: "Run the project UI build in the source checkout." },
  NPM_READY: { message: "The package manager is available." },
  NPM_MISSING: { message: "The package manager is unavailable.", action: "Install the required package manager." },
  NPM_OLD: { message: "The package manager is older than recommended.", action: "Update the package manager." },
  DB_PARENT_WRITABLE: { message: "The configured database parent is writable." },
  DB_PARENT_UNWRITABLE: { message: "The configured database parent is not writable.", action: "Check configured directory permissions." },
  CONFIG_PERMISSIONS: { message: "Configuration permissions allow other users to read it.", action: "Restrict access to the configuration file." },
  CONFIG_INVALID: { message: "Configuration is not a valid JSON object.", action: "Repair the configuration JSON object." },
  CONFIG_PRESENT: { message: "A provider configuration is present; execution is not verified." },
  CONFIG_MISSING: { message: "No provider configuration is selected.", action: "Run ima2 setup when ready to configure a provider." },
  ADVERTISEMENT_INVALID: { message: "The local server advertisement is invalid.", action: "Start the intended local server." },
  CREDENTIAL_PRESENT: { message: "A local credential is present; remote validity is not verified." },
  CREDENTIAL_MISSING: { message: "A local credential is not configured.", action: "Configure this provider lane when needed." },
  CREDENTIAL_SHAPE_INVALID: { message: "The configured credential has an invalid shape.", action: "Check this provider credential configuration." },
  OAUTH_FILE_READY: { message: "A file-backed OAuth session is available." },
  OAUTH_FILE_REQUIRED: { message: "A file-backed OAuth session is required.", action: "Run ima2 login yourself." },
  LOCAL_CLI_FOUND: { message: "The configured local CLI exists." },
  LOCAL_CLI_MISSING: { message: "The local CLI is not configured or missing.", action: "Check the configured executable." },
  LOCAL_ORIGIN_VALID: { message: "The configured local origin has a valid shape; reachability is not verified." },
  LOCAL_ORIGIN_INVALID: { message: "The configured local origin is invalid.", action: "Correct the configured local origin." },
  FFMPEG_READY: { message: "ffmpeg is available." },
  FFMPEG_MISSING: { message: "ffmpeg is not installed.", action: "Install ffmpeg for video tasks." },
  FFMPEG_PROBE_FAILED: { message: "The ffmpeg check failed.", action: "Check the ffmpeg installation." },
  AUTH_VERIFIED: { message: "The non-generating authentication endpoint accepted the credential." },
  AUTH_INVALID: { message: "The authentication endpoint rejected the credential.", action: "Sign in again or replace this provider credential." },
  AUTH_RATE_LIMITED: { message: "The authentication check was rate limited.", action: "Retry later; do not reset the credential for this result." },
  AUTH_UPSTREAM_FAILED: { message: "The authentication endpoint returned an upstream failure.", action: "Check provider status and retry later." },
  AUTH_NETWORK_FAILED: { message: "The authentication check could not complete.", action: "Inspect network connectivity and retry later." },
  AUTH_TIMEOUT: { message: "The authentication check timed out.", action: "Check connectivity and retry later." },
  RUNTIME_READY: { message: "The local server responded with the expected version; upstream generation is not verified." },
  RUNTIME_AUTH_REQUIRED: { message: "The local server requires authorization.", action: "Use the configured authorized client." },
  RUNTIME_VERSION_MISMATCH: { message: "The local server version differs from this CLI.", action: "Start the intended version of the server." },
  RUNTIME_UNREACHABLE: { message: "The requested local server could not be reached.", action: "Start the intended server and check its address." },
  RUNTIME_TIMEOUT: { message: "The local server health request timed out.", action: "Check the intended local server." },
  RUNTIME_INVALID_HEALTH: { message: "The local server returned an invalid health response.", action: "Verify that the endpoint belongs to ima2-gen." },
  RUNTIME_ORIGIN_INVALID: { message: "Runtime diagnostics require an explicit loopback origin without credentials.", action: "Use a loopback HTTP or HTTPS origin with no path, query or fragment." },
  PORT_AVAILABLE: { message: "The preferred local port is available." },
  PORT_IN_USE: { message: "The preferred local port is in use." },
  FEATURE_ENABLED: { message: "The optional feature is enabled." },
  FEATURE_DISABLED: { message: "The optional feature is disabled." },
  DIAGNOSTIC_UNKNOWN: { message: "A diagnostic returned an unrecognized result.", action: "Inspect this package version's diagnostic support." },
};

export function buildDoctorReport(input: { version: string; mode: DoctorReport["mode"]; lines: readonly DoctorCheckLine[] }): DoctorReport {
  const lanes = new Set<string>(listProviders().map((provider) => provider.id));
  const checks: DoctorReport["checks"] = input.lines.map((line) => {
    const known = Object.hasOwn(CODES, line.code), code = known ? line.code : "DIAGNOSTIC_UNKNOWN";
    const definition = CODES[code]!;
    const kind = known ? line.kind : line.kind === "fail" ? "fail" : "warn";
    const evidence: Evidence = line.evidence === "remote-auth" || line.evidence === "local-http" ? line.evidence : "local";
    return { code, kind, evidence, ...definition, ...(line.lane && lanes.has(line.lane) ? { lane: line.lane } : {}) };
  });
  const passed = checks.filter((line) => line.kind === "pass").length;
  const failed = checks.filter((line) => line.kind === "fail").length;
  const warned = checks.filter((line) => line.kind === "warn").length;
  return { schemaVersion: 1, version: input.version, mode: input.mode, checks,
    summary: { passed, failed, warned, exitCode: failed ? 1 : 0 } };
}

export function renderDoctorReport(report: DoctorReport): string {
  const checks = report.checks.map((line) => `[${line.kind}] ${line.lane ? line.lane + ": " : ""}${line.message}${line.action ? " Next: " + line.action : ""}`);
  return [`ima2-gen ${report.version} — ${report.mode} doctor`, ...checks,
    `${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warned} warnings`].join("\n");
}
