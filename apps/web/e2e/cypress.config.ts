import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.E2E_BASE_URL || "http://localhost:3000",
    specPattern: "e2e/specs/**/*.cy.{js,ts}",
    supportFile: false,
  },
});
