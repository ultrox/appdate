import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "bun:test": fileURLToPath(new URL("./src/vitest-adapter.ts", import.meta.url)),
    },
  },
});
