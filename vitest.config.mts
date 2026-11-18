import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["lib/services/**/*.ts", "lib/validation/**/*.ts", "lib/catalog/**/*.ts"],
      exclude: ["lib/catalog/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 20_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
