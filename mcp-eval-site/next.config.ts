import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG || "scorecard",
  project: process.env.SENTRY_PROJECT || "mcp-eval",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: process.env.NODE_ENV === "production",

  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,

  // See which component a user clicked on
  reactComponentAnnotation: {
    enabled: true,
  },
});