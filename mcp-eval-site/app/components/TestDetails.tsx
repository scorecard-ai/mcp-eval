"use client";

import { PlayCircle } from "lucide-react";
import type { TestResult } from "@/app/types/mcp-eval";

interface TestDetailsProps {
  test: TestResult;
  statusClass: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onRequestExecute: (test: TestResult) => void;
  isExecuting: boolean;
  executionResult?: any;
}

export default function TestDetails({
  test,
  statusClass,
  isOpen,
  onToggle,
  onRequestExecute,
  isExecuting,
  executionResult,
}: TestDetailsProps) {
  const showExecutionButton =
    test.details?.requiresPermission && !test.details?.executed;

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const element = event.currentTarget;
    onToggle(element.open);
  };

  const renderExecutionResult = () => {
    if (!executionResult) return null;

    const success = Boolean(executionResult.success);
    const containerColor = success
      ? "bg-green-50 border-green-200"
      : "bg-red-50 border-red-200";
    const labelColor = success ? "text-green-700" : "text-red-700";
    const labelText = success
      ? "✅ Execution Successful"
      : "❌ Execution Failed";

    const resultPayload =
      executionResult.result || executionResult.details || executionResult;

    return (
      <div className={`mt-3 p-3 border rounded ${containerColor}`}>
        <p className={`text-xs font-semibold mb-1 ${labelColor}`}>
          {labelText}
        </p>
        {executionResult.error && (
          <div className="text-xs text-red-600 mb-2">
            Error: {executionResult.error}
          </div>
        )}
        <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32">
          {JSON.stringify(resultPayload, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <details
      className="border-b border-gray-100 pb-3 last:border-b-0"
      open={isOpen}
      onToggle={handleToggle}
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
            {showExecutionButton && (
              <div className="mt-3">
                <button
                  onClick={() => onRequestExecute(test)}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? (
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

            {renderExecutionResult()}

            <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 max-h-56 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(test.details, null, 2)}
            </pre>
          </>
        )}
      </div>
    </details>
  );
}
