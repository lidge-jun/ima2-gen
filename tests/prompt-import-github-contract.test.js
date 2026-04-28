import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeGitHubSource, fetchGitHubSourceText } from "../lib/promptImport/githubSource.js";
import { parsePromptCandidates } from "../lib/promptImport/parsePromptCandidates.js";

const root = process.cwd();
const originalFetch = globalThis.fetch;

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
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

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
    globalThis.fetch = async () => ({
      ok: true,
      url: "https://github.com.evil.com/file.md",
      headers: new Headers(),
      arrayBuffer: async () => new TextEncoder().encode("prompt").buffer,
    });
    await assert.rejects(
      () => fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits),
      /redirected to an unsupported host/,
    );

    globalThis.fetch = async () => ({
      ok: true,
      url: "https://raw.githubusercontent.com/o/r/main/a.md",
      headers: new Headers({ "content-length": String(limits.maxFileBytesForPreview + 1) }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await assert.rejects(
      () => fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits),
      /too large/,
    );

    globalThis.fetch = async () => ({
      ok: true,
      url: "https://github.com/o/r/tree/main/prompts",
      headers: new Headers(),
      arrayBuffer: async () => new TextEncoder().encode("valid prompt body that is long enough to parse").buffer,
    });
    await assert.rejects(
      () => fetchGitHubSourceText({ rawUrl: "https://raw.githubusercontent.com/o/r/main/a.md" }, limits),
      /non-file page/,
    );
  });

  it("rejects ambiguous branch refs that need folder/API resolution", () => {
    assert.throws(
      () => normalizeGitHubSource("owner/repo@feature/foo:prompts.md"),
      /Branches with slashes/,
    );
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
    const route = readSource("routes/promptImport.js");
    const index = readSource("routes/index.js");
    const prompts = readSource("routes/prompts.js");
    const config = readSource("config.js");

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
