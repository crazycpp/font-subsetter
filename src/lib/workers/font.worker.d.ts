declare module "fonteditor-core/woff2" {
  interface Woff2Module {
    init(wasmUrl: string): Promise<unknown>;
    encode(bytes: Uint8Array | ArrayBuffer): Uint8Array;
    decode(bytes: Uint8Array | ArrayBuffer): Uint8Array;
    dispose(): void;
  }
  const module: Woff2Module;
  export default module;
}

declare module "fonteditor-core/woff2/woff2.wasm?url" {
  const url: string;
  export default url;
}

declare module "harfbuzzjs/dist/harfbuzz-subset.wasm?url" {
  const url: string;
  export default url;
}
