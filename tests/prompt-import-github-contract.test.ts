import { describe, it, before, beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeGitHubSource, fetchGitHubSource, fetchGitHubSourceText } from "../lib/promptImport/githubSource.ts";
import { parsePromptCandidates } from "../lib/promptImport/parsePromptCandidates.ts";
import { DownloadNetwork, eventTurn, fakeClock } from "./_grokDownloadPolicyCases.ts";

const root = process.cwd();
const network = new DownloadNetwork();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

const limits = {
  maxFileBytesForPreview: 512 * 1024,
  maxPromptCandidatesPerFile: 100,
  maxPromptCandidatesPerImport: 100,
  fetchTimeoutMs: 8000,
  maxCandidateChars: 12000,
  minCandidateChars: 40,
  maxSourceCharsScanned: 512 * 1024,
};

describe("prompt import GitHub contract", () => {
  before(() => network.install());
  beforeEach(() => {
    network.activate();
    network.hosts["raw.githubusercontent.com"] = [{ address: "8.8.8.8", family: 4 }];
    network.hosts["github.com"] = [{ address: "1.1.1.1", family: 4 }];
  });
  afterEach(async () => { await network.finish(); });
  after(() => network.restore());

  it("normalizes supported GitHub file inputs and tags source metadata", () => {
    const blob = normalizeGitHubSource("https://github.com/owner/repo/blob/main/prompts/example.markdown");
    assert.equal(blob.owner, "owner");
    assert.equal(blob.repo, "repo");
    assert.equal(blob.ref, "main");
    assert.equal(blob.path, "prompts/example.markdown");
    assert.equal(blob.extension, "markdown");
    assert.ok(blob.tags.includes("github"));
    assert.ok(blob.tags.includes("repo:owner/repo"));
    assert.ok(blob.tags.includes("file:example.markdown"));

    const shorthand = normalizeGitHubSource("owner/repo@dev:path/to/prompts.txt");
    assert.equal(shorthand.ref, "dev");
    assert.equal(shorthand.path, "path/to/prompts.txt");
    assert.equal(shorthand.extension, "txt");
  });

  it("rejects unsupported hosts, folders, encoded slashes, and unsupported extensions", () => {
    assert.throws(
      () => normalizeGitHubSource("https://github.com.evil.com/owner/repo/blob/main/prompts.md"),
      /Only GitHub file URLs/,
    );
    assert.throws(
      () => normalizeGitHubSource("https://github.com/owner/repo/tree/main/prompts"),
      /Only GitHub file URLs/,
    );
    assert.throws(
      () => normalizeGitHubSource("owner/repo:path%2fto/prompts.md"),
      /encoded slash/,
    );
    assert.throws(
      () => normalizeGitHubSource("owner/repo:path/to/prompts.json"),
      /Only \.md, \.markdown, and \.txt/,
    );
  });

  it("enforces final redirect host and byte caps while fetching GitHub text", async () => {
    network.respond = () => ({ status: 302, headers: { location: "https://github.com.evil.com/file.md" }, holdBody: true });
    await assert.rejects(
      () => fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits),
      /redirected to an unsupported host/,
    );

    assert.equal(network.exchanges.length, 1);
    assert.equal(network.exchanges[0].reads, 0);
    network.respond = () => ({ headers: { "content-length": String(limits.maxFileBytesForPreview + 1) }, holdBody: true });
    await assert.rejects(
      () => fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits),
      /too large/,
    );

    network.respond = () => ({ status: 302, headers: { location: "https://github.com/o/r/tree/main/prompts" }, holdBody: true });
    await assert.rejects(
      () => fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits),
      /non-file page/,
    );
  });

  it("exposes metadata fetch while preserving text-only fetch behavior", async () => {
    network.respond = () => ({ headers: { etag: "\"abc\"" }, chunks: [Buffer.from("valid prompt body that is long enough to parse")] });
    const result = await fetchGitHubSource({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits);
    assert.equal(result.etag, "\"abc\"");
    assert.equal(typeof result.contentHash, "string");
    assert.equal(result.sizeBytes > 0, true);

    assert.equal(result.finalUrl, "https://raw.githubusercontent.com/o/r/main/a.md");
    network.respond = () => ({ chunks: [Buffer.from("another valid prompt body that is long enough to parse")] });
    const text = await fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits);
    assert.match(text, /another valid prompt body/);
  });

  it("rejects ambiguous branch refs that need folder/API resolution", () => {
    assert.throws(
      () => normalizeGitHubSource("owner/repo@feature/foo:prompts.md"),
      /Branches with slashes/,
    );
  });

  it("revalidates and pins allowed redirects, rejects HTTPS downgrade before DNS", async () => {
    network.respond = ({ index }) => index === 0
      ? { status: 302, headers: { location: "https://github.com/o/r/blob/main/b.md" }, holdBody: true }
      : { chunks: [Buffer.from("safe")] };
    const result = await fetchGitHubSource(normalizeGitHubSource("o/r:a.md"), limits);
    assert.equal(result.text, "safe");
    assert.equal(result.finalUrl, "https://github.com/o/r/blob/main/b.md");
    assert.deepEqual(network.resolutions, ["raw.githubusercontent.com", "github.com"]);
    assert.ok(network.order.indexOf("destroy:0") < network.order.indexOf("get:1"));
    network.respond = () => ({ status: 302, headers: { location: "http://raw.githubusercontent.com/o/r/main/a.md" }, holdBody: true });
    await assert.rejects(fetchGitHubSource(normalizeGitHubSource("o/r:a.md"), limits), /unsupported protocol/);
    assert.equal(network.exchanges.length, 3);
    assert.equal(network.resolutions.length, 3);
  });

  it("rejects mixed public/private DNS without a socket", async () => {
    network.hosts["raw.githubusercontent.com"] = [{ address: "8.8.8.8", family: 4 }, { address: "100.64.0.1", family: 4 }];
    await assert.rejects(fetchGitHubSource(normalizeGitHubSource("o/r:a.md"), limits));
    assert.equal(network.exchanges.length, 0);
  });

  for (const declared of [undefined, "1"]) it(`caps streamed text with content-length=${declared}`, async () => {
    network.respond = () => ({ chunks: [Buffer.from("abc"), Buffer.from("de")],
      headers: declared ? { "content-length": declared } : {} });
    await assert.rejects(fetchGitHubSource(normalizeGitHubSource("o/r:a.md"), { ...limits, maxFileBytesForPreview: 4 }),
      { code: "REMOTE_FILE_TOO_LARGE", status: 413 });
    assert.equal(network.exchanges.length, 1);
  });

  it("keeps the deadline through held response body and accepts empty text", async (t) => {
    const advance = fakeClock(t);
    network.respond = () => ({ holdBody: true });
    const pending = fetchGitHubSource(normalizeGitHubSource("o/r:a.md"), { ...limits, fetchTimeoutMs: 100 });
    const refused = assert.rejects(pending, { code: "REMOTE_FETCH_TIMEOUT", status: 504 });
    await eventTurn();
    await advance(100);
    await refused;
    assert.equal(advance.pending.size, 0);
    network.respond = () => ({ chunks: [] });
    assert.equal(await fetchGitHubSourceText(normalizeGitHubSource("o/r:a.md"), limits), "");
  });

  it("extracts conservative markdown and txt prompt candidates", () => {
    const markdown = parsePromptCandidates({
      filename: "pack.md",
      tags: ["github"],
      limits,
      source: { kind: "local", filename: "pack.md" },
      text: `---
title: ignore me
---
# Product shot
Create a clean studio product photo with controlled reflections, natural shadows, and a precise white seamless background.

| boiler | plate |
| --- | --- |
| skip | this |

\`\`\`prompt
Create a typography-led launch poster with a strict grid, large readable headline, and subtle product silhouette.
\`\`\`
`,
    });
    assert.equal(markdown.length, 2);
    assert.equal(markdown[0].name, "pack 1");
    assert.match(markdown[1].name, /Product shot|pack/);

    const txt = parsePromptCandidates({
      filename: "lines.txt",
      tags: ["file:lines.txt"],
      limits,
      source: { kind: "local", filename: "lines.txt" },
      text: "1. Create a reference-image edit prompt that preserves the face, keeps clothing texture, and changes only the background.\n\n---\n\nCreate a clean product photography prompt with sharp label text, controlled reflection, and accurate packaging geometry.",
    });
    assert.equal(txt.length, 2);
    assert.ok(txt[0].tags.includes("file:lines.txt"));
  });

  it("registers preview and commit routes without replacing the existing bulk import route", () => {
    const route = readSource("routes/promptImport.ts");
    const index = readSource("routes/index.ts");
    const prompts = readSource("routes/prompts.ts");
    const config = readSource("config.ts");

    assert.match(route, /registerPromptImportRoutes/);
    assert.match(route, /\/api\/prompts\/import\/preview/);
    assert.match(route, /\/api\/prompts\/import\/commit/);
    assert.match(route, /PROMPT_IMPORT_TOO_MANY_CANDIDATES/);
    assert.match(route, /assertCommitCandidateText/);
    assert.match(index, /registerPromptImportRoutes/);
    assert.match(prompts, /\/api\/prompts\/import"/);
    assert.match(config, /promptImportMaxFileBytes/);
    assert.match(config, /promptImportFetchTimeoutMs/);
    assert.match(config, /promptImportMaxCandidateChars/);
  });
});
