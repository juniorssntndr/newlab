// Validate encoded containers, not extensions or browser-supplied MIME alone.
// Downloads remain attachments with nosniff; uploaded bytes never execute on our origin.
const validSize = (width, height) => width > 0 && height > 0 && width * height <= 40000000;
const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
};
export const detectRepeatPhoto = (b) => {
    if (!Buffer.isBuffer(b) || b.length > 5242880) return null;
    if (b.length > 32 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
        let offset = 8, header = false, pixels = false;
        while (offset + 12 <= b.length) {
            const length = b.readUInt32BE(offset);
            const end = offset + 12 + length;
            if (end > b.length) return null;
            const type = b.toString('ascii', offset + 4, offset + 8);
            if (crc32(b.subarray(offset + 4, end - 4)) !== b.readUInt32BE(end - 4)) return null;
            if (!header) {
                if (type !== 'IHDR' || length !== 13 || !validSize(b.readUInt32BE(offset + 8), b.readUInt32BE(offset + 12))) return null;
                header = true;
            }
            if (type === 'IDAT' && length > 0) pixels = true;
            if (type === 'IEND') return header && pixels && length === 0 && end === b.length ? 'image/png' : null;
            offset = end;
        }
        return null;
    }
    if (b.length > 10 && b[0] === 255 && b[1] === 216 && b[b.length - 2] === 255 && b[b.length - 1] === 217) {
        let offset = 2, frame = false;
        while (offset + 4 <= b.length) {
            if (b[offset] !== 255) return null;
            while (b[offset] === 255) offset++;
            const marker = b[offset++];
            if (marker === 0xd9) return null;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
            if (offset + 2 > b.length) return null;
            const length = b.readUInt16BE(offset);
            if (length < 2 || offset + length > b.length) return null;
            if ([0xc0,0xc1,0xc2].includes(marker)) {
                if (length < 8 || !validSize(b.readUInt16BE(offset + 5), b.readUInt16BE(offset + 3))) return null;
                frame = true;
            }
            if (marker === 0xda) return frame && offset + length < b.length - 2 ? 'image/jpeg' : null;
            offset += length;
        }
    }
    if (b.length > 24 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' && b.readUInt32LE(4) + 8 === b.length) {
        let offset = 12, image = false;
        while (offset + 8 <= b.length) {
            const type = b.toString('ascii', offset, offset + 4), length = b.readUInt32LE(offset + 4);
            const start = offset + 8, end = start + length;
            if (end > b.length) return null;
            if (type === 'VP8 ' && length >= 10 && b.subarray(start + 3, start + 6).equals(Buffer.from([0x9d,0x01,0x2a]))) {
                image = validSize(b.readUInt16LE(start + 6) & 0x3fff, b.readUInt16LE(start + 8) & 0x3fff);
            }
            if (type === 'VP8L' && length >= 5 && b[start] === 0x2f) {
                const bits = b.readUInt32LE(start + 1);
                image = validSize((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
            }
            offset = end + (length % 2);
        }
        return image && offset === b.length ? 'image/webp' : null;
    }
    return null;
};
