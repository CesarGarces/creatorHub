import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // tsconfig uses Next's "jsx": "preserve"; tests need real JSX output.
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
