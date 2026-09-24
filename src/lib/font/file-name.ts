import type { FontFormat } from "./types";

export function outputFileName(inputName: string, format: FontFormat): string {
  const stem = inputName.replace(/\.(ttf|otf|woff2?|eot)$/i, "") || "font";
  return `${stem}-subset.${format}`;
}

export function cssForOutputs(
  outputs: ReadonlyArray<{ fileName: string; format: FontFormat }>,
): string {
  const cssFormat: Record<FontFormat, string> = {
    woff2: "woff2",
    woff: "woff",
    ttf: "truetype",
    otf: "opentype",
  };
  const sources = outputs
    .map(
      (output) =>
        `url('./${output.fileName}') format('${cssFormat[output.format]}')`,
    )
    .join(",\n       ");
  return `@font-face {\n  font-family: 'YourFont';\n  src: ${sources};\n  font-display: swap;\n}`;
}
