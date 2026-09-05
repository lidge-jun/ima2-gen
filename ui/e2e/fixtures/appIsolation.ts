import { join } from "node:path";

export type IsolationOptions = {
  home: string;
  stubUrl: string;
  mode: "minimax" | "oauth-expired" | "minimax-billing";
  withoutMinimaxKey: boolean;
};

function stubOrigin(value: string): { origin: string; port: string } {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("E2E_STUB_URL_INVALID"); }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password
    || !url.port || url.port === "3333" || url.search || url.hash || Number(url.port) <= 0 || Number(url.port) > 65535) {
    throw new Error("E2E_STUB_URL_INVALID");
  }
  return { origin: url.origin, port: url.port };
}

export function makeAppEnv(inherited: NodeJS.ProcessEnv, options: IsolationOptions): NodeJS.ProcessEnv {
  const { home, stubUrl } = options;
  const { origin, port } = stubOrigin(stubUrl);
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "TMPDIR", "TMP", "TEMP"]) {
    if (inherited[key] !== undefined) env[key] = inherited[key];
  }
  const tmp = join(home, "tmp");
  Object.assign(env, {
    IMA2_CONFIG_DIR: home, IMA2_DB_PATH: join(home, "sessions.db"),
    IMA2_GENERATED_DIR: join(home, "generated"), IMA2_TRASH_DIR: join(home, "generated/.trash"),
    IMA2_PORT: "0", IMA2_HOST: "127.0.0.1", IMA2_NO_OAUTH_PROXY: "1", IMA2_NO_GROK_PROXY: "1",
    IMA2_OAUTH_PROXY_PORT: port, IMA2_GROK_PROXY_PORT: port, IMA2_GROK_PROXY_HOST: "127.0.0.1",
    IMA2_MINIMAX_REGION: "global_en",
    IMA2_MINIMAX_GLOBAL_BASE_URL: stubUrl, IMA2_MINIMAX_CN_BASE_URL: stubUrl,
    IMA2_NAI_BASE_URL: origin,
    IMA2_NAI_ACCOUNT_BASE_URL: origin, IMA2_MCP_TOKEN_DIR: join(home, "mcp"),
    IMA2_MCP_SNAPSHOT_DIR: join(home, "mcp/snapshots"), IMA2_MCP_PROVIDERS: ",",
    DOTENV_CONFIG_PATH: join(home, "fixture.env"), IMA2_E2E_HOME: home,
    IMA2_TEST_HOME: home, IMA2_TEST_EXEC_PATH: join(home, "runtime/bin/node"),
    IMA2_TEST_ARGV1: join(home, "runtime/bin/ima2"), TSX_DISABLE_CACHE: "1",
    IMA2_E2E_ALLOWED_ORIGIN: origin, TMPDIR: tmp, TMP: tmp, TEMP: tmp,
  });
  if (!options.withoutMinimaxKey) env.MINIMAX_API_KEY = "e2e-minimax-key";
  return env;
}
