"use client";

import { Search } from "lucide-react";
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
}

export default function Results({
  results,
  serverUrl,
  authRequired,
  handleOAuthFlow,
}: ResultsProps) {

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

      {/* Results */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {results.tests.map((test, index) => (
            <details
              key={index}
              className="border-b border-gray-100 pb-3 last:border-b-0"
              open={true}
            >
              <summary className="cursor-pointer flex items-start gap-3 group list-none">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                    test.passed ? "bg-green-500" : "bg-red-500"
                  }`}
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
                  <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 max-h-56 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(test.details, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          ))}
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
