/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.spec.ts"],
  moduleNameMapper: {
    "^@prisma/client$": "<rootDir>/src/__mocks__/prisma-client.ts",
  },
  globals: {
    "ts-jest": {
      tsconfig: {
        types: ["jest", "node"],
      },
    },
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.spec.ts",
    "!src/**/__tests__/**",
    "!src/__mocks__/**",
    "!src/seed.ts",
  ],
};
