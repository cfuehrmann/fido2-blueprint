import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Coverage requires @vitest/coverage-v8 which is not installed.
    // Knip reports unlisted dependencies, so we comment this out.
    // To enable: pnpm add -D @vitest/coverage-v8
    // Then uncomment below and run: pnpm test --coverage
    // coverage: {
    //   provider: "v8",
    //   reporter: ["text", "json", "html"],
    // },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
