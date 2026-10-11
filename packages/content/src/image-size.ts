/**
 * Pixel size read from an image file's own header — PNG, JPEG and WebP (lossy VP8, lossless VP8L,
 * extended VP8X) — so a declared `width`/`height` is checked against the file, not trusted. Sync
 * and dependency-free, because `bun run validate` is. Anything else, or a truncated header, is
 * `undefined`: the caller reports an unreadable file rather than guessing.
 */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
  try {
    // PNG: the IHDR chunk carries width and height as big-endian u32 at offsets 16 and 20.
    if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47)
      return { width: view.getUint32(16), height: view.getUint32(20) };

    // JPEG: walk the marker segments to the first start-of-frame (SOF0–SOF15, not DHT/JPG/DAC).
    if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
      let at = 2;
      while (at + 9 < bytes.length) {
        const marker = view.getUint16(at);
        if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker))
          return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
        at += 2 + view.getUint16(at + 2);
      }
      return undefined;
    }

    // WebP: a RIFF container whose first chunk names the bitstream.
    if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
      const chunk = ascii(12, 4);
      const u24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
      // VP8X: canvas width − 1 and height − 1, 24-bit little-endian, after 4 flag bytes.
      if (chunk === 'VP8X') return { width: u24(24) + 1, height: u24(27) + 1 };
      // VP8 (lossy): a 3-byte frame tag and the start code 9d 01 2a, then 14-bit sizes.
      if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a)
        return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      // VP8L (lossless): signature 0x2f, then width − 1 and height − 1 packed in 14 bits each.
      if (chunk === 'VP8L' && bytes[20] === 0x2f) {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
    }
  } catch {
    // A header that claims more bytes than the file has: unreadable, not a crash.
  }
  return undefined;
}
