'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle, XCircle, Zap, Shield, Code2, Sparkles, Terminal } from 'lucide-react'

type TestResult = {
  name: string
  passed: boolean
  message: string
  duration?: number
}

type EvalResults = {
  serverUrl: string
  overallPassed: number
  totalTests: number
  tests: TestResult[]
  timestamp: Date
}

export default function Home() {
  const [serverUrl, setServerUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<EvalResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTests = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl })
      })

      if (!response.ok) {
        throw new Error(`Failed to run tests: ${response.statusText}`)
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-100 glass-effect sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">MCP Eval</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Docs</a>
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">GitHub</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 mb-6">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">Test MCP servers instantly</span>
          </div>
          
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
            Test Your MCP Server
            <br />
            <span className="text-4xl">in 10 seconds</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Validate your Model Context Protocol implementation with comprehensive testing. 
            Get instant feedback on compatibility and performance.
          </p>
        </div>

        {/* Main Input Section */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 hover-lift">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="Enter your MCP server URL..."
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base transition-all"
                  disabled={loading}
                />
              </div>
              <button
                onClick={runTests}
                disabled={loading || !serverUrl}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 hover-lift"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    Test Now
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              Example: https://mcp.exa.ai/mcp?exaApiKey=your-api-key
            </p>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Protocol Support</p>
                    <p className="text-xs text-blue-700 mt-1">
                      SSE, WebSocket & remote MCP servers
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Instant Results</p>
                    <p className="text-xs text-green-700 mt-1">
                      Get comprehensive test results in seconds
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="max-w-3xl mx-auto mt-8 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Connecting to server...</p>
                    <p className="text-sm text-gray-500">Running comprehensive test suite</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {['Initializing connection', 'Testing protocol compliance', 'Validating responses'].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-3xl mx-auto mt-8 animate-fade-in">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Test Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="max-w-4xl mx-auto mt-8 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Results Header */}
              <div className="bg-gradient-to-r from-gray-50 to-white p-8 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Test Results
                    </h2>
                    <p className="text-sm text-gray-600">
                      {results.serverUrl}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">
                      {results.overallPassed}/{results.totalTests}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                      results.overallPassed === results.totalTests 
                        ? 'bg-green-100 text-green-800' 
                        : results.overallPassed > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {results.overallPassed === results.totalTests ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          All Passed
                        </>
                      ) : results.overallPassed > 0 ? (
                        <>Partial Success</>
                      ) : (
                        <>Failed</>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Test Items */}
              <div className="p-8 space-y-3">
                {results.tests.map((test, index) => (
                  <div 
                    key={index} 
                    className={`border rounded-xl p-5 transition-all hover:shadow-md ${
                      test.passed ? 'border-gray-200 hover:border-green-300' : 'border-red-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">
                          {test.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{test.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                        </div>
                      </div>
                      {test.duration && (
                        <span className="text-sm text-gray-400 font-mono">
                          {test.duration}ms
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="bg-gray-50 px-8 py-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={runTests}
                  className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all hover-lift"
                >
                  Run Again
                </button>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/results?data=${encodeURIComponent(JSON.stringify(results))}`
                    navigator.clipboard.writeText(url)
                    alert('Share URL copied to clipboard!')
                  }}
                  className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all hover-lift"
                >
                  Share Results
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Features Section */}
      {!results && !loading && (
        <section className="px-6 py-20 border-t border-gray-100 bg-gradient-to-b from-gray-50/50 to-white">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Why MCP Eval?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-all hover-lift">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Lightning Fast</h3>
                <p className="text-gray-600 text-sm">Get comprehensive test results in under 10 seconds</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-all hover-lift">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Protocol Compliant</h3>
                <p className="text-gray-600 text-sm">Validates against official MCP specifications</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-all hover-lift">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4">
                  <Code2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Developer Friendly</h3>
                <p className="text-gray-600 text-sm">Clear feedback with actionable insights</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}