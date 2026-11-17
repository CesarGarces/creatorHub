/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@creator-hub/i18n",
    "@creator-hub/shared-types",
    "@creator-hub/shared-utils",
    "@creator-hub/ui",
  ],
  experimental: {
    // Barrel imports of the shared UI resolve to the modules actually used,
    // so each page ships only its components.
    optimizePackageImports: ["lucide-react", "@creator-hub/ui"],
  },
};

module.exports = nextConfig;
