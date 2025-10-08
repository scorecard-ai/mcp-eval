// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryEnvironment } from "@/app/lib/utils";

const sentryEnvironment = getSentryEnvironment();
const isLocalDevelopment = sentryEnvironment === "development";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://6373b6fe2abdeb7250303320bbe9154c@o4509794827894784.ingest.us.sentry.io/4509994280026112",
  environment: sentryEnvironment,
  enabled: !isLocalDevelopment,

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration({
      // Disable built-in masking
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 100%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
