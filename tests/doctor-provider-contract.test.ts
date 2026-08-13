import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const {
  buildProviderDoctorLines,
  listedValidateUrls,
  resolveValidateUrl,
  verifyConfiguredKeys,
} = await import("../bin/lib/doctor-providers.ts");
const { listProviders } = await import("../lib/providers/registry.ts");
const { bundleContainsSecrets, buildDoctorBundle, expectedLaneIds } = await import("../bin/lib/doctor-bundle.ts");

function source(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("070 doctor provider contract", () => {
  it("lists every registry lane", () => {
    const lanes = expectedLaneIds();
    assert.deepEqual(lanes, listProviders().map((provider) => provider.id));
    assert.equal(lanes.length, 8);
    const lines = buildProviderDoctorLines({});
    for (const lane of lanes) {
      assert.ok(lines.some((line) => line.lane === lane), `missing lane ${lane}`);
    }
  });

  it("keeps default doctor off the network and off image-probe", () => {
    const doctor = source("bin/commands/doctor.ts");
    assert.match(doctor, /if \(args\.includes\("--verify-keys"\)\)/);
    assert.match(doctor, /if \(args\[0\] === "image-probe"\)/);
    const verifyBlock = doctor.slice(doctor.indexOf('if (args.includes("--verify-keys"))'));
    assert.match(verifyBlock, /verifyConfiguredKeys/);
    const standard = doctor.slice(doctor.indexOf("async function standardDoctor"), doctor.indexOf("export async function doctor"));
    assert.doesNotMatch(standard, /runImageDoctorProbe/);
    assert.doesNotMatch(standard.replace(/if \(args\.includes\("--verify-keys"\)\)[\s\S]*?}\n/, ""), /verifyConfiguredKeys/);
  });

  it("image-probe warns on stderr before the live probe", () => {
    const doctor = source("bin/commands/doctor.ts");
    const probe = doctor.slice(doctor.indexOf("async function imageProbe"), doctor.indexOf("async function standardDoctor"));
    assert.ok(probe.indexOf("console.error(\"Warning: ima2 doctor image-probe") < probe.indexOf("runImageDoctorProbe"));
  });

  it("verify-keys uses the Gemini header, not Bearer", async () => {
    const seen: Array<{ url: string; headerKeys: string[] }> = [];
    await verifyConfiguredKeys({ geminiApiKey: "AItest" }, (async (input, init) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      seen.push({ url: String(input), headerKeys: Object.keys(headers) });
      assert.equal(headers["x-goog-api-key"], "AItest");
      assert.equal("Authorization" in headers, false);
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    assert.ok(seen.some((entry) => entry.url.includes("generativelanguage.googleapis.com")));
  });

  it("verify-keys only calls resolved validateUrl values", async () => {
    const urls: string[] = [];
    const allowed = new Set(listedValidateUrls());
    await verifyConfiguredKeys({ apiKey: "sk-test" }, (async (input) => {
      urls.push(String(input));
      return new Response("{}", { status: 401 });
    }) as typeof fetch);
    assert.ok(urls.length >= 1);
    for (const url of urls) assert.ok(allowed.has(url), url);
    const minimax = listProviders().find((provider) => provider.id === "minimax")?.credentials[0];
    assert.equal(minimax && minimax.kind === "api-key", true);
    if (minimax && minimax.kind === "api-key") {
      assert.ok(listedValidateUrls().includes(resolveValidateUrl(minimax)!));
    }
  });

  it("redacts secrets from the diagnostic bundle", () => {
    const bundle = buildDoctorBundle({
      version: "test",
      providerLines: [{ lane: "api", kind: "fail", text: "leaked sk-secret and Bearer abc.def" }],
    });
    assert.equal(bundleContainsSecrets(bundle), false);
    assert.match(JSON.stringify(bundle), /\[redacted\]/);
  });

  it("treats Vertex JSON as a parsed service account, not a file path", () => {
    const lines = buildProviderDoctorLines({
      vertexServiceAccountJson: JSON.stringify({ type: "service_account", project_id: "demo" }),
    });
    assert.ok(lines.some((line) => line.lane === "gemini-api" && line.text.includes("service-account JSON present")));
  });
});
