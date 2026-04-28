import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchGitHubFolderFiles,
  fetchSelectedGitHubFolderFiles,
  normalizeGitHubFolderSource,
} from "../lib/promptImport/githubFolder.js";

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
  maxFolderFiles: 100,
  maxFolderPreviewFiles: 20,
};

function folderItems() {
  return [
    {
      type: "file",
      name: "poster.md",
      path: "prompts/poster.md",
      size: 120,
      html_url: "https://github.com/o/r/blob/main/prompts/poster.md",
      download_url: "https://raw.githubusercontent.com/o/r/main/prompts/poster.md",
    },
    {
      type: "file",
      name: "notes.json",
      path: "prompts/notes.json",
      size: 80,
      html_url: "https://github.com/o/r/blob/main/prompts/notes.json",
      download_url: "https://raw.githubusercontent.com/o/r/main/prompts/notes.json",
    },
    {
      type: "dir",
      name: "nested",
      path: "prompts/nested",
      size: 0,
      html_url: "https://github.com/o/r/tree/main/prompts/nested",
      download_url: null,
    },
    {
      type: "symlink",
      name: "linked.md",
      path: "prompts/linked.md",
      size: 1,
      html_url: "https://github.com/o/r/blob/main/prompts/linked.md",
      download_url: "https://raw.githubusercontent.com/o/r/main/prompts/linked.md",
    },
  ];
}

describe("prompt import GitHub folder contract", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("normalizes supported folder inputs and rejects unsupported folder sources", () => {
    const tree = normalizeGitHubFolderSource("https://github.com/o/r/tree/main/prompts");
    assert.equal(tree.kind, "github-folder");
    assert.equal(tree.owner, "o");
    assert.equal(tree.repo, "r");
    assert.equal(tree.ref, "main");
    assert.equal(tree.path, "prompts");
    assert.match(tree.apiUrl, /api\.github\.com\/repos\/o\/r\/contents\/prompts\?ref=main/);

    const shorthand = normalizeGitHubFolderSource("o/r@dev:prompts/");
    assert.equal(shorthand.ref, "dev");
    assert.equal(shorthand.path, "prompts");

    assert.throws(
      () => normalizeGitHubFolderSource("https://raw.githubusercontent.com/o/r/main/prompts"),
      /Only github\.com folder URLs/,
    );
    assert.throws(
      () => normalizeGitHubFolderSource("https://github.com.evil.com/o/r/tree/main/prompts"),
      /Only github\.com folder URLs/,
    );
    assert.throws(() => normalizeGitHubFolderSource("o/r:prompts%2fsecret"), /encoded slash/);
    assert.throws(() => normalizeGitHubFolderSource("o/r:../prompts"), /traversal/);
    assert.throws(() => normalizeGitHubFolderSource("o/r@feature/foo:prompts/"), /Branches with slashes/);
  });

  it("lists supported files from GitHub Contents API without recursive crawl", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: "https://api.github.com/repos/o/r/contents/prompts?ref=main",
      json: async () => folderItems(),
    });
    const source = normalizeGitHubFolderSource("o/r:prompts/");
    const result = await fetchGitHubFolderFiles(source, limits);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].path, "prompts/poster.md");
    assert.ok(result.warnings.some((warning) => warning.includes("unsupported-extension")));
    assert.ok(result.warnings.some((warning) => warning.includes("folder-deferred")));
  });

  it("rejects non-folder responses and ambiguous tree URL failures", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: "https://api.github.com/repos/o/r/contents/prompts?ref=main",
      json: async () => ({ type: "file" }),
    });
    await assert.rejects(
      () => fetchGitHubFolderFiles(normalizeGitHubFolderSource("o/r:prompts/"), limits),
      /not a folder/,
    );

    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      url: "https://api.github.com/repos/o/r/contents/foo/prompts?ref=feature",
      json: async () => ({}),
    });
    await assert.rejects(
      () => fetchGitHubFolderFiles(normalizeGitHubFolderSource("https://github.com/o/r/tree/feature/foo/prompts"), limits),
      /ambiguous/,
    );
  });

  it("previews only selected paths returned by the server-side folder listing", async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("api.github.com")) {
        return {
          ok: true,
          status: 200,
          url: "https://api.github.com/repos/o/r/contents/prompts?ref=main",
          json: async () => folderItems(),
        };
      }
      return {
        ok: true,
        status: 200,
        url: "https://raw.githubusercontent.com/o/r/main/prompts/poster.md",
        headers: new Headers(),
        arrayBuffer: async () => new TextEncoder().encode(
          "Create a cinematic gpt-image-2 typography poster with readable headline, strict grid, and product-safe layout.",
        ).buffer,
      };
    };
    const source = normalizeGitHubFolderSource("o/r:prompts/");
    const result = await fetchSelectedGitHubFolderFiles(source, ["prompts/poster.md"], limits);
    assert.equal(result.files.length, 1);
    assert.match(result.files[0].text, /typography poster/);

    await assert.rejects(() => fetchSelectedGitHubFolderFiles(source, ["README.md"], limits), /not in the listed folder/);
    await assert.rejects(() => fetchSelectedGitHubFolderFiles(source, ["prompts%2fposter.md"], limits), /encoded slash/);
    await assert.rejects(() => fetchSelectedGitHubFolderFiles(source, ["prompts/../poster.md"], limits), /traversal/);
    await assert.rejects(() => fetchSelectedGitHubFolderFiles(source, ["prompts/missing.md"], limits), /not in the listed folder/);
    await assert.rejects(() => fetchSelectedGitHubFolderFiles(source, ["prompts/nested"], limits), /not in the listed folder/);
  });

  it("warns on raw entry caps and rejects redirected folder fetches", async () => {
    const rawHeavy = Array.from({ length: limits.maxFolderFiles + 1 }, (_, index) => ({
      type: index === 0 ? "file" : "dir",
      name: index === 0 ? "one.md" : `dir-${index}`,
      path: index === 0 ? "prompts/one.md" : `prompts/dir-${index}`,
      size: 1,
      html_url: "https://github.com/o/r/blob/main/prompts/one.md",
      download_url: index === 0 ? "https://raw.githubusercontent.com/o/r/main/prompts/one.md" : null,
    }));
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: "https://api.github.com/repos/o/r/contents/prompts?ref=main",
      json: async () => rawHeavy,
    });
    const result = await fetchGitHubFolderFiles(normalizeGitHubFolderSource("o/r:prompts/"), limits);
    assert.ok(result.warnings.some((warning) => warning.startsWith("folder-raw-too-large:")));

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      url: "https://api.github.com.evil.test/repos/o/r/contents/prompts?ref=main",
      json: async () => folderItems(),
    });
    await assert.rejects(
      () => fetchGitHubFolderFiles(normalizeGitHubFolderSource("o/r:prompts/"), limits),
      /unsupported host/,
    );
  });

  it("rejects redirected raw file downloads outside the raw GitHub host", async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("api.github.com")) {
        return {
          ok: true,
          status: 200,
          url: "https://api.github.com/repos/o/r/contents/prompts?ref=main",
          json: async () => folderItems(),
        };
      }
      return {
        ok: true,
        status: 200,
        url: "https://example.com/o/r/main/prompts/poster.md",
        headers: new Headers(),
        arrayBuffer: async () => new TextEncoder().encode("valid prompt body that is long enough to parse").buffer,
      };
    };
    await assert.rejects(
      () => fetchSelectedGitHubFolderFiles(normalizeGitHubFolderSource("o/r:prompts/"), ["prompts/poster.md"], limits),
      /download host is unsupported/,
    );
  });

  it("registers folder routes, config caps, and route contracts", () => {
    const route = readSource("routes/promptImport.js");
    const config = readSource("config.js");
    const api = readSource("ui/src/lib/api.ts");

    assert.match(route, /\/api\/prompts\/import\/folder-files/);
    assert.match(route, /\/api\/prompts\/import\/folder-preview/);
    assert.match(route, /fetchSelectedGitHubFolderFiles/);
    assert.match(config, /promptImportMaxFolderFiles/);
    assert.match(config, /promptImportMaxFolderPreviewFiles/);
    assert.match(api, /previewPromptImportFolderFiles/);
  });
});
