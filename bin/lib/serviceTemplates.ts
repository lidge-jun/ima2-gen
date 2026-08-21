/**
 * Pure renderers for background-service artifacts. Kept free of process/fs so
 * contract tests can snapshot them (adversarial audit 260821c: PATH must be
 * baked — launchd/systemd hand jobs a minimal environment and the grok/oauth
 *  proxies spawn bare binaries that silently die without the user's PATH).
 */

export const LAUNCHD_LABEL = "com.ima2.server";
export const SYSTEMD_UNIT = "ima2.service";

export interface ServiceRenderInput {
  nodePath: string;
  serverJs: string;
  rootDir: string;
  pathEnv: string;
  logDir: string;
  configDir?: string | undefined;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderLaunchdPlist(input: ServiceRenderInput): string {
  const env: Array<[string, string]> = [
    ["IMA2_SERVICE", "1"],
    ["PATH", input.pathEnv],
  ];
  if (input.configDir) env.push(["IMA2_CONFIG_DIR", input.configDir]);
  const envXml = env
    .map(([k, v]) => `    <key>${xmlEscape(k)}</key><string>${xmlEscape(v)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(input.nodePath)}</string>
    <string>${xmlEscape(input.serverJs)}</string>
  </array>
  <key>WorkingDirectory</key><string>${xmlEscape(input.rootDir)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${xmlEscape(input.logDir)}/service.out.log</string>
  <key>StandardErrorPath</key><string>${xmlEscape(input.logDir)}/service.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
${envXml}
  </dict>
</dict>
</plist>
`;
}

export function renderSystemdUnit(input: ServiceRenderInput): string {
  const lines = [
    "[Unit]",
    "Description=ima2-gen local generation server",
    "After=network.target",
    "",
    "[Service]",
    `ExecStart=${input.nodePath} ${input.serverJs}`,
    `WorkingDirectory=${input.rootDir}`,
    "Restart=always",
    "RestartSec=2",
    "Environment=IMA2_SERVICE=1",
    `Environment=PATH=${input.pathEnv}`,
  ];
  if (input.configDir) lines.push(`Environment=IMA2_CONFIG_DIR=${input.configDir}`);
  lines.push("", "[Install]", "WantedBy=default.target", "");
  return lines.join("\n");
}

/**
 * launchctl's trap: `load` can exit 0 while writing "Load failed: ..." to
 * stderr (opencodex hit this in production). Treat that stderr shape as a
 * failure regardless of exit status.
 */
export function launchctlOutputIndicatesFailure(stderr: string): boolean {
  const s = (stderr || "").toLowerCase();
  return s.includes("load failed") || s.includes("bootstrap failed") || s.includes("input/output error");
}

export interface ServiceState {
  version: 1;
  platform: NodeJS.Platform;
  nodePath: string;
  serverJs: string;
  configDir: string;
  installedAt: number;
}

/** Paths drifted (nvm/prefix/config-dir move) since install? repair re-renders. */
export function serviceStateStale(
  state: ServiceState,
  current: { nodePath: string; serverJs: string; configDir?: string },
): string[] {
  const issues: string[] = [];
  if (state.nodePath !== current.nodePath) issues.push(`node moved: ${state.nodePath} -> ${current.nodePath}`);
  if (state.serverJs !== current.serverJs) issues.push(`server.js moved: ${state.serverJs} -> ${current.serverJs}`);
  if (current.configDir !== undefined && state.configDir !== current.configDir) {
    issues.push(`config dir moved: ${state.configDir} -> ${current.configDir}`);
  }
  return issues;
}
