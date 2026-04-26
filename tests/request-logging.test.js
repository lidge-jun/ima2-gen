import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { request } from "node:http";
import { configureLogger } from "../lib/logger.js";
import { createRequestLogger, normalizeRequestId } from "../lib/requestLogger.js";

function makeApp(lines) {
  const app = express();
  configureLogger({
    sink: {
      log: (line) => lines.push(line),
      warn: (line) => lines.push(line),
      error: (line) => lines.push(line),
    },
  });
  // Mimic the auth-user middleware in server.js so authUser is captured.
  app.use((req, _res, next) => {
    req.authUser = req.get("X-Auth-User") || null;
    next();
  });
  app.use(createRequestLogger());
  app.use(express.json());
  app.get("/api/test", (req, res) => {
    res.json({ ok: true, requestId: req.id });
  });
  app.post("/api/echo", (req, res) => {
    res.json({ ok: true, requestId: req.id });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/inflight", (_req, res) => {
    res.json({ jobs: [] });
  });
  app.get("/assets/app.js", (_req, res) => {
    res.type("text/javascript").send("console.log('asset')");
  });
  return app;
}

async function hit(app, { method = "GET", path = "/api/test", headers = {}, body } = {}) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  try {
    return await new Promise((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port, path, method, headers },
        (res) => {
          let raw = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            raw += chunk;
          });
          res.on("end", () => {
            let parsed = null;
            try {
              parsed = raw ? JSON.parse(raw) : null;
            } catch {
              parsed = raw;
            }
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          });
        },
      );
      req.on("error", reject);
      if (body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("request logger middleware", () => {
  afterEach(() => {
    configureLogger({ sink: console });
  });

  it("echoes a valid X-Request-Id and logs request/response without query values", async () => {
    const lines = [];
    const app = makeApp(lines);

    const res = await hit(app, {
      path: "/api/test?secret=query-value",
      headers: { "X-Request-Id": "req.custom-1", "X-Ima2-Client": "test/client" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers["x-request-id"], "req.custom-1");
    assert.equal(res.body.requestId, "req.custom-1");
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^\[http\.request\]/);
    assert.match(lines[0], /requestId="req\.custom-1"/);
    assert.match(lines[0], /path="\/api\/test"/);
    assert.match(lines[0], /client="test\/client"/);
    assert.match(lines[1], /^\[http\.response\]/);
    assert.match(lines[1], /status=200/);
    assert.doesNotMatch(lines.join("\n"), /query-value/);
  });

  it("normalizes invalid, control-char, or overlong request ids to a uuid", () => {
    assert.match(normalizeRequestId("bad\nid"), /^req_[0-9a-f-]{36}$/);
    assert.match(normalizeRequestId("a".repeat(129)), /^req_[0-9a-f-]{36}$/);
    assert.equal(normalizeRequestId("req_ok:1.2-3"), "req_ok:1.2-3");
  });

  it("does not touch or log non-/api paths (UI assets pass through)", async () => {
    const lines = [];
    const app = makeApp(lines);

    const res = await hit(app, { path: "/assets/app.js" });

    assert.equal(res.status, 200);
    assert.equal(res.headers["x-request-id"], undefined);
    assert.deepEqual(lines, []);
  });

  it("keeps X-Request-Id on /api/health but emits no log lines", async () => {
    const lines = [];
    const app = makeApp(lines);

    const res = await hit(app, {
      path: "/api/health",
      headers: { "X-Request-Id": "req_health" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers["x-request-id"], "req_health");
    assert.deepEqual(lines, []);
  });

  it("keeps X-Request-Id on /api/inflight but emits no log lines", async () => {
    const lines = [];
    const app = makeApp(lines);

    const res = await hit(app, { path: "/api/inflight" });

    assert.equal(res.status, 200);
    assert.deepEqual(lines, []);
  });

  it("never logs request body, raw prompt, or raw reference payloads", async () => {
    const lines = [];
    const app = makeApp(lines);

    const res = await hit(app, {
      method: "POST",
      path: "/api/echo",
      headers: { "Content-Type": "application/json" },
      body: {
        prompt: "secret prompt",
        references: ["data:image/png;base64,aGVsbG8="],
      },
    });

    assert.equal(res.status, 200);
    assert.equal(lines.length, 2);
    assert.doesNotMatch(lines.join("\n"), /secret prompt/);
    assert.doesNotMatch(lines.join("\n"), /aGVsbG8=/);
  });

  it("captures authUser from the upstream auth middleware", async () => {
    const lines = [];
    const app = makeApp(lines);

    await hit(app, {
      path: "/api/test",
      headers: { "X-Auth-User": "ree9622" },
    });

    assert.match(lines[0], /authUser="ree9622"/);
  });

  it("records response duration", async () => {
    const lines = [];
    const app = makeApp(lines);

    await hit(app, { path: "/api/test" });

    assert.match(lines[1], /durationMs=\d+/);
  });
});
