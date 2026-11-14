/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@creator-hub/i18n",
    "@creator-hub/shared-types",
    "@creator-hub/shared-utils",
    "@creator-hub/ui",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

module.exports = nextConfig;
