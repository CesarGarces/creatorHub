export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  landingUrl: process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3002",
} as const;
