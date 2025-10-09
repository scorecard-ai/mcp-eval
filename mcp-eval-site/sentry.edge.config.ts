// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryEnvironment } from "@/app/lib/utils";

const sentryEnvironment = getSentryEnvironment();
const isLocalDevelopment = sentryEnvironment === "development";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://f9bdf78c886c927c9b0482d18110ec77@o4509794827894784.ingest.us.sentry.io/4510160526049280",
  environment: sentryEnvironment,
  enabled: !isLocalDevelopment,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
