export const FONT_INPUT_EXTENSIONS = [
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
] as const;
export const OUTPUT_FORMATS = ["woff2", "woff", "ttf", "otf"] as const;

export type FontFormat = (typeof OUTPUT_FORMATS)[number];
export type SourceFormat = FontFormat;
export type FontOutline = "truetype" | "cff";
export type JobPhase = "preparing" | "subsetting" | "packaging";

export interface FontSubsetJob {
  font: File;
  text: string;
  unicodeRanges: string;
  formats: FontFormat[];
  keepHinting: boolean;
}

export interface FontSubsetOutput {
  format: FontFormat;
  bytes: ArrayBuffer;
  fileName: string;
}

export interface FontSubsetResult {
  sourceFormat: SourceFormat;
  outline: FontOutline;
  sourceBytes: number;
  requestedCodepoints: number;
  availableCodepoints: number;
  missingCodepoints: number[];
  glyphsBefore: number | null;
  glyphsAfter: number | null;
  outputs: FontSubsetOutput[];
  notes: string[];
}

export interface WorkerJobPayload {
  bytes: ArrayBuffer;
  fileName: string;
  publicBasePath: string;
  codepoints: Uint32Array;
  formats: FontFormat[];
  keepHinting: boolean;
}

export type WorkerEvent =
  | { type: "progress"; phase: JobPhase; detail: string }
  | { type: "result"; result: FontSubsetResult }
  | { type: "error"; message: string };
