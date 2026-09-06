import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePromptCandidates } from "../lib/promptImport/parsePromptCandidates.ts";

const limits = {
  maxFileBytesForPreview: 512 * 1024, maxPromptCandidatesPerFile: 100,
  maxPromptCandidatesPerImport: 100, fetchTimeoutMs: 8000,
  maxCandidateChars: 512 * 1024, minCandidateChars: 1, maxSourceCharsScanned: 512 * 1024,
};
function parse(text: string, filename = "pack.md") {
  return parsePromptCandidates({ text, filename, limits, source: { kind: "local", filename } });
}

test("frontmatter removes complete whitespace-delimited blocks only", () => {
  for (const text of ["---\ntitle: ignored\n---\nDraw a cat", "--- \r\ntitle: ignored\r\n--- \t\r\n\nDraw a cat"]) {
    assert.equal(parse(text)[0].text, "Draw a cat");
  }
  for (const text of ["---\ntitle: retained\n---suffix\nDraw a cat", "---\ntitle: retained\n---", "---\n---\nDraw a cat"]) {
    assert.equal(parse(text)[0].text, text);
  }
  assert.equal(parse("---\ntitle: ignored\n---suffix\nmore: ignored\n---\nDraw a cat")[0].text, "Draw a cat");
  assert.equal(parse("---\ntitle: ignored\n---\n").length, 0);
});

test("frontmatter long non-closing delimiters preserve content without timing gates", () => {
  const body = "---" + " ".repeat(64000) + "x";
  assert.equal(parse(`---\ntitle: retained\n${body}\nDraw a cat`)[0].text, `---\ntitle: retained\n${body}\nDraw a cat`);
});

test("whitespace normalization preserves interior and non-horizontal whitespace", () => {
  assert.equal(parse("first  \t\r\nsecond\u00a0\nthird  \t", "pack.txt")[0].text, "first\nsecond\u00a0\nthird");
  const interior = `first${" \t".repeat(64000)}x`;
  assert.equal(parse(interior, "pack.txt")[0].text, interior);
  assert.equal(parse(`first${" \t".repeat(64000)}\nsecond`, "pack.txt")[0].text, "first\nsecond");
});

test("filename titles retain prior extension and suffix semantics", () => {
  assert.equal(parse("Draw a cat", "my_pack.markdown")[0].name, "my pack 1");
  assert.equal(parse("Draw a cat", "my_pack.md  ")[0].name, "my pack.md 1");
  assert.equal(parse("Draw a cat", "---.md")[0].name, "Imported prompt 1");
});
