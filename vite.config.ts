/// <reference types="vitest/config" />
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [sveltekit()],
  envPrefix: ["VITE_", "PUBLIC_"],
  build: { target: "esnext" },
  worker: { format: "es" },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
