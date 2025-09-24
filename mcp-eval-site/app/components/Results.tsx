"use client";

import { Search, PlayCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { EvaluationResult } from "@/app/types/mcp-eval";

interface ResultsProps {
  results: EvaluationResult;
  serverUrl: string;
  authRequired: {
    oauthUrl?: string;
    clientInfo?: any;
    codeVerifier?: string;
  } | null;
  handleOAuthFlow: () => void;
  accessToken?: string;
}

export default function Results({
  results,
  serverUrl,
  authRequired,
  handleOAuthFlow,
  accessToken,
}: ResultsProps) {
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set());
  const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());
  const [executingAll, setExecutingAll] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState<{
    testName: string;
    toolName: string;
    description: string;
    arguments: any;
  } | null>(null);

  const hasExecutableTools = results.tests.some(
    (test) => test.details?.requiresPermission
  );

  async function executeToolWithPermission(test: any) {
    const { toolName, sampleArguments } = test.details;

    // Show permission dialog
    setShowPermissionDialog({
      testName: test.name,
      toolName,
      description: test.details.description,
      arguments: sampleArguments,
    });
  }

  async function runToolExecution(
    testName: string,
    toolName: string,
    toolArgs: any
  ) {
    setExecutingTools((prev) => new Set(prev).add(testName));

    try {
      const response = await fetch("/api/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          toolName,
          arguments: toolArgs,
          // Include auth token if available (from props or from results)
          authToken: accessToken || results.accessToken,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setToolResults((prev) =>
          new Map(prev).set(testName, {
            ...result,
            error: result.error || "Unknown error occurred",
            formattedError: true,
          })
        );
      } else {
        setToolResults((prev) => new Map(prev).set(testName, result));
      }
    } catch (error) {
      setToolResults((prev) =>
        new Map(prev).set(testName, {
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        })
      );
    } finally {
      setExecutingTools((prev) => {
        const newSet = new Set(prev);
        newSet.delete(testName);
        return newSet;
      });
    }
  }

  async function handleToolExecution(approved: boolean) {
    if (!showPermissionDialog || !approved) {
      setShowPermissionDialog(null);
      return;
    }

    const { testName, toolName, arguments: toolArgs } = showPermissionDialog;
    setShowPermissionDialog(null);

    await runToolExecution(testName, toolName, toolArgs);
  }

  async function executeAllTools() {
    const testsToExecute = results.tests.filter(
      (test) => test.details?.requiresPermission
    );

    if (testsToExecute.length === 0) {
      alert("No tools available for execution.");
      return;
    }

    const confirmed = window.confirm(
      `Execute ${testsToExecute.length} tool${
        testsToExecute.length > 1 ? "s" : ""
      } with their sample arguments?`
    );

    if (!confirmed) return;

    setExecutingAll(true);

    try {
      const executionPromises = testsToExecute.map(async (test) => {
        const toolName = test.details?.toolName;
        const toolArgs = test.details?.sampleArguments;

        if (!toolName) {
          setToolResults((prev) =>
            new Map(prev).set(test.name, {
              success: false,
              error: "Tool name not provided for execution",
            })
          );
          return;
        }

        if (typeof toolArgs === "undefined") {
          setToolResults((prev) =>
            new Map(prev).set(test.name, {
              success: false,
              error: "Sample arguments not available for this tool",
            })
          );
          return;
        }

        await runToolExecution(test.name, toolName, toolArgs);
      });

      await Promise.all(executionPromises);
    } finally {
      setExecutingAll(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Simple header for results */}
      <div className="border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center gap-4">
          <span>MCP Eval</span>
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={serverUrl}
                disabled
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-sm"
                placeholder="Enter MCP server URL"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Permission Dialog */}
      {showPermissionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Permission Required
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  The tool <strong>{showPermissionDialog.toolName}</strong>{" "}
                  wants to execute with the following arguments:
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded p-3 mb-4">
              <p className="text-xs text-gray-500 mb-2">Tool Description:</p>
              <p className="text-sm text-gray-700 mb-3">
                {showPermissionDialog.description}
              </p>
              <p className="text-xs text-gray-500 mb-2">Arguments:</p>
              <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32">
                {JSON.stringify(showPermissionDialog.arguments, null, 2)}
              </pre>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleToolExecution(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToolExecution(true)}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Execute Tool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={executeAllTools}
            disabled={!hasExecutableTools || executingAll || executingTools.size > 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executingAll ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Executing all...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                Execute all
              </>
            )}
          </button>
        </div>
        <div className="space-y-3">
          {results.tests.map((test, index) => {
            const executionResult = toolResults.get(test.name);
            const statusClass = executionResult?.success
              ? "bg-green-500"
              : test.passed
              ? "bg-green-500"
              : "bg-red-500";
            return (
              <details
                key={index}
                className="border-b border-gray-100 pb-3 last:border-b-0"
                open={true}
              >
                <summary className="cursor-pointer flex items-start gap-3 group list-none">
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${statusClass}`}
                  />
                  <h3 className="text-base text-blue-600 mb-0.5 group-hover:underline select-none">
                    {test.name}
                  </h3>
                </summary>
                <div className="mt-2 ml-5">
                  {test.message && (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {test.message}
                    </p>
                  )}
                  {test.details && (
                    <>
                      {test.details.requiresPermission &&
                        !test.details.executed && (
                          <div className="mt-3">
                            <button
                              onClick={() => executeToolWithPermission(test)}
                              disabled={executingTools.has(test.name)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {executingTools.has(test.name) ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  Executing...
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="w-4 h-4" />
                                  Execute Tool
                                </>
                              )}
                            </button>
                          </div>
                        )}

                      {toolResults.has(test.name) && (
                        <div className={`mt-3 p-3 border rounded ${
                          toolResults.get(test.name)?.success
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}>
                          <p className={`text-xs font-semibold mb-1 ${
                            toolResults.get(test.name)?.success
                              ? "text-green-700"
                              : "text-red-700"
                          }`}>
                            {toolResults.get(test.name)?.success
                              ? "✅ Execution Successful"
                              : "❌ Execution Failed"}
                          </p>
                          {toolResults.get(test.name)?.error && (
                            <div className="text-xs text-red-600 mb-2">
                              Error: {toolResults.get(test.name).error}
                            </div>
                          )}
                          <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32">
                            {JSON.stringify(
                              toolResults.get(test.name)?.result ||
                              toolResults.get(test.name)?.details ||
                              toolResults.get(test.name),
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}

                      <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 max-h-56 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            );
          })}
        </div>

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
                  This MCP server requires OAuth authentication. Click below to
                  authorize MCP Eval to access your server.
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
