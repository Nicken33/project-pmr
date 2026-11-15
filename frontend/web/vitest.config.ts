import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    /** globals lets setup/test files use `expect`/`describe`/`it` without imports */
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      /** Mirrors tsconfig `"@/*": "./src/*"` so tests can use `@/lib/...` imports. */
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
