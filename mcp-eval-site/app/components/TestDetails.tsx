"use client";

import { useEffect, useState } from "react";
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
  const [activeTab, setActiveTab] = useState<string>("arguments-result");

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

  // Determine which tabs to show based on available data
  const availableTabs = [
    { id: "arguments-result", label: "Results", show: test.details?.sampleArguments || test.details?.arguments || executionResult || test.details?.result },
    { id: "description", label: "Description", show: test.details?.description },
    { id: "schema", label: "Schema", show: test.details?.inputSchema },
    { id: "tools", label: "Tools", show: test.details?.tools || test.details?.toolNames },
    { id: "resources", label: "Resources", show: test.details?.resources || test.details?.resourceCount },
    { id: "compatibility", label: "Compatibility", show: test.details?.compatibility },
  ].filter(tab => tab.show);

  // Reset to first available tab when details open
  useEffect(() => {
    if (isOpen && availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [isOpen, availableTabs, activeTab]);

  const renderTabContent = () => {
    if (!test.details) return null;

    switch (activeTab) {
      case "description":
        return (
          <div className="bg-slate-50 border border-slate-200 rounded p-4">
            <div className="text-sm bg-white border border-slate-200 rounded p-3 text-slate-700 overflow-auto max-h-80">
              {test.details.description}
            </div>
          </div>
        );
      
      case "schema":
        return (
          <div className="bg-slate-50 border border-slate-200 rounded p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Input Schema</p>
            <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
              {JSON.stringify(test.details.inputSchema, null, 2)}
            </pre>
          </div>
        );
      
      case "arguments-result":
        const args = test.details.sampleArguments || test.details.arguments;
        const resultData = executionResult || test.details.result;
        return (
          <div className="bg-slate-50 border border-slate-200 rounded p-4">
            <div className="space-y-3">
              {/* Execution Status */}
              {executionResult && (
                <div className={`p-3 border rounded ${
                  executionResult.success 
                    ? "bg-green-50 border-green-200 text-green-800" 
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                  <p className="text-sm font-semibold">
                    {executionResult.success ? "✅ Execution Successful" : "❌ Execution Failed"}
                  </p>
                </div>
              )}
              
              {/* Arguments/Inputs */}
              {args && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    Arguments
                  </p>
                  <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Result Data */}
              {resultData && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    {executionResult ? "Execution Result" : "Result"}
                  </p>
                  <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                    {JSON.stringify(resultData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      
      case "tools":
        const toolsData = test.details.tools || test.details.toolNames;
        return (
          <div className="bg-slate-50 border border-slate-200 rounded p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Discovered Tools</p>
            {Array.isArray(test.details.toolNames) ? (
              <div className="space-y-1 overflow-auto max-h-80">
                {test.details.toolNames.map((name, idx) => (
                  <div key={idx} className="text-sm font-mono bg-white px-2 py-1 rounded border border-slate-200">
                    {name}
                  </div>
                ))}
              </div>
            ) : (
              <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                {JSON.stringify(toolsData, null, 2)}
              </pre>
            )}
          </div>
        );
      
      case "resources":
        return (
          <div className="bg-slate-50 border border-slate-200 rounded p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Resources</p>
            <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
              {JSON.stringify(test.details.resources || { count: test.details.resourceCount }, null, 2)}
            </pre>
          </div>
        );
      
      case "compatibility":
        return (
          <div className="bg-slate-50 border border-slate-200 rounded p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3">Client Compatibility</p>
            <div className="space-y-2 overflow-auto max-h-80">
              {test.details.compatibility?.map((item, idx) => (
                <div key={idx} className={`p-3 border rounded ${
                  item.compatible 
                    ? "bg-green-50 border-green-200" 
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">{item.client}</p>
                    <span className={`text-xs font-semibold ${
                      item.compatible ? "text-green-700" : "text-red-700"
                    }`}>
                      {item.compatible ? "✓ Compatible" : "✗ Issues"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        );
      
      default:
        return null;
    }
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
        </div>
        {showExecutionButton && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestExecute(test);
            }}
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
        )}
      </summary>
      <div className="mt-2 ml-5">
        {test.message && (
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {test.message}
          </p>
        )}
        
        {autoPopulatedFields && autoPopulatedFields.length > 0 && (
          <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
            ✅ <strong>Auto-populated:</strong> <span className="font-mono">{autoPopulatedFields.join(", ")}</span> from execution context
          </div>
        )}
        
        {prerequisites && prerequisites.length > 0 && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            💡 <strong>Tip:</strong> Execute <span className="font-mono">{prerequisites.join(", ")}</span> first to auto-populate required fields
          </div>
        )}

        {test.details && (
          <>
            {/* Tabs */}
            <div className="border-b border-slate-200 mb-3">
              <div className="flex flex-wrap gap-1">
                {availableTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="mt-3">
              {renderTabContent()}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
