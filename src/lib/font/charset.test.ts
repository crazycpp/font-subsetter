import { describe, expect, it } from "vitest";
import {
  CHARSET_PRESETS,
  collectCodepoints,
  parseUnicodeRanges,
} from "./charset";

describe("Unicode range parsing", () => {
  it("accepts codepoints and ranges with common separators", () => {
    expect(parseUnicodeRanges("U+4E00-U+4E02, 0041；U+0020")).toEqual([
      0x4e00, 0x4e01, 0x4e02, 0x41, 0x20,
    ]);
  });

  it("rejects malformed and reversed ranges", () => {
    expect(() => parseUnicodeRanges("U+NOT-A-CODEPOINT")).toThrow(/无效/);
    expect(() => parseUnicodeRanges("U+4E02-U+4E00")).toThrow(/超出/);
  });
});

describe("character collection", () => {
  it("deduplicates text by Unicode codepoint and preserves non-BMP characters", () => {
    const output = collectCodepoints("你你A😀", "", []);
    expect([...output]).toEqual([0x20, 0x41, 0x4f60, 0x1f600]);
  });

  it("combines selected versioned presets with custom text", () => {
    const output = collectCodepoints("好", "U+4E16", [
      "ascii",
      "simplified-chinese-core",
    ]);
    expect(output).toContain(0x20);
    expect(output).toContain(0x41);
    expect(output).toContain("好".codePointAt(0)!);
    expect(output).toContain("世".codePointAt(0)!);
    const preset = CHARSET_PRESETS.find(
      (item) => item.id === "simplified-chinese-core",
    );
    expect(preset?.version).toBe("2013.1.0");
    expect([...new Set(preset?.text)].length).toBe(3500);
  });

  it("ships the 6,500 and 8,105 character General Standard Chinese presets", () => {
    const general = CHARSET_PRESETS.find(
      (item) => item.id === "simplified-chinese-general",
    );
    const complete = CHARSET_PRESETS.find(
      (item) => item.id === "simplified-chinese-complete",
    );
    expect(general?.version).toBe("2013.1.0");
    expect(complete?.version).toBe("2013.1.0");
    expect([...new Set(general?.text)].length).toBe(6500);
    expect([...new Set(complete?.text)].length).toBe(8105);

    const output = collectCodepoints("", "", ["simplified-chinese-general"]);
    expect(output).toContain("一".codePointAt(0)!);
    expect(output).toContain("乂".codePointAt(0)!);
    expect(output).not.toContain("亍".codePointAt(0)!);
  });
});
