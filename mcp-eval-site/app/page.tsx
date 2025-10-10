"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import DonutChart from "./components/DonutChart";

export default function Home() {
  const [serverUrl, setServerUrl] = useState("");
  const router = useRouter();

  const examples = [
    { name: "Scorecard", url: "https://mcp.scorecard.io/mcp" },
    { name: "Sentry", url: "https://mcp.sentry.dev/mcp" },
    { name: "Linear", url: "https://mcp.linear.app/mcp" },
    { name: "Notion", url: "https://mcp.notion.com/mcp" },
  ];

  function handleEvaluate() {
    if (!serverUrl) return;
    router.push(`/results?url=${encodeURIComponent(serverUrl)}`);
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && serverUrl) {
      handleEvaluate();
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Google-style centered layout */}
      <div className="flex flex-col justify-center items-center px-6 py-16">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-normal text-gray-900 mb-8 tracking-tight">
            MCP Eval
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Evaluate and test Model Context Protocol (MCP) servers with automated tool execution and validation
          </p>
        </div>

        {/* Google-style search box */}
        <div className="w-full max-w-lg mb-4">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter MCP server URL"
              className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:shadow-md transition-shadow"
              autoFocus
            />
          </div>
        </div>

        {/* Google-style buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={handleEvaluate}
            disabled={!serverUrl}
            className="px-6 py-2 text-sm text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Evaluate
          </button>
        </div>

        <div className="w-full max-w-lg mb-10 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">
            Try one of these
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <button
                key={example.name}
                onClick={() => setServerUrl(example.url)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-full hover:border-gray-400 hover:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>

        {/* Section Divider */}
        <div className="w-full max-w-2xl px-6 my-12">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-sm text-gray-500">
                Example
              </span>
            </div>
          </div>
        </div>

        {/* Example MCP Scorecard Section */}
        <div className="w-full max-w-6xl px-6 mb-16">
          <h2 className="text-center text-2xl font-semibold text-gray-900 mb-6">
            Example MCP Scorecard
          </h2>
          <p className="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
            See what a comprehensive MCP server evaluation looks like
          </p>
          
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            {/* Header with URL */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    MCP Server Evaluation
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    https://mcp.scorecard.io/mcp
                  </h3>
                </div>
                <div className="text-xs text-slate-500">
                  Tested Oct 10, 2025, 3:45 PM
                </div>
              </div>
            </div>

            {/* Lighthouse-style metrics with donuts */}
            <div className="bg-slate-50 px-8 py-10">
              <div className="flex justify-center items-center gap-10 flex-wrap">
                <DonutChart score={100} label="Test Pass Rate" size={112} strokeWidth={8} />
                <DonutChart score={94} label="Tool Execution" size={112} strokeWidth={8} />
                <DonutChart score={100} label="Resource Discovery" size={112} strokeWidth={8} />
                <DonutChart score={87} label="Client Support" size={112} strokeWidth={8} />
              </div>
            </div>

            {/* Detailed metrics */}
            <div className="grid gap-6 p-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Authentication
                  </p>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <p className="text-base font-semibold text-slate-900 mb-1">
                  Public Access
                </p>
                <p className="text-sm text-slate-600 mb-3">
                  Server responded to unauthenticated requests
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Response Time</span>
                    <span className="font-medium text-slate-700">142ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection Test</span>
                    <span className="font-medium text-green-600">✓ Passed</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Tools Discovered
                  </p>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-1">
                  18
                </p>
                <p className="text-sm text-slate-600 mb-3">
                  All tools successfully enumerated
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Executable</span>
                    <span className="font-medium text-slate-700">18/18</span>
                  </div>
                  <div className="flex justify-between">
                    <span>With Examples</span>
                    <span className="font-medium text-green-600">✓ All</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Resource Discovery
                  </p>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <p className="text-base font-semibold text-emerald-600 mb-1">
                  Success
                </p>
                <p className="text-sm text-slate-600 mb-3">
                  0 resources discovered
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Schema Valid</span>
                    <span className="font-medium text-green-600">✓ Yes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Templates</span>
                    <span className="font-medium text-slate-700">0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Compatibility Section */}
            <div className="border-t border-slate-200 px-6 py-5 bg-slate-50/50">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">
                Client Compatibility
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-slate-200 shadow-sm">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                      O
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-sm">
                        OpenAI
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        ✓ Compatible
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      18 tools accessible
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-slate-200 shadow-sm">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                      C
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-sm">
                        Claude.ai
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        ✓ Compatible
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      All tools via listTools
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-slate-200 shadow-sm">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      ⌃
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-sm">
                        Cursor
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        ✓ Compatible
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      MCP integration active
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="border-t border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Test Execution Results
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 font-semibold">18 passed</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">0 failed</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">
                        create_projects
                      </h4>
                      <span className="text-xs text-green-700 font-medium">128ms</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Successfully created project and returned ID
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">
                        create_testsets
                      </h4>
                      <span className="text-xs text-green-700 font-medium">95ms</span>
                    </div>
                    <p className="text-xs text-green-700 mt-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      Auto-populated: projectId from execution context
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex justify-center gap-6 text-sm text-gray-600">
              <a
                href="https://github.com/scorecard-ai/mcp-eval#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                About
              </a>
              <a
                href="https://github.com/scorecard-ai/mcp-eval"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                GitHub
              </a>
              <a
                href="https://discord.gg/keUXXXdR"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Discord
              </a>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Powered by</span>
              <a
                href="https://scorecard.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Scorecard AI
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
