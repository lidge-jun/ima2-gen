import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCHD_LABEL,
  launchctlOutputIndicatesFailure,
  renderLaunchdPlist,
  renderSystemdUnit,
  serviceStateStale,
  type ServiceState,
} from "../bin/lib/serviceTemplates.js";

// devlog/_plan/260821_260821c-stop-service-commands/020: the service artifacts
// must bake PATH (launchd/systemd hand children a minimal environment that
// silently kills the grok/oauth proxies) and IMA2_SERVICE=1, escape XML, and
// the launchctl stderr trap ("Load failed" with exit 0) must be detected.

const input = {
  nodePath: "/usr/local/bin/node",
  serverJs: "/opt/ima2 & co/server.js",
  rootDir: "/opt/ima2 & co",
  pathEnv: "/usr/local/bin:/usr/bin:/bin",
  logDir: "/home/u/.ima2/logs",
  configDir: undefined,
};

describe("renderLaunchdPlist", () => {
  const plist = renderLaunchdPlist(input);

  test("bakes PATH and IMA2_SERVICE into EnvironmentVariables", () => {
    assert.match(plist, /<key>PATH<\/key><string>\/usr\/local\/bin:\/usr\/bin:\/bin<\/string>/);
    assert.match(plist, /<key>IMA2_SERVICE<\/key><string>1<\/string>/);
  });

  test("keeps RunAtLoad + KeepAlive and the stable label", () => {
    assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
    assert.match(plist, /<key>KeepAlive<\/key><true\/>/);
    assert.ok(plist.includes(`<string>${LAUNCHD_LABEL}</string>`));
  });

  test("XML-escapes paths with ampersands", () => {
    assert.ok(plist.includes("/opt/ima2 &amp; co/server.js"));
    assert.ok(!plist.includes("/opt/ima2 & co/server.js"));
  });

  test("carries IMA2_CONFIG_DIR only when set", () => {
    assert.ok(!plist.includes("IMA2_CONFIG_DIR"));
    const withDir = renderLaunchdPlist({ ...input, configDir: "/custom/.ima2" });
    assert.match(withDir, /<key>IMA2_CONFIG_DIR<\/key><string>\/custom\/.ima2<\/string>/);
  });
});

describe("renderSystemdUnit", () => {
  const unit = renderSystemdUnit(input);

  test("bakes PATH + IMA2_SERVICE and always restarts", () => {
    assert.match(unit, /Environment=PATH=\/usr\/local\/bin:\/usr\/bin:\/bin/);
    assert.match(unit, /Environment=IMA2_SERVICE=1/);
    assert.match(unit, /Restart=always/);
  });

  test("ExecStart pins the recorded node and server.js", () => {
    assert.match(unit, /ExecStart=\/usr\/local\/bin\/node \/opt\/ima2 & co\/server\.js/);
  });
});

describe("launchctlOutputIndicatesFailure", () => {
  test("detects the exit-0 'Load failed' trap", () => {
    assert.equal(launchctlOutputIndicatesFailure("Load failed: 5: Input/output error"), true);
    assert.equal(launchctlOutputIndicatesFailure("Bootstrap failed: 125"), true);
    assert.equal(launchctlOutputIndicatesFailure(""), false);
    assert.equal(launchctlOutputIndicatesFailure("service loaded"), false);
  });
});

describe("serviceStateStale", () => {
  const state: ServiceState = {
    version: 1,
    platform: "darwin",
    nodePath: "/old/node",
    serverJs: "/old/server.js",
    configDir: "/home/u/.ima2",
    installedAt: 0,
  };

  test("reports both drifted paths for repair", () => {
    const issues = serviceStateStale(state, { nodePath: "/new/node", serverJs: "/new/server.js" });
    assert.equal(issues.length, 2);
    assert.match(issues[0]!, /node moved/);
  });

  test("clean when paths match", () => {
    assert.deepEqual(serviceStateStale(state, { nodePath: "/old/node", serverJs: "/old/server.js" }), []);
  });
});
