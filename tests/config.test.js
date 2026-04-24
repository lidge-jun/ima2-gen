// tests/config.test.js — verify config module loads defaults, honors env overrides,
// and exposes the shape promised by 0.09.12 PRD.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONFIG_JS = join(ROOT, "config.js");
const CONFIG_URL = pathToFileURL(CONFIG_JS).href;

// Run a small node inline program with a custom env and capture JSON output so
// we can assert independent of whatever env the test host has set.
function loadConfig(env = {}) {
  const script = `
    import("${CONFIG_URL}").then((m) => {
      const c = m.config;
      // Serialize Set separately.
      process.stdout.write(JSON.stringify({
        server: c.server,
        limits: c.limits,
        history: c.history,
        oauth: { ...c.oauth, validModeration: [...c.oauth.validModeration] },
        storage: c.storage,
        ids: c.ids,
        inflight: c.inflight,
        trash: c.trash,
        log: c.log,
        legacy: { PORT: m.PORT, OAUTH_PORT: m.OAUTH_PORT, BODY_LIMIT: m.BODY_LIMIT, NO_OAUTH_PROXY: m.NO_OAUTH_PROXY },
      }));
    });
  `;
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, ...env, NODE_ENV: env.NODE_ENV || "test" },
    encoding: "utf-8",
  });
  if (res.status !== 0) throw new Error(`config load failed: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

test("config exposes default shape", () => {
  const c = loadConfig({
    IMA2_PORT: "",
    PORT: "",
    IMA2_OAUTH_PROXY_PORT: "",
    OAUTH_PORT: "",
    IMA2_NO_OAUTH_PROXY: "",
    IMA2_CONFIG_DIR: "/tmp/ima2-test-default",
  });
  assert.equal(c.server.port, 3333);
  assert.equal(c.server.host, "127.0.0.1");
  assert.equal(c.server.bodyLimit, "50mb");
  assert.equal(c.oauth.proxyPort, 10531);
  assert.equal(c.oauth.autoStart, true);
  assert.equal(c.limits.maxRefCount, 5);
  assert.equal(c.history.defaultPageSize, 50);
  assert.equal(c.history.maxPageCap, 500);
  assert.equal(c.ids.generatedHexBytes, 4);
  assert.equal(c.ids.nodeHexBytes, 5);
  assert.equal(c.inflight.ttlMs, 600000);
  assert.deepEqual(c.oauth.validModeration.sort(), ["auto", "low"]);
});

test("env overrides win", () => {
  const c = loadConfig({
    IMA2_PORT: "4321",
    IMA2_OAUTH_PROXY_PORT: "20000",
    IMA2_MAX_REF_COUNT: "7",
    IMA2_NO_OAUTH_PROXY: "1",
    IMA2_BODY_LIMIT: "10mb",
    IMA2_CONFIG_DIR: "/tmp/ima2-test-env",
  });
  assert.equal(c.server.port, 4321);
  assert.equal(c.oauth.proxyPort, 20000);
  assert.equal(c.limits.maxRefCount, 7);
  assert.equal(c.oauth.autoStart, false);
  assert.equal(c.server.bodyLimit, "10mb");
});

test("legacy env alias: PORT falls back when IMA2_PORT absent", () => {
  const c = loadConfig({
    IMA2_PORT: "",
    PORT: "9876",
    IMA2_CONFIG_DIR: "/tmp/ima2-test-legacy",
  });
  assert.equal(c.server.port, 9876);
  assert.equal(c.legacy.PORT, 9876);
});

test("legacy env alias: OAUTH_PORT falls back", () => {
  const c = loadConfig({
    IMA2_OAUTH_PROXY_PORT: "",
    OAUTH_PORT: "11111",
    IMA2_CONFIG_DIR: "/tmp/ima2-test-legacy2",
  });
  assert.equal(c.oauth.proxyPort, 11111);
  assert.equal(c.legacy.OAUTH_PORT, 11111);
});

test("storage paths honor IMA2_CONFIG_DIR", () => {
  const configDir = "/tmp/ima2-custom-xyz";
  const c = loadConfig({ IMA2_CONFIG_DIR: configDir });
  assert.equal(c.storage.configDir, configDir);
  assert.equal(c.storage.configFile, join(configDir, "config.json"));
  assert.ok(c.storage.dbPath.endsWith("sessions.db"));
});
