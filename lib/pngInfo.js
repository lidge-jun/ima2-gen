const PNG_SIGNATURE_HEX = "89504e470d0a1a0a";
const IHDR_TYPE = "IHDR";
export function parsePngInfo(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 33) {
        return { error: "INVALID_PNG" };
    }
    if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE_HEX) {
        return { error: "INVALID_PNG" };
    }
    const ihdrLength = buffer.readUInt32BE(8);
    const chunkType = buffer.subarray(12, 16).toString("ascii");
    if (ihdrLength !== 13 || chunkType !== IHDR_TYPE) {
        return { error: "INVALID_PNG_IHDR" };
    }
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        bitDepth: buffer.readUInt8(24),
        colorType: buffer.readUInt8(25),
    };
}
export function hasPngAlphaChannel(info) {
    return info?.colorType === 4 || info?.colorType === 6;
}
