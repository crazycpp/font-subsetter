export const SFNT_TTF = 0x00010000;
export const SFNT_TRUE = 0x74727565;
export const SFNT_OTTO = 0x4f54544f;

export interface SfntTable {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

export interface Sfnt {
  flavor: number;
  tables: SfntTable[];
}

const INVALID = "这不是有效的字体文件";

export function isSfntFlavor(value: number): boolean {
  return value === SFNT_TTF || value === SFNT_TRUE || value === SFNT_OTTO;
}

export function readSfnt(bytes: Uint8Array): Sfnt {
  if (bytes.length < 12) throw new Error(INVALID);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(0);
  const count = view.getUint16(4);
  if (
    !isSfntFlavor(flavor) ||
    count === 0 ||
    count > 1024 ||
    bytes.length < 12 + count * 16
  ) {
    throw new Error(INVALID);
  }
  const tables: SfntTable[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 12 + index * 16;
    const tableOffset = view.getUint32(offset + 8);
    const length = view.getUint32(offset + 12);
    if (tableOffset < 12 || tableOffset + length > bytes.length)
      throw new Error(INVALID);
    tables.push({
      tag: String.fromCharCode(...bytes.subarray(offset, offset + 4)),
      checksum: view.getUint32(offset + 4),
      offset: tableOffset,
      length,
    });
  }
  return { flavor, tables };
}

export function findTable(
  bytes: Uint8Array,
  sfnt: Sfnt,
  tag: string,
): Uint8Array | null {
  const table = sfnt.tables.find((entry) => entry.tag === tag);
  return table
    ? bytes.subarray(table.offset, table.offset + table.length)
    : null;
}

export function glyphCount(bytes: Uint8Array): number | null {
  const table = findTable(bytes, readSfnt(bytes), "maxp");
  return table && table.length >= 6
    ? new DataView(table.buffer, table.byteOffset).getUint16(4)
    : null;
}
