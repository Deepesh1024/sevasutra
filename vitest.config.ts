import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { APP_SECRET: "test-secret-0123456789abcdef0123456789abcdef", DOCUMENT_ENC_KEY: "3b1f7c9d2e4a6b8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c" },
  },
});
