import { describe, expect, it } from "vitest";
import { unwrapWoff, wrapWoff } from "./woff";

function makeSfnt(): Uint8Array {
  const head = new Uint8Array(12);
  head.set([0, 1, 0, 0], 4);
  const name = new TextEncoder().encode("FontSubsetFixture");
  const offset = 12 + 2 * 16;
  const total = offset + 12 + ((name.length + 3) & ~3);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 2);
  view.setUint16(6, 32);
  view.setUint16(8, 1);
  view.setUint16(10, 0);
  for (const [index, tag, data] of [
    [0, "head", head],
    [1, "name", name],
  ] as const) {
    const at = 12 + index * 16;
    for (let character = 0; character < 4; character += 1)
      bytes[at + character] = tag.charCodeAt(character);
    view.setUint32(at + 8, index === 0 ? offset : offset + head.length);
    view.setUint32(at + 12, data.length);
    bytes.set(data, index === 0 ? offset : offset + head.length);
  }
  return bytes;
}

describe("WOFF container", () => {
  it("round-trips raw SFNT table bytes", () => {
    const source = makeSfnt();
    expect(unwrapWoff(wrapWoff(source))).toEqual(source);
  });

  it("rejects truncated input", () => {
    expect(() => unwrapWoff(new Uint8Array(8))).toThrow(/WOFF/);
  });
});
