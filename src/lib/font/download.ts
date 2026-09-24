import { strToU8, zipSync } from "fflate";
import type { FontSubsetOutput } from "./types";

export function downloadBytes(
  bytes: ArrayBuffer,
  name: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadZip(
  outputs: readonly FontSubsetOutput[],
  css: string,
  sourceName: string,
): void {
  const entries: Record<string, Uint8Array> = {};
  for (const output of outputs)
    entries[output.fileName] = new Uint8Array(output.bytes);
  entries["font-face.css"] = strToU8(css);
  const stem = sourceName.replace(/\.(ttf|otf|woff2?)$/i, "") || "font";
  downloadBytes(
    zipSync(entries, { level: 6 }).buffer,
    `${stem}-subset.zip`,
    "application/zip",
  );
}

export function fontMime(format: FontSubsetOutput["format"]): string {
  switch (format) {
    case "woff2":
      return "font/woff2";
    case "woff":
      return "font/woff";
    case "ttf":
      return "font/ttf";
    case "otf":
      return "font/otf";
  }
}
