import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Try to extract server URL from state parameter
  let serverUrl: string | null = null;
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      serverUrl = stateData.serverUrl;
    } catch (e) {
      console.error("Failed to parse state parameter:", e);
    }
  }

  const redirectUrl = new URL("/results", request.url);
  if (serverUrl) {
    redirectUrl.searchParams.set("url", serverUrl);
  }

  if (error || !code) {
    redirectUrl.searchParams.set("error", error || "no_code");
  } else {
    // Store the authorization code and server URL
    redirectUrl.searchParams.set("auth_code", code);
    redirectUrl.searchParams.set("state", state || "");
  }

  return NextResponse.redirect(redirectUrl);
}
