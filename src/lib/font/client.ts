import { base } from "$app/paths";
import type {
  FontSubsetJob,
  FontSubsetResult,
  WorkerEvent,
  WorkerJobPayload,
} from "./types";
import { collectCodepoints } from "./charset";

export class FontSubsetCancelledError extends Error {
  constructor() {
    super("已取消字体裁剪");
    this.name = "FontSubsetCancelledError";
  }
}

export async function runFontSubset(
  job: FontSubsetJob,
  presetIds: Iterable<string>,
  onProgress: (phase: string, detail: string) => void,
  signal?: AbortSignal,
): Promise<FontSubsetResult> {
  if (signal?.aborted) throw new FontSubsetCancelledError();
  const codepoints = collectCodepoints(job.text, job.unicodeRanges, presetIds);
  const bytes = await job.font.arrayBuffer();
  if (signal?.aborted) throw new FontSubsetCancelledError();
  return new Promise<FontSubsetResult>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/font.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cancel = () => {
      worker.terminate();
      reject(new FontSubsetCancelledError());
    };
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => {
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      reject(new Error("字体 Worker 意外停止；请重新尝试"));
    };
    worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const message = event.data;
      if (message.type === "progress")
        onProgress(message.phase, message.detail);
      if (message.type === "error") {
        signal?.removeEventListener("abort", cancel);
        worker.terminate();
        reject(new Error(message.message));
      }
      if (message.type === "result") {
        signal?.removeEventListener("abort", cancel);
        worker.terminate();
        resolve(message.result);
      }
    };
    // Svelte's reactive arrays are proxies and cannot cross a Worker boundary.
    // Take a plain snapshot so the worker always receives structured-cloneable data.
    const payload: WorkerJobPayload = {
      bytes,
      fileName: job.font.name,
      publicBasePath: base,
      codepoints,
      formats: [...job.formats],
      keepHinting: job.keepHinting,
    };
    worker.postMessage(payload, [bytes, codepoints.buffer]);
  });
}
