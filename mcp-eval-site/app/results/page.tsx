"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { EvaluationResult } from "@/app/types/mcp-eval";
import Results from "@/app/components/Results";

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<{
    oauthUrl?: string;
    clientInfo?: any;
    codeVerifier?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Initialize server URL from search params - run only once on mount
  useEffect(() => {
    const urlFromParams = searchParams.get("url");
    const authCode = searchParams.get("auth_code");
    const state = searchParams.get("state");

    if (urlFromParams) {
      setServerUrl(urlFromParams);
      // If this is an OAuth callback, run authenticated test
      if (authCode) {
        runAuthenticatedTest(authCode, state, urlFromParams);
      } else {
        // Otherwise, start normal evaluation
        runTests(urlFromParams);
      }
    } else if (!authCode) {
      // No URL and no auth code, redirect to home
      router.push("/");
    }
  }, []); // Empty dependency array - run only once on mount

  async function runAuthenticatedTest(
    authCode: string,
    state: string | null,
    url: string
  ) {
    setLoading(true);
    setError(null);

    if (!url) {
      setError("Server URL is required for authentication");
      setLoading(false);
      setStatusMessage("");
      return;
    }

    // Retrieve stored OAuth state
    const storedClientInfo = localStorage.getItem("mcp-eval-client-info");
    const storedCodeVerifier = localStorage.getItem("mcp-eval-code-verifier");

    console.log("Retrieved OAuth state for callback:", {
      clientInfo: !!storedClientInfo,
      codeVerifier: !!storedCodeVerifier,
    });

    try {
      // Build query parameters for the authenticated streaming request
      const params = new URLSearchParams({
        serverUrl: url,
        authCode,
        ...(state && { state }),
        ...(storedClientInfo && { clientInfo: storedClientInfo }),
        ...(storedCodeVerifier && { codeVerifier: storedCodeVerifier }),
      });

      // Use EventSource for Server-Sent Events to get real-time logs
      const eventSource = new EventSource(
        `/api/eval-stream?${params.toString()}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "log") {
          setStatusMessage(data.message);
        } else if (data.type === "result") {
          setResults(data.result);
          setLoading(false);
          setStatusMessage("");
          setAuthRequired(null); // Clear auth required since we're now authenticated
          eventSource.close();

          // Don't update the URL - just keep the current params
          // This prevents triggering a new evaluation
        } else if (data.type === "error") {
          setError(data.message);
          setLoading(false);
          setStatusMessage("");
          eventSource.close();
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        setError("Connection to server lost");
        setLoading(false);
        setStatusMessage("");
        eventSource.close();
      };

      // Fallback timeout after 2 minutes
      setTimeout(() => {
        if (loading) {
          eventSource.close();
          setError("Request timed out");
          setLoading(false);
          setStatusMessage("");
        }
      }, 120000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
      setStatusMessage("");
    }
  }

  async function runTests(url?: string) {
    const targetUrl = url || serverUrl;
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setStatusMessage("Starting evaluation...");

    try {
      // Use EventSource for Server-Sent Events to get real-time logs
      const eventSource = new EventSource(
        `/api/eval-stream?serverUrl=${encodeURIComponent(targetUrl)}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "log") {
          setStatusMessage(data.message);
        } else if (data.type === "result") {
          setResults(data.result);

          // Check if any test requires OAuth
          const oauthTest = data.result.tests?.find(
            (test: any) => test.details?.requiresAuth && test.details?.oauthUrl
          );

          if (oauthTest) {
            setAuthRequired({
              oauthUrl: oauthTest.details.oauthUrl,
              clientInfo: oauthTest.details.clientInfo,
              codeVerifier: oauthTest.details.codeVerifier,
            });
          }

          setLoading(false);
          setStatusMessage("");
          eventSource.close();
        } else if (data.type === "error") {
          setError(data.message);
          setLoading(false);
          setStatusMessage("");
          eventSource.close();
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        setError("Connection to server lost");
        setLoading(false);
        setStatusMessage("");
        eventSource.close();
      };

      // Fallback timeout after 2 minutes
      setTimeout(() => {
        if (loading) {
          eventSource.close();
          setError("Request timed out");
          setLoading(false);
          setStatusMessage("");
        }
      }, 120000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
      setStatusMessage("");
    }
  }

  function handleOAuthFlow() {
    if (authRequired?.oauthUrl) {
      // Store OAuth client info and code verifier for after OAuth redirect
      // Note: server URL is preserved through the OAuth state parameter
      localStorage.setItem(
        "mcp-eval-client-info",
        JSON.stringify(authRequired.clientInfo)
      );
      if (authRequired.codeVerifier) {
        localStorage.setItem(
          "mcp-eval-code-verifier",
          authRequired.codeVerifier
        );
      }

      console.log("Storing OAuth state for callback:", {
        clientInfo: !!authRequired.clientInfo,
        codeVerifier: !!authRequired.codeVerifier,
      });

      // Open OAuth authorization in the same window
      window.location.href = authRequired.oauthUrl;
    } else {
      console.error("No auth URL available:", authRequired);
      alert("OAuth URL not found. Please try running the test again.");
    }
  }

  function handleNewTest() {
    router.push("/");
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Evaluating MCP Server
          </h2>
          <p className="text-gray-600">
            {statusMessage || "Testing connection..."}
          </p>
          <p className="text-sm text-gray-500 mt-2">{serverUrl}</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error && !results) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="max-w-md w-full px-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Evaluation Failed
            </h3>
            <p className="text-red-800">{error}</p>
          </div>
          <button
            onClick={handleNewTest}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Another Server
          </button>
        </div>
      </main>
    );
  }

  // Results display
  if (results) {
    return (
      <Results
        results={results}
        serverUrl={serverUrl}
        authRequired={authRequired}
        handleOAuthFlow={handleOAuthFlow}
        accessToken={results.accessToken}
      />
    );
  }

  // Fallback - shouldn't normally reach here
  return null;
}
