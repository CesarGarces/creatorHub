/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.spec.ts"],
  moduleNameMapper: {
    "^@creator-hub/shared-utils$": "<rootDir>/src/__mocks__/shared-utils.ts",
    "^@creator-hub/shared-types$": "<rootDir>/src/__mocks__/shared-types.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(nanoid)/)",
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.spec.ts",
    "!src/**/__tests__/**",
    "!src/__mocks__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
