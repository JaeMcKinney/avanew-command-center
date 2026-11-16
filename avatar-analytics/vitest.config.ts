import path from "node:path"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    // Integration tests share one local database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: loadEnv(mode, import.meta.dirname, ""),
    globalSetup: process.argv.some((a) => a.includes("integration")) ? ["./tests/integration/global-setup.ts"] : [],
  },
}))
