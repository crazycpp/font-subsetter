import { unzlibSync, zlibSync } from "fflate";
import { findTable, isSfntFlavor, readSfnt } from "./sfnt";

const WOFF_SIGNATURE = 0x774f4646;
const HEADER_SIZE = 44;
const ENTRY_SIZE = 20;
const pad4 = (value: number) => (value + 3) & ~3;

export function wrapWoff(sfnt: Uint8Array): Uint8Array {
  const font = readSfnt(sfnt);
  const chunks = font.tables.map((table) => {
    const original = sfnt.subarray(table.offset, table.offset + table.length);
    const compressed = zlibSync(original, { level: 9 });
    return compressed.length < original.length ? compressed : original;
  });
  const total =
    HEADER_SIZE +
    font.tables.length * ENTRY_SIZE +
    chunks.reduce((sum, chunk) => sum + pad4(chunk.length), 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, WOFF_SIGNATURE);
  view.setUint32(4, font.flavor);
  view.setUint32(8, total);
  view.setUint16(12, font.tables.length);
  view.setUint32(
    16,
    12 +
      font.tables.length * 16 +
      font.tables.reduce((sum, table) => sum + pad4(table.length), 0),
  );
  const head = findTable(sfnt, font, "head");
  view.setUint16(
    20,
    head?.length && head.length >= 8 ? (head[4] << 8) | head[5] : 1,
  );
  view.setUint16(
    22,
    head?.length && head.length >= 8 ? (head[6] << 8) | head[7] : 0,
  );
  let dataOffset = HEADER_SIZE + font.tables.length * ENTRY_SIZE;
  for (let index = 0; index < font.tables.length; index += 1) {
    const table = font.tables[index];
    const chunk = chunks[index];
    const entryOffset = HEADER_SIZE + index * ENTRY_SIZE;
    for (let char = 0; char < 4; char += 1)
      out[entryOffset + char] = table.tag.charCodeAt(char);
    view.setUint32(entryOffset + 4, dataOffset);
    view.setUint32(entryOffset + 8, chunk.length);
    view.setUint32(entryOffset + 12, table.length);
    view.setUint32(entryOffset + 16, table.checksum);
    out.set(chunk, dataOffset);
    dataOffset += pad4(chunk.length);
  }
  return out;
}

export function unwrapWoff(woff: Uint8Array): Uint8Array {
  if (woff.length < HEADER_SIZE) throw new Error("这不是有效的 WOFF 字体");
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  const flavor = view.getUint32(4);
  const count = view.getUint16(12);
  if (
    view.getUint32(0) !== WOFF_SIGNATURE ||
    !isSfntFlavor(flavor) ||
    count === 0 ||
    count > 1024 ||
    woff.length < HEADER_SIZE + count * ENTRY_SIZE
  ) {
    throw new Error("这不是有效的 WOFF 字体");
  }
  const entries: Array<{ tag: string; checksum: number; data: Uint8Array }> =
    [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = HEADER_SIZE + index * ENTRY_SIZE;
    const offset = view.getUint32(entryOffset + 4);
    const compressedLength = view.getUint32(entryOffset + 8);
    const originalLength = view.getUint32(entryOffset + 12);
    if (
      offset + compressedLength > woff.length ||
      compressedLength > originalLength
    )
      throw new Error("这不是有效的 WOFF 字体");
    const raw = woff.subarray(offset, offset + compressedLength);
    let data: Uint8Array;
    try {
      data = compressedLength === originalLength ? raw : unzlibSync(raw);
    } catch {
      throw new Error("这不是有效的 WOFF 字体");
    }
    if (data.length !== originalLength)
      throw new Error("这不是有效的 WOFF 字体");
    entries.push({
      tag: String.fromCharCode(...woff.subarray(entryOffset, entryOffset + 4)),
      checksum: view.getUint32(entryOffset + 16),
      data,
    });
  }
  const total =
    12 +
    count * 16 +
    entries.reduce((sum, entry) => sum + pad4(entry.data.length), 0);
  const out = new Uint8Array(total);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, flavor);
  outView.setUint16(4, count);
  const selector = Math.floor(Math.log2(count));
  const range = 2 ** selector * 16;
  outView.setUint16(6, range);
  outView.setUint16(8, selector);
  outView.setUint16(10, count * 16 - range);
  let dataOffset = 12 + count * 16;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const entryOffset = 12 + index * 16;
    for (let char = 0; char < 4; char += 1)
      out[entryOffset + char] = entry.tag.charCodeAt(char);
    outView.setUint32(entryOffset + 4, entry.checksum);
    outView.setUint32(entryOffset + 8, dataOffset);
    outView.setUint32(entryOffset + 12, entry.data.length);
    out.set(entry.data, dataOffset);
    dataOffset += pad4(entry.data.length);
  }
  return out;
}
