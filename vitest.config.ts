import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "_legacy", "e2e"],
    env,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**", "components/**", "lib/**", "proxy.ts"],
      exclude: ["**/*.d.ts", "**/*.test.*", "**/*.spec.*"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
