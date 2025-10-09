type SentryEnvironment = "production" | "staging" | "preview" | "development";

/**
 * Determines the Sentry environment based on deployment context.
 *
 * @returns The appropriate Sentry environment string
 */
export function getSentryEnvironment(): SentryEnvironment {
  // Check if this is a Vercel PR preview deployment
  if (process.env.NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID) {
    return "preview";
  }

  if (
    process.env.VERCEL_URL?.includes("staging") ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.includes("staging")
  ) {
    return "staging";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  // For local development
  return (
    (process.env.NODE_ENV as SentryEnvironment | undefined) || "development"
  );
}
