// Activation evidence for the NovelAI ZIP path (C-ACTIVATION-GROUNDING-01).
//
// Neither the decode path nor its rejection branches run on the default happy
// path, because both need an upstream response and the repo has no NovelAI
// token. Archives are therefore built in-memory here so the real parser runs
// against a real archive, with no committed binary fixture.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

import { extractFirstZipEntry, looksLikeZip } from "../lib/naiZip.ts";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // magic
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

type ZipOptions = {
  method?: number;
  flags?: number;
  compressedSize?: number;
  uncompressedSize?: number;
  name?: string;
  signature?: number;
  /** Emit a streaming archive: zeroed local sizes + a central directory. */
  streaming?: boolean;
  /** Omit the trailer so the streaming path has nothing authoritative to read. */
  omitCentralDirectory?: boolean;
};

/** Builds a single-entry archive with the exact header fields under test. */
function buildZip(payload: Buffer, options: ZipOptions = {}): Buffer {
  const method = options.method ?? 8;
  const body = method === 8 ? deflateRawSync(payload) : payload;
  const name = Buffer.from(options.name ?? "image_0.png", "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(options.signature ?? 0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(options.flags ?? 0, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(options.compressedSize ?? body.length, 18);
  header.writeUInt32LE(options.uncompressedSize ?? payload.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name, body]);
}

/**
 * Builds the archive shape NovelAI actually returns.
 *
 * Its server streams the response, so the local header carries flag bit 3 with
 * zeroed CRC and sizes, and the real values appear only in the central
 * directory (verified against a live V5 response: 734550 bytes, local sizes 0,
 * central sizes 734414/735841).
 */
function buildStreamingZip(payload: Buffer, options: ZipOptions = {}): Buffer {
  const method = options.method ?? 8;
  const body = method === 8 ? deflateRawSync(payload) : payload;
  const name = Buffer.from(options.name ?? "image_0.png", "utf8");

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x8, 6); // data-descriptor flag
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 14); // crc unknown at write time
  local.writeUInt32LE(0, 18); // compressed size unknown
  local.writeUInt32LE(0, 22); // uncompressed size unknown
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(0, 4);
  descriptor.writeUInt32LE(body.length, 8);
  descriptor.writeUInt32LE(payload.length, 12);

  const head = Buffer.concat([local, name, body, descriptor]);
  if (options.omitCentralDirectory) return head;

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x8, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(options.compressedSize ?? body.length, 20);
  central.writeUInt32LE(options.uncompressedSize ?? payload.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + name.length, 12);
  eocd.writeUInt32LE(head.length, 16);

  return Buffer.concat([head, central, name, eocd]);
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return (err as { code?: string }).code ?? "NO_CODE";
  }
  return "NO_THROW";
}

describe("nai zip decode", () => {
  it("inflates a deflated PNG entry", () => {
    const out = extractFirstZipEntry(buildZip(PNG_BYTES));
    assert.deepEqual(out, PNG_BYTES, "decoded bytes must equal the original PNG");
  });

  it("returns a stored entry verbatim", () => {
    const out = extractFirstZipEntry(buildZip(PNG_BYTES, { method: 0 }));
    assert.deepEqual(out, PNG_BYTES);
  });

  it("reads the entry regardless of its filename", () => {
    // The server chooses the name, so nothing may depend on a literal.
    const out = extractFirstZipEntry(buildZip(PNG_BYTES, { name: "unexpected-name.png" }));
    assert.deepEqual(out, PNG_BYTES);
  });

  it("rejects a JSON error body instead of guessing", () => {
    const body = Buffer.from(JSON.stringify({ statusCode: 401, message: "unauthorized" }));
    assert.equal(looksLikeZip(body), false);
    assert.equal(codeOf(() => extractFirstZipEntry(body)), "NAI_ZIP_INVALID");
  });

  it("rejects an encrypted entry", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildZip(PNG_BYTES, { flags: 0x1 }))),
      "NAI_ZIP_UNSUPPORTED",
    );
  });

  it("reads a streaming archive via the central directory", () => {
    // This is the real NovelAI shape. An earlier version rejected it outright,
    // which live traffic immediately disproved.
    const out = extractFirstZipEntry(buildStreamingZip(PNG_BYTES));
    assert.deepEqual(out, PNG_BYTES);
  });

  it("rejects a streaming archive with no readable trailer", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildStreamingZip(PNG_BYTES, { omitCentralDirectory: true }))),
      "NAI_ZIP_INVALID",
    );
  });

  it("honours the size cap using central-directory sizes", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildStreamingZip(PNG_BYTES, { uncompressedSize: 60 * 1024 * 1024 }))),
      "NAI_ZIP_TOO_LARGE",
    );
  });

  it("rejects ZIP64 sentinels", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildZip(PNG_BYTES, { compressedSize: 0xffffffff }))),
      "NAI_ZIP_UNSUPPORTED",
    );
  });

  it("rejects an unsupported compression method", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildZip(PNG_BYTES, { method: 12 }))),
      "NAI_ZIP_UNSUPPORTED",
    );
  });

  it("rejects an entry that claims to exceed the size cap", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildZip(PNG_BYTES, { uncompressedSize: 60 * 1024 * 1024 }))),
      "NAI_ZIP_TOO_LARGE",
    );
  });

  it("rejects an entry extending past the payload", () => {
    assert.equal(
      codeOf(() => extractFirstZipEntry(buildZip(PNG_BYTES, { compressedSize: 9999 }))),
      "NAI_ZIP_INVALID",
    );
  });

  it("rejects a truncated header", () => {
    const short = buildZip(PNG_BYTES).subarray(0, 12);
    assert.equal(codeOf(() => extractFirstZipEntry(short)), "NAI_ZIP_INVALID");
  });

  it("does not mistake a bare PNG for an archive", () => {
    assert.equal(looksLikeZip(PNG_BYTES), false);
  });
});
