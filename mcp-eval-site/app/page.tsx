'use client'

import { useState, useEffect } from 'react'
import { Search, Zap, TestTube } from 'lucide-react'

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

type AutoEvalResults = {
  type: 'auto-eval'
  serverUrl: string
  timestamp: Date
  discoveredTools: Array<{ name: string; description: string }>
  generatedTasks: Array<{ id: string; title: string; description: string; difficulty: string }>
  results: Array<{ taskId: string; model: string; success: boolean; score: number; reasoning: string }>
  scorecard: {
    overallScore: number
    totalTests: number
    successRate: number
    avgLatency: number
    avgTokens: number
    modelPerformance: Array<{ model: string; score: number; successRate: number }>
    toolCoverage: Array<{ tool: string; timesUsed: number; successRate: number }>
  }
}

export default function Home() {
  const [serverUrl, setServerUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<EvalResults | null>(null)
  const [autoResults, setAutoResults] = useState<AutoEvalResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState<any>(null)

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const authCode = urlParams.get('auth_code')
    const state = urlParams.get('state')
    
    if (authCode) {
      console.log('OAuth callback detected, auth code:', authCode)
      
      // Restore serverUrl from localStorage if available
      const storedServerUrl = localStorage.getItem('mcp-eval-server-url')
      if (storedServerUrl) {
        setServerUrl(storedServerUrl)
      }
      
      // Clear URL params for cleaner experience
      window.history.replaceState({}, document.title, window.location.pathname)
      
      // Automatically run authenticated test
      runAuthenticatedTest(authCode, state, storedServerUrl || serverUrl)
    }
  }, [])

  const runAuthenticatedTest = async (authCode: string, state: string | null, url?: string) => {
    setLoading(true)
    setError(null)
    
    const targetUrl = url || serverUrl
    
    if (!targetUrl) {
      setError('Server URL is required for authentication')
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          serverUrl: targetUrl,
          authCode,
          state
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Authenticated test results:', data)
      
      setResults({
        serverUrl,
        overallPassed: data.tests?.filter((t: TestResult) => t.passed).length || 0,
        totalTests: data.tests?.length || 0,
        tests: data.tests || [],
        timestamp: new Date()
      })
      
      // Clear auth required since we're now authenticated
      setAuthRequired(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const runTests = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    setAutoResults(null)

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
      
      // Debug: log the test results to see the structure
      console.log('Test results:', data.tests)
      data.tests?.forEach((test: any, index: number) => {
        console.log(`Test ${index} (${test.name}):`, test)
        if (test.details) {
          console.log(`  Details:`, test.details)
        }
      })
      
      // Check if OAuth is required from any test result - be more thorough
      const authTest = data.tests?.find((t: any) => {
        const hasAuth = t.details?.requiresAuth || 
                       t.details?.authUrl || 
                       t.details?.authorizationEndpoint ||
                       t.name?.includes('OAuth') ||
                       t.message?.includes('OAuth')
        
        if (hasAuth) {
          console.log('Found auth test:', t.name, t.details)
        }
        
        return hasAuth
      })
      
      if (authTest) {
        console.log('Auth required, setting details:', authTest.details)
        setAuthRequired(authTest.details)
      } else {
        console.log('No auth required in any test')
        setAuthRequired(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthFlow = () => {
    if (authRequired?.authUrl) {
      // Store serverUrl for after OAuth redirect
      localStorage.setItem('mcp-eval-server-url', serverUrl)
      
      // Open OAuth authorization in the same window (like Claude.ai does)
      window.location.href = authRequired.authUrl
    } else {
      console.error('No auth URL available:', authRequired)
      alert('OAuth URL not found. Please try running the test again.')
    }
  }

  const runAutoEval = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    setAutoResults(null)

    try {
      const response = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, autoEval: true })
      })

      if (!response.ok) {
        throw new Error(`Failed to run auto evaluation: ${response.statusText}`)
      }

      const data = await response.json()
      setAutoResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && serverUrl && !loading) {
      runTests()
    }
  }

  if (autoResults) {
    return (
      <main className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 py-4">
          <div className="max-w-6xl mx-auto px-6 flex items-center gap-4">
            <button
              onClick={() => {
                setAutoResults(null)
                setError(null)
              }}
              className="text-2xl font-normal text-blue-600 hover:underline"
            >
              MCP Eval
            </button>
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Enter MCP server URL"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Auto Eval Scorecard */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Auto Evaluation Results</h1>
                <p className="text-gray-600">{autoResults.serverUrl}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold text-blue-600">{autoResults.scorecard.overallScore}/100</div>
                <div className="text-sm text-gray-500">Overall Score</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-gray-900">{autoResults.scorecard.totalTests}</div>
              <div className="text-sm text-gray-600">Total Tests</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-green-600">
                {Math.round(autoResults.scorecard.successRate * 100)}%
              </div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-blue-600">{autoResults.scorecard.avgLatency}ms</div>
              <div className="text-sm text-gray-600">Avg Latency</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-semibold text-purple-600">{autoResults.discoveredTools.length}</div>
              <div className="text-sm text-gray-600">Tools Found</div>
            </div>
          </div>

          {/* Model Performance */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Model Performance</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b text-sm font-medium text-gray-600">
                <div>Model</div>
                <div>Score</div>
                <div>Success Rate</div>
                <div>Performance</div>
              </div>
              {autoResults.scorecard.modelPerformance.map((model, index) => (
                <div key={index} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100 last:border-b-0">
                  <div className="font-medium">{model.model}</div>
                  <div className="text-blue-600 font-semibold">{Math.round(model.score)}/100</div>
                  <div>{Math.round(model.successRate * 100)}%</div>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{width: `${model.score}%`}}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex gap-4">
              <button
                onClick={runAutoEval}
                className="text-blue-600 hover:underline text-sm"
              >
                Run evaluation again
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  alert('Results URL copied to clipboard')
                }}
                className="text-blue-600 hover:underline text-sm"
              >
                Share scorecard
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (results) {
    return (
      <main className="min-h-screen bg-white">
        {/* Simple header for results */}
        <div className="border-b border-gray-200 py-4">
          <div className="max-w-4xl mx-auto px-6 flex items-center gap-4">
            <button
              onClick={() => {
                setResults(null)
                setError(null)
              }}
              className="text-2xl font-normal text-blue-600 hover:underline"
            >
              MCP Eval
            </button>
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="Enter MCP server URL"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6">
            <div className="text-sm text-gray-600 mb-1">
              About {results.totalTests} results ({Date.now() - new Date(results.timestamp).getTime()}ms)
            </div>
            <h2 className="text-xl text-blue-600 mb-1">
              {results.serverUrl}
            </h2>
            <div className="text-sm text-gray-600">
              {results.overallPassed}/{results.totalTests} tests passed
            </div>
          </div>

          <div className="space-y-4">
            {results.tests.map((test, index) => (
              <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                    test.passed ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1">
                    <h3 className="text-lg text-blue-600 mb-1">
                      {test.name}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {test.message}
                    </p>
                    {test.duration && (
                      <div className="text-xs text-gray-500 mt-1">
                        {test.duration}ms
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* OAuth Authorization Card */}
          {authRequired && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Authentication Required
                  </h3>
                  <p className="text-blue-800 mb-4">
                    This MCP server requires OAuth authentication. Click below to authorize MCP Eval to access your server.
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
              onClick={runTests}
              className="text-blue-600 hover:underline text-sm mr-6"
            >
              Run tests again
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/results?data=${encodeURIComponent(JSON.stringify(results))}`
                navigator.clipboard.writeText(url)
                alert('Results URL copied to clipboard')
              }}
              className="text-blue-600 hover:underline text-sm"
            >
              Share results
            </button>
          </div>
        </div>
      </main>
    )
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
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter MCP server URL"
              className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:shadow-md transition-shadow"
              disabled={loading}
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
            onClick={runTests}
            disabled={loading || !serverUrl}
            className="px-6 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded hover:shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <TestTube className="w-4 h-4" />
            {loading ? 'Testing...' : 'Basic Test'}
          </button>
          <button
            onClick={runAutoEval}
            disabled={loading || !serverUrl}
            className="px-6 py-2 text-sm text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {loading ? 'Evaluating...' : 'Auto Eval'}
          </button>
          <button
            onClick={() => setServerUrl('https://mcp.scorecard.io/mcp')}
            className="px-6 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded hover:shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          >
            Try Scorecard
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-600">Testing MCP server...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="max-w-lg w-full">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 text-sm text-gray-600">
            <a href="#" className="hover:underline">About</a>
            <a href="#" className="hover:underline">Documentation</a>
            <a href="#" className="hover:underline">GitHub</a>
            <a href="#" className="hover:underline">Privacy</a>
          </div>
        </div>
      </footer>
    </main>
  )
}