import { describe, expect, it } from "vitest";
import { cssForOutputs, outputFileName } from "./file-name";

describe("output file names", () => {
  it("replaces an input extension with the subset suffix", () => {
    expect(outputFileName("Noto Sans SC.woff2", "woff2")).toBe(
      "Noto Sans SC-subset.woff2",
    );
    expect(outputFileName("brand.otf", "woff")).toBe("brand-subset.woff");
    expect(outputFileName("brand.woff", "ttf")).toBe("brand-subset.ttf");
    expect(outputFileName("brand.ttf", "otf")).toBe("brand-subset.otf");
  });

  it("generates CSS for ordered fallbacks", () => {
    expect(
      cssForOutputs([
        { fileName: "brand-subset.woff2", format: "woff2" },
        { fileName: "brand-subset.woff", format: "woff" },
      ]),
    ).toContain(
      "format('woff2'),\n       url('./brand-subset.woff') format('woff')",
    );
    expect(
      cssForOutputs([
        { fileName: "brand-subset.ttf", format: "ttf" },
        { fileName: "brand-subset.otf", format: "otf" },
      ]),
    ).toContain(
      "format('truetype'),\n       url('./brand-subset.otf') format('opentype')",
    );
  });
});
