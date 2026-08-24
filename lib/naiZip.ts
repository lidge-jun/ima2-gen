// lib/naiZip.ts — minimal single-entry ZIP reader for NovelAI responses.
//
// NovelAI returns generated images as a ZIP archive rather than JSON, and the
// server ships no unzip dependency (sharp decodes image formats, not
// containers). Full ZIP support is not needed here: the archive comes from a
// known server and holds one PNG, so parsing the local file header and
// inflating that entry is enough.
//
// Every shape this does not fully understand is rejected rather than guessed.
// A wrong guess would be persisted as a corrupt .png, which is far harder to
// diagnose than an explicit error.
//
// Precedent: lib/comfyPngWorkflow.ts already hand-parses PNG chunks and calls
// zlib to read embedded workflow text, so byte-level container parsing is an
// established pattern in this repo.
import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIRECTORY_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const FLAG_ENCRYPTED = 0x1;
const FLAG_DATA_DESCRIPTOR = 0x8;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const ZIP64_SENTINEL = 0xffffffff;

/** Matches the MiniMax download cap so one provider cannot outspend the others. */
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;

function naiZipError(message: string, code: string): Error {
  const err = new Error(message) as Error & { status?: number; code?: string; isOperational?: boolean };
  err.status = 502;
  err.code = code;
  err.isOperational = true;
  return err;
}

/**
 * True when the buffer starts with a ZIP local file header.
 *
 * Callers branch on this BEFORE extracting so a JSON or msgpack body reports
 * what it actually is instead of surfacing a confusing parser failure.
 */
export function looksLikeZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === LOCAL_FILE_HEADER_SIG;
}

/**
 * Reads the first entry's real sizes from the central directory.
 *
 * NovelAI streams its response, which sets the data-descriptor flag and leaves
 * the local header's CRC and sizes zero (verified against a live V5 response:
 * flags 0x8, local sizes 0, true sizes only in the central directory). The
 * authoritative values therefore live at the end of the archive.
 *
 * Returns null when the trailer is absent or malformed, so callers can fail
 * with a precise error instead of reading arbitrary bytes.
 */
function readCentralDirectorySizes(
  buffer: Buffer,
): { compressedSize: number; uncompressedSize: number; method: number } | null {
  // The EOCD is variable-length because of its comment field, so scan back for
  // the signature. 22 bytes is the minimum record size.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) return null;

  const cdOffset = buffer.readUInt32LE(eocd + 16);
  // +46 is the fixed central-directory header size; a truncated trailer must
  // not read past the buffer.
  if (cdOffset + 46 > buffer.length) return null;
  if (buffer.readUInt32LE(cdOffset) !== CENTRAL_DIRECTORY_SIG) return null;

  return {
    method: buffer.readUInt16LE(cdOffset + 10),
    compressedSize: buffer.readUInt32LE(cdOffset + 20),
    uncompressedSize: buffer.readUInt32LE(cdOffset + 24),
  };
}

/**
 * Extracts the first entry of a single-entry ZIP archive.
 *
 * Returns the decompressed bytes. Throws an operational NAI_ZIP_* error for
 * anything this parser cannot handle correctly.
 */
export function extractFirstZipEntry(buffer: Buffer): Buffer {
  if (!looksLikeZip(buffer)) {
    throw naiZipError("NovelAI response is not a ZIP archive", "NAI_ZIP_INVALID");
  }
  if (buffer.length < 30) {
    throw naiZipError("NovelAI ZIP header is truncated", "NAI_ZIP_INVALID");
  }

  const flags = buffer.readUInt16LE(6);
  let method = buffer.readUInt16LE(8);
  let compressedSize = buffer.readUInt32LE(18);
  let uncompressedSize = buffer.readUInt32LE(22);
  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);

  if (flags & FLAG_ENCRYPTED) {
    throw naiZipError("NovelAI ZIP entry is encrypted", "NAI_ZIP_UNSUPPORTED");
  }
  // Bit 3 means the sizes were not known when the header was written, which is
  // exactly what a streaming server produces — NovelAI sets it on every
  // response. The real values are in the central directory at the end.
  if (flags & FLAG_DATA_DESCRIPTOR) {
    const central = readCentralDirectorySizes(buffer);
    if (!central) {
      throw naiZipError(
        "NovelAI ZIP entry has no readable central directory",
        "NAI_ZIP_INVALID",
      );
    }
    method = central.method;
    compressedSize = central.compressedSize;
    uncompressedSize = central.uncompressedSize;
  }
  if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL) {
    throw naiZipError("NovelAI ZIP entry is ZIP64", "NAI_ZIP_UNSUPPORTED");
  }
  if (uncompressedSize > MAX_ENTRY_BYTES) {
    throw naiZipError("NovelAI ZIP entry exceeds the 50MB limit", "NAI_ZIP_TOO_LARGE");
  }

  const dataStart = 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataEnd > buffer.length) {
    throw naiZipError("NovelAI ZIP entry extends past the payload", "NAI_ZIP_INVALID");
  }
  const payload = buffer.subarray(dataStart, dataEnd);

  if (method === METHOD_STORED) return Buffer.from(payload);
  if (method !== METHOD_DEFLATE) {
    throw naiZipError(`NovelAI ZIP compression method ${method} is unsupported`, "NAI_ZIP_UNSUPPORTED");
  }

  try {
    // Raw inflate: ZIP stores bare DEFLATE with no zlib 2-byte header, so
    // inflateSync would fail here.
    return inflateRawSync(payload, { maxOutputLength: MAX_ENTRY_BYTES });
  } catch (err) {
    // A lying uncompressedSize is still bounded by maxOutputLength above.
    if ((err as { code?: string })?.code === "ERR_BUFFER_TOO_LARGE") {
      throw naiZipError("NovelAI ZIP entry exceeds the 50MB limit", "NAI_ZIP_TOO_LARGE");
    }
    throw naiZipError("NovelAI ZIP entry could not be inflated", "NAI_ZIP_INVALID");
  }
}
