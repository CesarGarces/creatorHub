/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.spec.ts"],
  moduleNameMapper: {
    "^@creator-hub/storage$": "<rootDir>/src/__mocks__/storage.ts",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { tsconfig: { types: ["jest", "node"], isolatedModules: true } },
    ],
  },
};
