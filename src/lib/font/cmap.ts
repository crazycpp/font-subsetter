import { findTable, readSfnt } from "./sfnt";

interface Cmap4 {
  format: 4;
  view: DataView;
  base: number;
  segments: number;
}

interface Cmap12 {
  format: 12;
  view: DataView;
  base: number;
  groups: number;
}

type Cmap = Cmap4 | Cmap12;

export function readCmap(bytes: Uint8Array): Cmap | null {
  const table = findTable(bytes, readSfnt(bytes), "cmap");
  if (!table || table.length < 4) return null;
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const count = view.getUint16(2);
  let selected: { offset: number; score: number } | null = null;
  for (let index = 0; index < count; index += 1) {
    const at = 4 + index * 8;
    if (at + 8 > table.length) break;
    const platform = view.getUint16(at);
    const encoding = view.getUint16(at + 2);
    const offset = view.getUint32(at + 4);
    const score =
      platform === 3 && encoding === 10
        ? 4
        : platform === 3 && encoding === 1
          ? 3
          : platform === 0
            ? 2
            : 1;
    if (offset + 2 <= table.length && (!selected || score > selected.score))
      selected = { offset, score };
  }
  if (!selected) return null;
  const base = selected.offset;
  const format = view.getUint16(base);
  if (format === 12 && base + 16 <= table.length)
    return { format, view, base, groups: view.getUint32(base + 12) };
  if (format === 4 && base + 14 <= table.length)
    return { format, view, base, segments: view.getUint16(base + 6) / 2 };
  return null;
}

export function cmapHasCodepoint(
  cmap: Cmap | null,
  codepoint: number,
): boolean {
  if (!cmap) return false;
  if (cmap.format === 12) {
    let low = 0;
    let high = cmap.groups - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const at = cmap.base + 16 + middle * 12;
      if (at + 12 > cmap.view.byteLength) return false;
      const start = cmap.view.getUint32(at);
      const end = cmap.view.getUint32(at + 4);
      if (codepoint < start) high = middle - 1;
      else if (codepoint > end) low = middle + 1;
      else return cmap.view.getUint32(at + 8) + codepoint - start !== 0;
    }
    return false;
  }
  if (codepoint > 0xffff) return false;
  const endStart = cmap.base + 14;
  const startStart = endStart + cmap.segments * 2 + 2;
  const deltaStart = startStart + cmap.segments * 2;
  const rangeStart = deltaStart + cmap.segments * 2;
  for (let index = 0; index < cmap.segments; index += 1) {
    const end = cmap.view.getUint16(endStart + index * 2);
    if (codepoint > end) continue;
    const start = cmap.view.getUint16(startStart + index * 2);
    if (codepoint < start) return false;
    const delta = cmap.view.getInt16(deltaStart + index * 2);
    const rangeOffset = cmap.view.getUint16(rangeStart + index * 2);
    if (rangeOffset === 0) return ((codepoint + delta) & 0xffff) !== 0;
    const glyphAt =
      rangeStart + index * 2 + rangeOffset + (codepoint - start) * 2;
    if (glyphAt + 2 > cmap.view.byteLength) return false;
    const glyph = cmap.view.getUint16(glyphAt);
    return glyph !== 0;
  }
  return false;
}
