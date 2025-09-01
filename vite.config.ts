import type { UserConfig } from "vite";

export default {
  server: {
    host: true,
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
  worker: {
    format: "es",
  },
} satisfies UserConfig;
