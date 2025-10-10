"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

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
        <div className="w-full max-w-4xl px-6 mb-16">
          <h2 className="text-center text-2xl font-semibold text-gray-900 mb-6">
            Example MCP Scorecard
          </h2>
          <p className="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
            See what a comprehensive MCP server evaluation looks like
          </p>
          
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between text-white">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-blue-100">
                    MCP Evaluation Scorecard
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">
                    https://mcp.scorecard.io/mcp
                  </h3>
                  <p className="mt-1 text-sm text-blue-100/90">
                    Tested Oct 10, 2025, 3:45 PM
                  </p>
                </div>
                <div className="flex items-center gap-4 self-start sm:self-center">
                  <div className="rounded-full bg-white/10 px-5 py-3 text-center">
                    <p className="text-[0.7rem] uppercase tracking-wide text-blue-100">
                      Pass Rate
                    </p>
                    <p className="text-4xl font-semibold leading-none">
                      100%
                    </p>
                  </div>
                  <div className="text-sm text-blue-100">
                    <p className="text-lg font-semibold text-white">
                      18 / 18
                    </p>
                    <p>tests passed</p>
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
                  Public
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Server responded to unauthenticated requests
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Resource Discovery
                </p>
                <p className="mt-2 text-base font-medium text-emerald-600">
                  Success
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Discovered 0 resources
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Client Compatibility
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Compatible with OpenAI, Claude.ai, and Cursor
                </p>
                <ul className="mt-3 space-y-1.5">
                  <li className="flex flex-col gap-1 rounded-lg bg-white/70 px-3 py-2 text-sm shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        OpenAI
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        Compatible
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Server exposes 18 tools via MCP integration
                    </p>
                  </li>
                  <li className="flex flex-col gap-1 rounded-lg bg-white/70 px-3 py-2 text-sm shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        Claude.ai
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        Compatible
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      All tools exposed via listTools
                    </p>
                  </li>
                </ul>
              </div>
            </div>

            {/* Example Test Results */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50/50">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">
                Tool Tests
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-slate-900">
                      Tool Test Case: create_projects
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Successfully created project and returned ID
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-slate-900">
                      Tool Test Case: create_testsets
                    </h4>
                    <p className="text-xs text-green-700 mt-1">
                      ✅ Auto-populated: projectId from execution context
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
