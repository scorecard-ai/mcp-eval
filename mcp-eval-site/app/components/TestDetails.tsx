"use client";

import { useEffect } from "react";
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
  prerequisites?: string[];
  hasRegeneratedArgs?: boolean;
  autoPopulatedFields?: string[];
}

export default function TestDetails({
  test,
  statusClass,
  isOpen,
  onToggle,
  onRequestExecute,
  isExecuting,
  executionResult,
  prerequisites,
  hasRegeneratedArgs,
  autoPopulatedFields,
}: TestDetailsProps) {
  // Debug: Log props received
  useEffect(() => {
    if (test.details?.toolName && test.details?.requiresPermission) {
      console.log(`🎨 [TestDetails] Rendering ${test.details.toolName}`, {
        autoPopulatedFields,
        hasRegeneratedArgs,
        sampleArguments: test.details.sampleArguments,
      });
    }
  }, [autoPopulatedFields, hasRegeneratedArgs, test.details?.sampleArguments, test.details?.toolName, test.details?.requiresPermission]);

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
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-base text-blue-600 mb-0.5 group-hover:underline select-none">
            {test.name}
          </h3>
          {hasRegeneratedArgs && (
            <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded" title="Arguments enhanced with execution context">
              ✨ Regenerated Dataset
            </span>
          )}
        </div>
      </summary>
      <div className="mt-2 ml-5">
        {test.message && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {test.message}
          </p>
        )}
        {test.details && (
          <>
            {autoPopulatedFields && autoPopulatedFields.length > 0 && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                ✅ <strong>Auto-populated:</strong> <span className="font-mono">{autoPopulatedFields.join(", ")}</span> from execution context
              </div>
            )}
            {prerequisites && prerequisites.length > 0 && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                💡 <strong>Tip:</strong> Execute <span className="font-mono">{prerequisites.join(", ")}</span> first to auto-populate required fields
              </div>
            )}
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
