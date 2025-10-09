"use client";

import { Search, PlayCircle, AlertTriangle, Link, Check, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EvaluationResult } from "@/app/types/mcp-eval";
import TestDetails from "./TestDetails";
import NextLink from "next/link";

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
  const [editedArguments, setEditedArguments] = useState<string>("");
  const [argumentsError, setArgumentsError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const hasExecutableTools = results.tests.some(
    (test) => test.details?.requiresPermission
  );

  useEffect(() => {
    setOpenSections({});
  }, [results.serverUrl, results.timestamp]);

  useEffect(() => {
    setOpenSections((prev) => {
      const nextState: Record<string, boolean> = { ...prev };

      results.tests.forEach((test) => {
        const executionResult = toolResults.get(test.name);
        const requiresPermission = Boolean(test.details?.requiresPermission);
        const hasExecuted =
          !requiresPermission ||
          Boolean(test.details?.executed) ||
          Boolean(executionResult);

        const success = executionResult
          ? Boolean(executionResult.success)
          : Boolean(test.passed);

        if (!(test.name in nextState)) {
          nextState[test.name] = hasExecuted ? !success : false;
        }

        if (hasExecuted && success) {
          nextState[test.name] = false;
        }
      });

      return nextState;
    });
  }, [results.tests, toolResults]);

  const scorecard = useMemo(() => {
    const executedToolEntries = Array.from(toolResults.entries());
    const executedToolNames = new Set(
      executedToolEntries.map(([name]) => name)
    );

    let executedCount = 0;
    let passedCount = 0;

    results.tests.forEach((test) => {
      const requiresPermission = Boolean(test.details?.requiresPermission);
      const executionResult = toolResults.get(test.name);
      const executed =
        !requiresPermission ||
        Boolean(test.details?.executed) ||
        executedToolNames.has(test.name);

      if (!executed) {
        return;
      }

      executedCount += 1;

      const passed = executionResult
        ? Boolean(executionResult.success)
        : Boolean(test.passed);

      if (passed) {
        passedCount += 1;
      }
    });

    const pendingCount = results.tests.length - executedCount;
    const passRate =
      executedCount > 0
        ? Math.round((passedCount / executedCount) * 100)
        : null;

    const timestamp = new Date(results.timestamp);
    const testedAt = Number.isNaN(timestamp.getTime())
      ? `${results.timestamp}`
      : timestamp.toLocaleString();

    const authConnectionTest = results.tests.find(
      (test) => test.name === "Authenticated MCP Connection"
    );
    const oauthRequiredTest = results.tests.find(
      (test) => test.name === "OAuth Required"
    );
    const oauthFailureTest = results.tests.find((test) =>
      ["OAuth Setup Failed", "OAuth Authentication"].includes(test.name)
    );

    let authLabel = "Public (no authentication detected)";
    let authDetail = "Server responded to unauthenticated requests.";

    if (authConnectionTest) {
      authLabel = "OAuth (authenticated)";
      authDetail =
        authConnectionTest.message ||
        "Successfully connected using OAuth credentials.";
    } else if (oauthRequiredTest) {
      authLabel = oauthFailureTest
        ? "OAuth required (setup failed)"
        : "OAuth required";
      authDetail =
        oauthFailureTest?.message ||
        oauthRequiredTest.message ||
        "Server indicated OAuth is required.";
    }

    const compatibilityTest = [...results.tests]
      .reverse()
      .find((test) => test.name === "Client Compatibility");

    const compatibilityDetails = Array.isArray(
      (compatibilityTest?.details as any)?.compatibility
    )
      ? (compatibilityTest?.details as any)?.compatibility
      : [];

    type CompatibilityEntry = {
      client: string;
      compatible: boolean;
      reason?: string;
    };

    const compatibilityEntries: CompatibilityEntry[] = compatibilityDetails.map(
      (entry: any) => ({
        client: entry.client,
        compatible: entry.compatible,
        reason: entry.reason,
      })
    );

    const resourceTest = [...results.tests]
      .reverse()
      .find((test) => test.name.includes("Resource Discovery"));

    const resourceStatus = resourceTest
      ? resourceTest.passed
        ? "Success"
        : "Failed"
      : "Not attempted";

    const resourceDetail =
      resourceTest?.message ||
      (resourceStatus === "Not attempted"
        ? "Resource discovery was not part of this evaluation."
        : undefined);

    return {
      serverUrl: results.serverUrl,
      testedAt,
      auth: {
        label: authLabel,
        detail: authDetail,
      },
      compatibility: {
        summary: compatibilityTest?.message || "Compatibility not evaluated",
        entries: compatibilityEntries,
      },
      resources: {
        status: resourceStatus,
        detail: resourceDetail,
      },
      tests: {
        passed: passedCount,
        executed: executedCount,
        pending: pendingCount,
        total: results.tests.length,
        passRate,
      },
    };
  }, [results, toolResults]);

  async function executeToolWithPermission(test: any) {
    const { toolName, sampleArguments } = test.details;

    // Show permission dialog
    setShowPermissionDialog({
      testName: test.name,
      toolName,
      description: test.details.description,
      arguments: sampleArguments,
    });
    // Initialize edited arguments with formatted JSON
    setEditedArguments(JSON.stringify(sampleArguments, null, 2));
    setArgumentsError(null);
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
        setOpenSections((prev) => ({ ...prev, [testName]: true }));
      } else {
        setToolResults((prev) => new Map(prev).set(testName, result));
        setOpenSections((prev) => ({ ...prev, [testName]: false }));
      }
    } catch (error) {
      setToolResults((prev) =>
        new Map(prev).set(testName, {
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        })
      );
      setOpenSections((prev) => ({ ...prev, [testName]: true }));
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
      setArgumentsError(null);
      return;
    }

    // Parse and validate the edited arguments
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(editedArguments);
    } catch (error) {
      setArgumentsError("Invalid JSON: " + (error instanceof Error ? error.message : "Unable to parse"));
      return;
    }

    const { testName, toolName } = showPermissionDialog;
    setShowPermissionDialog(null);
    setArgumentsError(null);

    await runToolExecution(testName, toolName, parsedArgs);
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

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Simple header for results */}
      <div className="border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center gap-4">
          <NextLink 
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
            title="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </NextLink>
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
              <div className="text-sm text-gray-700 mb-3 max-h-24 overflow-y-auto pr-2">
                {showPermissionDialog.description}
              </div>
              <p className="text-xs text-gray-500 mb-2">Arguments (editable):</p>
              <textarea
                value={editedArguments}
                onChange={(e) => {
                  setEditedArguments(e.target.value);
                  setArgumentsError(null);
                }}
                className="w-full text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32 min-h-[8rem] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                spellCheck={false}
              />
              {argumentsError && (
                <p className="text-xs text-red-600 mt-1">{argumentsError}</p>
              )}
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
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-blue-100">
                  MCP Evaluation Scorecard
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {scorecard.serverUrl}
                </h2>
                <p className="mt-1 text-sm text-blue-100/90">
                  Tested {scorecard.testedAt}
                </p>
              </div>
              <div className="flex items-center gap-4 self-start sm:self-center">
                <div className="rounded-full bg-white/10 px-5 py-3 text-center">
                  <p className="text-[0.7rem] uppercase tracking-wide text-blue-100">
                    Pass Rate
                  </p>
                  <p className="text-4xl font-semibold leading-none">
                    {scorecard.tests.passRate !== null
                      ? `${scorecard.tests.passRate}%`
                      : "—"}
                  </p>
                </div>
                <div className="text-sm text-blue-100">
                  <p className="text-lg font-semibold text-white">
                    {scorecard.tests.passed} / {scorecard.tests.executed}
                  </p>
                  <p>tests passed</p>
                  {scorecard.tests.pending > 0 && (
                    <p className="text-xs text-blue-100/80 mt-1">
                      {scorecard.tests.pending} pending
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Authentication
              </p>
              <p className="mt-2 text-base font-medium text-slate-900">
                {scorecard.auth.label}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {scorecard.auth.detail}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Resource Discovery
              </p>
              <p
                className={`mt-2 text-base font-medium ${
                  scorecard.resources.status === "Success"
                    ? "text-emerald-600"
                    : scorecard.resources.status === "Failed"
                    ? "text-rose-600"
                    : "text-slate-700"
                }`}
              >
                {scorecard.resources.status}
              </p>
              {scorecard.resources.detail && (
                <p className="mt-1 text-sm text-slate-600">
                  {scorecard.resources.detail}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Client Compatibility
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {scorecard.compatibility.summary}
              </p>
              <ul className="mt-3 space-y-1.5">
                {scorecard.compatibility.entries.length > 0 ? (
                  scorecard.compatibility.entries.map((entry) => (
                    <li
                      key={entry.client}
                      className="flex flex-col gap-1 rounded-lg bg-white/70 px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">
                          {entry.client}
                        </span>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            entry.compatible
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {entry.compatible ? "Compatible" : "Needs Attention"}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="text-xs text-slate-600">{entry.reason}</p>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-slate-600">
                    Compatibility data not available.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Link className="w-4 h-4" />
                Copy link
              </>
            )}
          </button>
          <button
            onClick={executeAllTools}
            disabled={
              !hasExecutableTools || executingAll || executingTools.size > 0
            }
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
            const requiresPermission = Boolean(
              test.details?.requiresPermission
            );
            const hasExecutedResult = Boolean(executionResult);
            const wasExecuted =
              !requiresPermission ||
              Boolean(test.details?.executed) ||
              hasExecutedResult;

            let statusClass = "bg-gray-300";

            if (hasExecutedResult) {
              statusClass = executionResult?.success
                ? "bg-green-500"
                : "bg-red-500";
            } else if (!requiresPermission || wasExecuted) {
              statusClass = test.passed ? "bg-green-500" : "bg-red-500";
            }

            const hasBeenExecuted =
              hasExecutedResult ||
              !requiresPermission ||
              Boolean(test.details?.executed);
            const success = executionResult
              ? Boolean(executionResult.success)
              : Boolean(test.passed);
            const computedDefaultOpen = hasBeenExecuted ? !success : false;
            const isOpen = openSections[test.name] ?? computedDefaultOpen;

            return (
              <TestDetails
                key={index}
                test={test}
                statusClass={statusClass}
                isOpen={isOpen}
                onToggle={(open) =>
                  setOpenSections((prev) => ({ ...prev, [test.name]: open }))
                }
                onRequestExecute={executeToolWithPermission}
                isExecuting={executingTools.has(test.name)}
                executionResult={executionResult}
              />
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
      </div>
    </main>
  );
}
