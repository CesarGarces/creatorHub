const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@creator-hub/shared-types",
    "@creator-hub/shared-utils",
    "@creator-hub/ui",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // ─── Sentry Webpack Plugin Options ──────────────────────────────────────
  // Automatically tree-shake Sentry logger to reduce bundle size
  sentry: {
    hideSourceMaps: true,
    disableLogger: true,
    tunnelRoute: "/api/sentry-tunnel", // Bypass ad blockers
  },
};

// Wrap with Sentry config
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Automatically tree-shake Sentry logger bundle
  disableLogger: true,

  // Upload source maps to Sentry (only in production builds)
  silent: true,

  // Disable Sentry CLI upload in CI (we'll handle it separately)
  widenClientFileUpload: true,

  // Hide Sentry CLI logs during build
  hideSourceMaps: true,
});
