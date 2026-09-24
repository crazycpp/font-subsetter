/// <reference lib="webworker" />
import woff2WasmUrl from "fonteditor-core/woff2/woff2.wasm?url";
import hbWasmUrl from "harfbuzzjs/dist/harfbuzz-subset.wasm?url";
import { cmapHasCodepoint, readCmap } from "$lib/font/cmap";
import { CFF_SUBSETTING_ENABLED } from "$lib/font/cff-feature";
import { outputFileName } from "$lib/font/file-name";
import { SFNT_OTTO, glyphCount, readSfnt } from "$lib/font/sfnt";
import type {
  FontFormat,
  FontSubsetResult,
  SourceFormat,
  WorkerEvent,
  WorkerJobPayload,
} from "$lib/font/types";
import { unwrapWoff, wrapWoff } from "$lib/font/woff";

interface Woff2 {
  init(wasmUrl: string): Promise<unknown>;
  encode(bytes: Uint8Array | ArrayBuffer): Uint8Array;
  decode(bytes: Uint8Array | ArrayBuffer): Uint8Array;
  dispose(): void;
}

interface HbExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(pointer: number): void;
  hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number,
  ): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, codepoint: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_or_fail(face: number, input: number): number;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;
const WOFF_SIGNATURE = 0x774f4646;
const WOFF2_SIGNATURE = 0x774f4632;
const MAX_FONT_BYTES = 100 * 1024 * 1024;
let woff2Promise: Promise<Woff2> | null = null;
let harfBuzzPromise: Promise<HbExports> | null = null;
let cffHarfBuzzPromise: Promise<HbExports> | null = null;

const CFF_HARFBUZZ_IMPORTS: WebAssembly.Imports = {
  env: {
    emscripten_notify_memory_growth: () => undefined,
  },
  wasi_snapshot_preview1: {
    fd_write: () => 0,
    fd_close: () => 0,
    environ_sizes_get: () => 0,
    environ_get: () => 0,
    fd_seek: () => 0,
  },
};

function send(event: WorkerEvent, transfer: Transferable[] = []): void {
  worker.postMessage(event, transfer);
}

function sourceFormat(bytes: Uint8Array): SourceFormat {
  if (bytes.length < 12) throw new Error("文件过小，无法识别为字体");
  const magic = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(0);
  if (magic === WOFF_SIGNATURE) return "woff";
  if (magic === WOFF2_SIGNATURE) return "woff2";
  if (magic === SFNT_OTTO) return "otf";
  if (magic === 0x00010000 || magic === 0x74727565) return "ttf";
  if (magic === 0x74746366)
    throw new Error("暂不支持字体集合（.ttc）；请先导出其中的单个字体");
  throw new Error("不支持的字体格式；请选择 TTF、OTF、WOFF 或 WOFF2 文件");
}

async function getWoff2(): Promise<Woff2> {
  woff2Promise ??= (async () => {
    (globalThis as { window?: unknown }).window ??= globalThis;
    const module = (await import("fonteditor-core/woff2"))
      .default as unknown as Woff2;
    const response = await fetch(woff2WasmUrl);
    if (!response.ok)
      throw new Error(`无法加载 WOFF2 引擎（HTTP ${response.status}）`);
    const url = URL.createObjectURL(
      new Blob([await response.arrayBuffer()], { type: "application/wasm" }),
    );
    try {
      await module.init(url);
      return module;
    } finally {
      URL.revokeObjectURL(url);
    }
  })().catch((error) => {
    woff2Promise = null;
    throw error;
  });
  return woff2Promise;
}

async function loadHarfBuzz(
  wasmUrl: string,
  imports: WebAssembly.Imports = {},
): Promise<HbExports> {
  try {
    return (await WebAssembly.instantiateStreaming(fetch(wasmUrl), imports))
      .instance.exports as unknown as HbExports;
  } catch {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error("无法加载 HarfBuzz 字体裁剪引擎");
    return (
      await WebAssembly.instantiate(await response.arrayBuffer(), imports)
    ).instance.exports as unknown as HbExports;
  }
}

async function getHarfBuzz(
  outline: "truetype" | "cff",
  publicBasePath: string,
): Promise<HbExports> {
  if (outline === "cff") {
    const cffHarfBuzzWasmUrl = new URL(
      `${publicBasePath}/wasm/harfbuzz-subset-cff-14.2.0.wasm`,
      worker.location.origin,
    ).toString();
    cffHarfBuzzPromise ??= loadHarfBuzz(
      cffHarfBuzzWasmUrl,
      CFF_HARFBUZZ_IMPORTS,
    ).catch((error) => {
      cffHarfBuzzPromise = null;
      throw error;
    });
    return cffHarfBuzzPromise;
  }
  harfBuzzPromise ??= (async () => {
    try {
      return (await WebAssembly.instantiateStreaming(fetch(hbWasmUrl))).instance
        .exports as unknown as HbExports;
    } catch {
      const response = await fetch(hbWasmUrl);
      if (!response.ok) throw new Error("无法加载 HarfBuzz 字体裁剪引擎");
      return (await WebAssembly.instantiate(await response.arrayBuffer()))
        .instance.exports as unknown as HbExports;
    }
  })().catch((error) => {
    harfBuzzPromise = null;
    throw error;
  });
  return harfBuzzPromise;
}

async function unpack(
  bytes: Uint8Array,
  format: SourceFormat,
): Promise<Uint8Array> {
  if (format === "woff") return unwrapWoff(bytes);
  if (format === "woff2") {
    const codec = await getWoff2();
    try {
      const decoded = codec.decode(bytes);
      if (!decoded?.length) throw new Error("WOFF2 解码失败，文件可能已损坏");
      return decoded;
    } catch (error) {
      codec.dispose();
      woff2Promise = null;
      throw error instanceof Error ? error : new Error("WOFF2 解码失败");
    }
  }
  return bytes;
}

function subsetSfnt(
  hb: HbExports,
  sfnt: Uint8Array,
  codepoints: Uint32Array,
  keepHinting: boolean,
): Uint8Array {
  const heap = () => new Uint8Array(hb.memory.buffer);
  const pointer = hb.malloc(sfnt.byteLength);
  heap().set(sfnt, pointer);
  let face = 0;
  let input = 0;
  let subset = 0;
  let resultBlob = 0;
  try {
    const blob = hb.hb_blob_create(pointer, sfnt.byteLength, 2, 0, 0);
    face = hb.hb_face_create(blob, 0);
    hb.hb_blob_destroy(blob);
    input = hb.hb_subset_input_create_or_fail();
    if (!input) throw new Error("无法初始化字体裁剪任务");
    const unicodeSet = hb.hb_subset_input_unicode_set(input);
    for (const codepoint of codepoints) hb.hb_set_add(unicodeSet, codepoint);
    if (!keepHinting) hb.hb_subset_input_set_flags(input, 0x1);
    subset = hb.hb_subset_or_fail(face, input);
    if (!subset)
      throw new Error("字体裁剪失败：字体可能损坏或包含当前引擎无法处理的功能");
    resultBlob = hb.hb_face_reference_blob(subset);
    const offset = hb.hb_blob_get_data(resultBlob, 0);
    const length = hb.hb_blob_get_length(resultBlob);
    if (!offset || !length) throw new Error("字体裁剪没有生成可用输出");
    return heap().slice(offset, offset + length);
  } finally {
    if (resultBlob) hb.hb_blob_destroy(resultBlob);
    if (subset) hb.hb_face_destroy(subset);
    if (input) hb.hb_subset_input_destroy(input);
    if (face) hb.hb_face_destroy(face);
    hb.free(pointer);
  }
}

async function packageFont(
  sfnt: Uint8Array,
  format: FontFormat,
): Promise<Uint8Array> {
  if (format === "ttf" || format === "otf") return sfnt;
  if (format === "woff") return wrapWoff(sfnt);
  const codec = await getWoff2();
  try {
    const encoded = codec.encode(sfnt);
    if (!encoded?.length) throw new Error("WOFF2 编码失败");
    return encoded;
  } catch (error) {
    codec.dispose();
    woff2Promise = null;
    throw error instanceof Error ? error : new Error("WOFF2 编码失败");
  }
}

async function process(payload: WorkerJobPayload): Promise<FontSubsetResult> {
  if (payload.bytes.byteLength > MAX_FONT_BYTES)
    throw new Error(
      "单个字体不能超过 100 MB；请使用更小的文件或在更高内存的设备中处理",
    );
  if (payload.codepoints.length === 0)
    throw new Error("请至少输入一个需要保留的字符");
  send({
    type: "progress",
    phase: "preparing",
    detail: "正在识别字体与字符集…",
  });
  const input = new Uint8Array(payload.bytes);
  const format = sourceFormat(input);
  const sfnt = await unpack(input, format);
  const outline = readSfnt(sfnt).flavor === SFNT_OTTO ? "cff" : "truetype";
  if (outline === "cff" && !CFF_SUBSETTING_ENABLED) {
    throw new Error(
      "当前部署暂未启用 CFF/PostScript 字体裁剪。请联系管理员启用该功能后重试。",
    );
  }
  const outputFormats =
    outline === "cff"
      ? payload.formats.filter((outputFormat) => outputFormat !== "ttf")
      : payload.formats;
  if (outputFormats.length === 0) {
    throw new Error(
      "该字体使用 CFF/PostScript 轮廓，无法无损导出为 TTF。请选择 OTF、WOFF 或 WOFF2。",
    );
  }
  const before = glyphCount(sfnt);
  const cmap = readCmap(sfnt);
  const missingCodepoints = [...payload.codepoints].filter(
    (codepoint) => !cmapHasCodepoint(cmap, codepoint),
  );
  send({
    type: "progress",
    phase: "subsetting",
    detail: "正在通过 HarfBuzz 保留所需字形…",
  });
  const subset = subsetSfnt(
    await getHarfBuzz(outline, payload.publicBasePath),
    sfnt,
    payload.codepoints,
    payload.keepHinting,
  );
  const after = glyphCount(subset);
  send({
    type: "progress",
    phase: "packaging",
    detail: "正在生成 WebFont 文件…",
  });
  const outputs = [] as FontSubsetResult["outputs"];
  for (const outputFormat of outputFormats) {
    const bytes = await packageFont(subset, outputFormat);
    const tightBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    outputs.push({
      format: outputFormat,
      bytes: tightBuffer,
      fileName: outputFileName(payload.fileName, outputFormat),
    });
  }
  return {
    sourceFormat: format,
    outline,
    sourceBytes: payload.bytes.byteLength,
    requestedCodepoints: payload.codepoints.length,
    availableCodepoints: payload.codepoints.length - missingCodepoints.length,
    missingCodepoints,
    glyphsBefore: before,
    glyphsAfter: after,
    outputs,
    notes: [
      ...(missingCodepoints.length ? ["缺失字符不会出现在输出字体中。"] : []),
      ...(outline === "cff"
        ? ["CFF/PostScript 轮廓已保留；OTF、WOFF 和 WOFF2 输出均不转换轮廓。"]
        : []),
      ...(outline === "cff" && payload.formats.includes("ttf")
        ? ["CFF/PostScript 轮廓无法无损导出为 TTF；已忽略 TTF 输出。"]
        : []),
      ...(outline === "truetype" && payload.formats.includes("otf")
        ? ["OTF 输出保留 TrueType 轮廓；不会转换为 CFF/PostScript 轮廓。"]
        : []),
    ],
  };
}

worker.onmessage = async (event: MessageEvent<WorkerJobPayload>) => {
  try {
    const result = await process(event.data);
    const transfers = result.outputs.map((output) => output.bytes);
    send({ type: "result", result }, transfers);
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : "字体处理失败",
    });
  }
};
