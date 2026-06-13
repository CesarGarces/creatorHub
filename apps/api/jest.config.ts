import type { Config } from "jest";
import path from "path";

const rootDir = __dirname;
const monorepoRoot = path.resolve(rootDir, "../..");

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: [path.join(rootDir, "src"), path.join(monorepoRoot, "packages")],
  testMatch: ["**/*.spec.ts", "**/*.test.ts"],
  moduleNameMapper: {
    "^@creator-hub/database$": path.join(monorepoRoot, "packages/database/src/__mocks__/index.ts"),
    "^@creator-hub/shared-utils$": path.join(monorepoRoot, "packages/shared-utils/src/__mocks__/index.ts"),
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.module.ts",
  ],
};

export default config;
