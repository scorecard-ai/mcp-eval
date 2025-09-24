"use client";

import { useState, useEffect } from "react";
import { Search, Zap, TestTube, ChevronRight, ChevronDown } from "lucide-react";

type TestResult = {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
  details?: any;
};

type EvalResults = {
  serverUrl: string;
  overallPassed: number;
  totalTests: number;
  tests: TestResult[];
  timestamp: Date;
};

type AutoEvalResults = {
  type: "auto-eval";
  serverUrl: string;
  timestamp: Date;
  discoveredTools: Array<{ name: string; description: string }>;
  generatedTasks: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: string;
  }>;
  results: Array<{
    taskId: string;
    model: string;
    success: boolean;
    score: number;
    reasoning: string;
  }>;
  scorecard: {
    overallScore: number;
    totalTests: number;
    successRate: number;
    avgLatency: number;
    avgTokens: number;
    modelPerformance: Array<{
      model: string;
      score: number;
      successRate: number;
    }>;
    toolCoverage: Array<{
      tool: string;
      timesUsed: number;
      successRate: number;
    }>;
  };
};

export default function Home() {
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EvalResults | null>(null);
  const [autoResults, setAutoResults] = useState<AutoEvalResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [compact, setCompact] = useState(true);
  const [showAllScenarios, setShowAllScenarios] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("auth_code");
    const state = urlParams.get("state");

    if (authCode) {
      console.log("OAuth callback detected, auth code:", authCode);

      // Restore serverUrl from localStorage if available
      const storedServerUrl = localStorage.getItem("mcp-eval-server-url");
      if (storedServerUrl) {
        setServerUrl(storedServerUrl);
      }

      // Clear URL params for cleaner experience
      window.history.replaceState({}, document.title, window.location.pathname);

      // Automatically run authenticated test
      runAuthenticatedTest(authCode, state, storedServerUrl || serverUrl);
    }
  }, []);

  const runAuthenticatedTest = async (
    authCode: string,
    state: string | null,
    url?: string
  ) => {
    setLoading(true);
    setError(null);

    const targetUrl = url || serverUrl;

    if (!targetUrl) {
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
        serverUrl: targetUrl,
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
  };

  const runTests = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setAutoResults(null);
    setStatusMessage("Starting evaluation...");

    try {
      // Use EventSource for Server-Sent Events to get real-time logs
      const eventSource = new EventSource(
        `/api/eval-stream?serverUrl=${encodeURIComponent(serverUrl)}`
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
  };

  const handleOAuthFlow = () => {
    if (authRequired?.oauthUrl) {
      // Store serverUrl and OAuth state for after OAuth redirect
      localStorage.setItem("mcp-eval-server-url", serverUrl);
      localStorage.setItem(
        "mcp-eval-client-info",
        JSON.stringify(authRequired.clientInfo)
      );
      localStorage.setItem("mcp-eval-code-verifier", authRequired.codeVerifier);

      console.log("Storing OAuth state for callback:", {
        clientInfo: !!authRequired.clientInfo,
        codeVerifier: !!authRequired.codeVerifier,
      });

      // Open OAuth authorization in the same window (like Claude.ai does)
      window.location.href = authRequired.oauthUrl;
    } else {
      console.error("No auth URL available:", authRequired);
      alert("OAuth URL not found. Please try running the test again.");
    }
  };

  const runAutoEval = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setAutoResults(null);

    try {
      const response = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, autoEval: true }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to run auto evaluation: ${response.statusText}`
        );
      }

      const data = await response.json();
      setAutoResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && serverUrl && !loading) {
      runTests();
    }
  };

  if (autoResults) {
    return (
      <main className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 py-4">
          <div className="max-w-6xl mx-auto px-6 flex items-center gap-4">
            <button
              onClick={() => {
                setAutoResults(null);
                setError(null);
              }}
              className="text-2xl font-normal text-blue-600 hover:underline"
            >
              MCP Eval
            </button>
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Enter MCP server URL"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Auto Eval Scorecard */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">
                  Auto Evaluation Results
                </h1>
                <p className="text-gray-600">{autoResults.serverUrl}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {autoResults.scorecard.overallScore}/100
                </div>
                <div className="text-sm text-gray-500">Overall Score</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-gray-900">
                {autoResults.scorecard.totalTests}
              </div>
              <div className="text-sm text-gray-600">Total Tests</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-green-600">
                {Math.round(autoResults.scorecard.successRate * 100)}%
              </div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-blue-600">
                {autoResults.scorecard.avgLatency}ms
              </div>
              <div className="text-sm text-gray-600">Avg Latency</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-purple-600">
                {autoResults.discoveredTools.length}
              </div>
              <div className="text-sm text-gray-600">Tools Found</div>
            </div>
          </div>

          {/* Model Performance */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Model Performance</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b text-sm font-medium text-gray-600">
                <div>Model</div>
                <div>Score</div>
                <div>Success Rate</div>
                <div>Performance</div>
              </div>
              {autoResults.scorecard.modelPerformance.map((model, index) => (
                <div
                  key={index}
                  className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium">{model.model}</div>
                  <div className="text-blue-600 font-semibold">
                    {Math.round(model.score)}/100
                  </div>
                  <div>{Math.round(model.successRate * 100)}%</div>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${model.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex gap-4">
              <button
                onClick={runAutoEval}
                className="text-blue-600 hover:underline text-sm"
              >
                Run evaluation again
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Results URL copied to clipboard");
                }}
                className="text-blue-600 hover:underline text-sm"
              >
                Share scorecard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (results) {
    return (
      <main className="min-h-screen bg-white">
        {/* Simple header for results */}
        <div className="border-b border-gray-200 py-4">
          <div className="max-w-4xl mx-auto px-6 flex items-center gap-4">
            <button
              onClick={() => {
                setResults(null);
                setError(null);
              }}
              className="text-2xl font-normal text-blue-600 hover:underline"
            >
              MCP Eval
            </button>
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Enter MCP server URL"
                />
              </div>
            </div>
            <button
              onClick={() => setCompact(!compact)}
              className={`ml-auto px-3 py-1.5 text-xs rounded-full border ${
                compact
                  ? "bg-gray-100 border-gray-300 text-gray-700"
                  : "bg-blue-50 border-blue-300 text-blue-700"
              }`}
              title="Toggle compact view"
            >
              {compact ? "Compact" : "Detailed"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6">
            <div className="text-sm text-gray-600 mb-1">
              About {results.totalTests} results (
              {Date.now() - new Date(results.timestamp).getTime()}ms)
            </div>
            <h2 className="text-xl text-blue-600 mb-1">{results.serverUrl}</h2>
            <div className="text-sm text-gray-600">
              {results.overallPassed}/{results.totalTests} tests passed
            </div>
          </div>

          <div className="space-y-3">
            {results.tests.map((test, index) => {
              const isExpanded = !!expanded[index];
              const showDetails = isExpanded || !compact;
              return (
                <div
                  key={index}
                  className="border-b border-gray-100 pb-3 last:border-b-0"
                >
                  <button
                    className="w-full text-left flex items-start gap-3 group"
                    onClick={() => toggleExpanded(index)}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                        test.passed ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <h3 className="text-base text-blue-600 mb-0.5 group-hover:underline">
                          {test.name}
                        </h3>
                      </div>
                      {showDetails && (
                        <div className="mt-1">
                          {test.message && (
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {test.message}
                            </p>
                          )}
                          {test.duration && (
                            <div className="text-xs text-gray-500 mt-1">
                              {test.duration}ms
                            </div>
                          )}
                          {test.details && (
                            <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 max-h-56 overflow-auto">
                              {JSON.stringify(test.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Generated Test Scenarios */}
          {results?.tests?.find(
            (t) => t.name === "Test Scenario Generation" && t.details?.scenarios
          ) && (
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">
                    🧪 Generated Test Scenarios
                  </h3>
                  <p className="text-purple-800 mb-4">
                    Based on the{" "}
                    {results.tests.find(
                      (t) => t.name === "Authenticated Tool Discovery"
                    )?.details?.toolCount || 0}{" "}
                    discovered tools, we've generated realistic test scenarios:
                  </p>
                  <div className="space-y-3">
                    {(showAllScenarios || !compact
                      ? results.tests.find(
                          (t) => t.name === "Test Scenario Generation"
                        )?.details?.scenarios
                      : results.tests
                          .find((t) => t.name === "Test Scenario Generation")
                          ?.details?.scenarios?.slice(0, 3)
                    )?.map((scenario: any, index: number) => (
                      <div
                        key={index}
                        className="bg-white p-4 rounded-lg border border-purple-100"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {scenario.title}
                          </h4>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              scenario.complexity === "simple"
                                ? "bg-green-100 text-green-800"
                                : scenario.complexity === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {scenario.complexity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {scenario.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">
                            {scenario.category}
                          </span>
                          <span>•</span>
                          <span>
                            {scenario.expectedTools?.length || 0} tools:{" "}
                            {scenario.expectedTools?.join(", ") || "None"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {compact &&
                    (results.tests.find(
                      (t) => t.name === "Test Scenario Generation"
                    )?.details?.scenarios?.length || 0) > 3 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setShowAllScenarios(true)}
                          className="text-sm text-purple-700 hover:underline"
                        >
                          Show all scenarios
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* High-Level User Tasks */}
          {results?.tests?.find(
            (t) => t.name === "High-Level User Tasks" && t.details?.tasks
          ) && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    🧭 High-Level User Tasks
                  </h3>
                  <p className="text-blue-800 mb-4">
                    User-centered tasks that represent realistic goals this MCP
                    server can help accomplish.
                  </p>
                  <div className="space-y-4">
                    {(showAllTasks || !compact
                      ? results.tests.find(
                          (t) => t.name === "High-Level User Tasks"
                        )?.details?.tasks
                      : results.tests
                          .find((t) => t.name === "High-Level User Tasks")
                          ?.details?.tasks?.slice(0, 3)
                    )?.map((task: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-lg border border-blue-100"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {task.title}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {task.description}
                        </div>
                        {Array.isArray(task.expectedTools) &&
                          task.expectedTools.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Suggested tools: {task.expectedTools.join(", ")}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                  {compact &&
                    (results.tests.find(
                      (t) => t.name === "High-Level User Tasks"
                    )?.details?.tasks?.length || 0) > 3 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setShowAllTasks(true)}
                          className="text-sm text-blue-700 hover:underline"
                        >
                          Show all tasks
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* OAuth Authorization Card */}
          {authRequired && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Authentication Required
                  </h3>
                  <p className="text-blue-800 mb-4">
                    This MCP server requires OAuth authentication. Click below
                    to authorize MCP Eval to access your server.
                  </p>
                  <button
                    onClick={handleOAuthFlow}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Authorize Access
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={runTests}
              className="text-blue-600 hover:underline text-sm mr-6"
            >
              Run tests again
            </button>
            <button
              onClick={() => {
                const url = `${
                  window.location.origin
                }/results?data=${encodeURIComponent(JSON.stringify(results))}`;
                navigator.clipboard.writeText(url);
                alert("Results URL copied to clipboard");
              }}
              className="text-blue-600 hover:underline text-sm"
            >
              Share results
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Google-style centered layout */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 -mt-24">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-normal text-gray-900 mb-8 tracking-tight">
            MCP Eval
          </h1>
        </div>

        {/* Google-style search box */}
        <div className="w-full max-w-lg mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter MCP server URL"
              className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:shadow-md transition-shadow"
              disabled={loading}
            />
          </div>
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Example: https://mcp.scorecard.io/mcp
            </p>
          </div>
        </div>

        {/* Google-style buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={runTests}
            disabled={loading || !serverUrl}
            className="px-6 py-2 text-sm text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {loading ? "Evaluating..." : "Auto Eval"}
          </button>
          <button
            onClick={() => setServerUrl("https://mcp.scorecard.io/mcp")}
            className="px-6 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded hover:shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          >
            Try Scorecard
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-600">
              {statusMessage || "Testing MCP server..."}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="max-w-lg w-full">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 text-sm text-gray-600">
            <a href="#" className="hover:underline">
              About
            </a>
            <a href="#" className="hover:underline">
              Documentation
            </a>
            <a href="#" className="hover:underline">
              GitHub
            </a>
            <a href="#" className="hover:underline">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
