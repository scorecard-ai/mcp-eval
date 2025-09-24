"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export default function Home() {
  const [serverUrl, setServerUrl] = useState("");
  const router = useRouter();

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
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Example: https://mcp.scorecard.io/mcp
            </p>
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
          <button
            onClick={() => setServerUrl("https://mcp.scorecard.io/mcp")}
            className="px-6 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded hover:shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          >
            Try Scorecard
          </button>
        </div>
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
