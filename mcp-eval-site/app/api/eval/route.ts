import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { 
  UnauthorizedError,
  startAuthorization,
  exchangeAuthorization,
  registerClient,
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata
} from '@modelcontextprotocol/sdk/client/auth.js'

// In-memory OAuth client provider based on the official MCP SDK example
class InMemoryOAuthClientProvider {
  private _clientInformation: any
  private _tokens: any  
  private _codeVerifier: string | undefined
  private _redirectUrl: string
  private _clientMetadata: any
  private _onRedirect: (url: URL) => void

  constructor(redirectUrl: string, clientMetadata: any, onRedirect?: (url: URL) => void) {
    this._redirectUrl = redirectUrl
    this._clientMetadata = clientMetadata
    this._onRedirect = onRedirect || ((url) => {
      console.log(`Redirect to: ${url.toString()}`)
    })
  }

  get redirectUrl() {
    return this._redirectUrl
  }

  get clientMetadata() {
    return this._clientMetadata
  }

  clientInformation() {
    // Return the dynamically registered client information
    // This will be undefined initially, forcing dynamic registration
    return this._clientInformation
  }

  saveClientInformation(clientInformation: any) {
    // Still save it for completeness, but we use static info above
    this._clientInformation = clientInformation
  }

  tokens() {
    return this._tokens
  }

  saveTokens(tokens: any) {
    this._tokens = tokens
  }

  redirectToAuthorization(authorizationUrl: URL) {
    this._onRedirect(authorizationUrl)
  }

  saveCodeVerifier(codeVerifier: string) {
    this._codeVerifier = codeVerifier
  }

  codeVerifier() {
    if (!this._codeVerifier) {
      throw new Error('No code verifier saved')
    }
    return this._codeVerifier
  }

  async validateResourceURL(serverUrl: string | URL) {
    const url = new URL(serverUrl)
    if (url.protocol === 'http:') url.protocol = 'https:'
    return url
  }
}

// New function using lower-level OAuth functions for better web app support
async function setupOAuthFlow(serverUrl: string, baseUrl: string) {
  console.log('🔍 Setting up OAuth flow using lower-level MCP SDK functions...')
  
  try {
    // Step 1: Discover OAuth metadata
    console.log('📋 Discovering OAuth protected resource metadata...')
    const resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl)
    console.log('Resource metadata:', resourceMetadata)
    
    // Step 2: Discover authorization server metadata
    const authServerUrl = resourceMetadata?.authorization_server || serverUrl
    console.log('🔍 Discovering authorization server metadata from:', authServerUrl)
    const authServerMetadata = await discoverAuthorizationServerMetadata(authServerUrl as string)
    console.log('Auth server metadata:', authServerMetadata)
    
    // Step 3: Define client metadata
    const clientMetadata = {
      client_name: 'MCP Eval Tool',
      redirect_uris: [`${baseUrl}/api/mcp-auth-callback`],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'openid'
    }
    
    // Step 4: Register client dynamically
    console.log('📝 Registering OAuth client...')
    const clientInformation = await registerClient(authServerUrl as string, {
      metadata: authServerMetadata,
      clientMetadata
    })
    console.log('Client registered:', clientInformation)
    
    // Step 5: Start authorization flow
    console.log('🚀 Starting authorization flow...')
    const authResult = await startAuthorization(authServerUrl as string, {
      metadata: authServerMetadata,
      clientInformation,
      redirectUrl: `${baseUrl}/api/mcp-auth-callback`,
      scope: 'openid',
      resource: new URL(serverUrl)
    })
    
    console.log('✅ OAuth flow setup complete')
    return {
      authorizationUrl: authResult.authorizationUrl.toString(),
      codeVerifier: authResult.codeVerifier,
      clientInformation,
      authServerMetadata,
      resourceMetadata
    }
    
  } catch (error) {
    console.error('❌ OAuth flow setup failed:', error)
    throw error
  }
}

// Function to exchange authorization code for access tokens
async function performOAuthTokenExchange(serverUrl: string, authCode: string, clientInformation: any, codeVerifier: string, baseUrl: string) {
  console.log('🔄 Exchanging authorization code for access tokens...')
  
  try {
    // Discover OAuth metadata again (we need the auth server URL)
    const resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl)
    const authServerUrl = resourceMetadata?.authorization_server || serverUrl
    const authServerMetadata = await discoverAuthorizationServerMetadata(authServerUrl as string)
    
    // Exchange the authorization code for tokens
    const tokens = await exchangeAuthorization(authServerUrl, {
      metadata: authServerMetadata,
      clientInformation,
      authorizationCode: authCode,
      codeVerifier,
      redirectUri: `${baseUrl}/api/mcp-auth-callback`,
      resource: new URL(serverUrl)
    })
    
    console.log('🎉 Token exchange successful!')
    return tokens
    
  } catch (error) {
    console.error('❌ OAuth token exchange failed:', error)
    throw error
  }
}

// Function to generate realistic test scenarios based on discovered tools
async function generateTestScenarios(tools: any[]) {
  console.log('🤖 Using LLM to analyze tools and generate realistic scenarios...')
  
  // Create a comprehensive prompt for scenario generation
  const toolsDescription = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))

  const prompt = `You are an expert at analyzing MCP (Model Context Protocol) tools and generating realistic test scenarios.

I have discovered ${tools.length} tools from an MCP server. Here are the tools with their descriptions and input schemas:

${JSON.stringify(toolsDescription, null, 2)}

Please analyze these tools and generate 1 realistic, practical test scenario that would:
1. Test the most important/useful tools
2. Use tools in realistic combinations/workflows  
3. Represent real-world use cases
4. Be clear enough for an LLM to understand and execute

For each scenario, provide:
- title: A clear, concise title
- description: What the user is trying to accomplish  
- expectedTools: Array of tool names that should be used
- complexity: "simple", "medium", or "complex"
- category: The type of task (e.g., "security", "analysis", "development")

Return your response as a JSON array containing exactly 1 scenario.

Example format:
[
  {
    "title": "Security Analysis of Web Application", 
    "description": "I need to scan my web application for security vulnerabilities and get a detailed report",
    "expectedTools": ["security_scan", "generate_report"],
    "complexity": "medium",
    "category": "security"
  }
]`

  try {
    // Use OpenAI Responses API for GPT-5 Mini
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt,
        max_output_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error response:', errorText)
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    // Responses API returns content in data.output array, find the message with text
    let scenariosText = null
    
    if (data.output && Array.isArray(data.output)) {
      // Find the message output (not reasoning)
      const messageOutput = data.output.find(item => item.type === 'message')
      if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
        // Find the text content
        const textContent = messageOutput.content.find(item => item.type === 'output_text')
        if (textContent && textContent.text) {
          scenariosText = textContent.text
        }
      }
    }
    
    if (!scenariosText) {
      throw new Error('Unable to extract text content from OpenAI Responses API response')
    }
    
    // Parse the JSON response with error handling
    let scenarios
    try {
      scenarios = JSON.parse(scenariosText)
    } catch (parseError) {
      console.error('❌ JSON parsing failed, raw response:', scenariosText)
      console.error('❌ Parse error:', parseError)
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }
    
    // Ensure we have an array and limit to 1 scenario if multiple returned
    if (!Array.isArray(scenarios)) {
      throw new Error('OpenAI response is not an array')
    }
    
    // Take only the first scenario if multiple were returned
    const limitedScenarios = scenarios.slice(0, 1)
    
    console.log(`🎉 SUCCESS! GPT-5 Mini generated ${scenarios.length} scenarios, using first ${limitedScenarios.length}`)
    console.log(`🎯 First scenario title: "${limitedScenarios[0]?.title}"`)
    return limitedScenarios

  } catch (error) {
    console.error('❌ Failed to generate scenarios with LLM:', error)
    
    // Fallback: Generate basic scenarios based on tool names
    const fallbackScenarios = generateFallbackScenarios(tools)
    console.log(`🔄 Using ${fallbackScenarios.length} fallback scenarios`)
    return fallbackScenarios
  }
}

// Fallback scenario generation if LLM fails
function generateFallbackScenarios(tools: any[]) {
  const toolNames = tools.map(t => t.name.toLowerCase())
  const scenarios = []

  // Security-focused scenario
  if (toolNames.some(name => name.includes('security') || name.includes('scan') || name.includes('vulnerability'))) {
    scenarios.push({
      title: "Security Assessment",
      description: "Perform a comprehensive security analysis",
      expectedTools: tools.filter(t => 
        t.name.toLowerCase().includes('security') || 
        t.name.toLowerCase().includes('scan') ||
        t.name.toLowerCase().includes('vulnerability')
      ).map(t => t.name).slice(0, 3),
      complexity: "medium",
      category: "security"
    })
  }

  // Analysis scenario
  if (toolNames.some(name => name.includes('analysis') || name.includes('report') || name.includes('analyze'))) {
    scenarios.push({
      title: "Comprehensive Analysis",
      description: "Analyze and generate detailed reports",
      expectedTools: tools.filter(t => 
        t.name.toLowerCase().includes('analysis') || 
        t.name.toLowerCase().includes('report') ||
        t.name.toLowerCase().includes('analyze')
      ).map(t => t.name).slice(0, 3),
      complexity: "simple",
      category: "analysis"  
    })
  }

  // General workflow scenario
  if (scenarios.length === 0) {
    scenarios.push({
      title: "Tool Discovery Test",
      description: "Test the most commonly used tools from this MCP server",
      expectedTools: tools.slice(0, 3).map(t => t.name),
      complexity: "simple", 
      category: "general"
    })
  }

  return scenarios
}

// Helper function following the official MCP SDK pattern
async function attemptConnection(
  mcpClient: Client, 
  oauthProvider: InMemoryOAuthClientProvider, 
  serverUrl: string,
  authCode?: string
): Promise<void> {
  console.log('🚢 Creating transport with OAuth provider...')
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    authProvider: oauthProvider
  })
  
  try {
    console.log('🔌 Attempting connection (this will trigger OAuth if needed)...')
    await mcpClient.connect(transport)
    console.log('✅ Connected successfully')
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      if (authCode) {
        console.log('🔐 OAuth required - using provided authorization code...')
        await transport.finishAuth(authCode)
        console.log('🔐 Authorization completed, reconnecting...')
        // Recursively attempt connection again
        await attemptConnection(mcpClient, oauthProvider, serverUrl)
      } else {
        console.log('🔐 OAuth required - no auth code provided')
        throw error
      }
    } else {
      console.error('❌ Connection failed with non-auth error:', error)
      throw error
    }
  }
}

async function testMCPServerWithOAuth(serverUrl: string, authCode: string, baseUrl: string, clientInfo?: any, storedCodeVerifier?: string): Promise<TestResult[]> {
  const tests: TestResult[] = []
  let mcpClient: Client | null = null
  
  try {
    console.log('🔗 Starting OAuth MCP connection test with auth code:', authCode.substring(0, 10) + '...')
    
    if (!clientInfo || !storedCodeVerifier) {
      throw new Error('Missing OAuth state: clientInfo and codeVerifier are required for token exchange')
    }
    
    // Use lower-level OAuth functions for token exchange
    const tokens = await performOAuthTokenExchange(serverUrl, authCode, clientInfo, storedCodeVerifier, baseUrl)
    console.log('✅ OAuth token exchange successful')

    // Create MCP client with authenticated transport
    mcpClient = new Client({
      name: 'mcp-eval-client',
      version: '1.0.0'
    }, { capabilities: {} })

    // Create transport with the access token
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      }
    })
    
    await mcpClient.connect(transport)
    
    tests.push({
      name: 'OAuth MCP Connection',
      passed: true,
      message: 'Successfully connected with OAuth authentication',
      duration: Date.now()
    })

    // Test authenticated operations
    const toolsResult = await mcpClient.listTools()
    tests.push({
      name: 'Authenticated Tool Discovery',
      passed: true,
      message: `Found ${toolsResult?.tools?.length || 0} tools`,
      duration: Date.now(),
      details: {
        toolCount: toolsResult?.tools?.length || 0,
        toolNames: toolsResult?.tools?.map(t => t.name) || [],
        tools: toolsResult?.tools || []
      }
    })

    // Generate test scenarios based on discovered tools
    if (toolsResult?.tools && toolsResult.tools.length > 0) {
      console.log('🧪 Generating test scenarios based on discovered tools...')
      try {
        const scenarios = await generateTestScenarios(toolsResult.tools)
        tests.push({
          name: 'Test Scenario Generation',
          passed: true,
          message: `Generated ${scenarios.length} test scenarios`,
          duration: Date.now(),
          details: {
            scenarios: scenarios,
            toolCount: toolsResult.tools.length
          }
        })
      } catch (scenarioError) {
        console.error('❌ Scenario generation failed:', scenarioError)
        tests.push({
          name: 'Test Scenario Generation',
          passed: false,
          message: `Failed to generate scenarios: ${scenarioError instanceof Error ? scenarioError.message : 'Unknown error'}`,
          duration: Date.now()
        })
      }
    }

  } catch (error) {
    tests.push({
      name: 'OAuth MCP Connection',
      passed: false,
      message: `Failed to connect with OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now()
    })
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close()
      } catch (closeError) {
        console.error('Error closing MCP client:', closeError)
      }
    }
  }

  return tests
}

type TestResult = {
  name: string
  passed: boolean
  message: string
  duration?: number
  details?: any
}

type MCPTool = {
  name: string
  description: string
  inputSchema?: any
}

async function runAutoEvaluation(serverUrl: string) {
  return NextResponse.json({ 
    error: 'Auto-evaluation not implemented yet' 
  }, { status: 501 })
}

export async function POST(request: NextRequest) {
  try {
    const { serverUrl, autoEval = false, authCode, state, clientInfo, codeVerifier } = await request.json()
    
    // Get the current host for OAuth redirects
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    console.log('API request received:', { serverUrl, autoEval, authCode: !!authCode, baseUrl })

    if (!serverUrl) {
      return NextResponse.json(
        { error: 'Server URL is required' },
        { status: 400 }
      )
    }

  // If auto-eval is requested, run comprehensive evaluation
  if (autoEval) {
    return runAutoEvaluation(serverUrl)
  }

  // If auth code is provided, use MCP SDK OAuth to test authenticated server
  if (authCode) {
    console.log('Processing OAuth callback with auth code:', authCode)
    console.log('Using stored OAuth state - clientInfo:', !!clientInfo, 'codeVerifier:', !!codeVerifier)
    
    const authenticatedTests = await testMCPServerWithOAuth(serverUrl, authCode, baseUrl, clientInfo, codeVerifier)
    
    return NextResponse.json({
      serverUrl,
      overallPassed: authenticatedTests.filter(t => t.passed).length,
      totalTests: authenticatedTests.length,
      tests: authenticatedTests,
      timestamp: new Date().toISOString(),
      authenticated: true
    })
  }

  const tests: TestResult[] = []

  // Test 1: Server Reachability
  const test1Start = Date.now()
  try {
    const response = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream, application/json',
        'User-Agent': 'MCP-Eval/1.0',
      }
    })
    
    const isReachable = response.status !== 0 && response.status < 500
    
    tests.push({
      name: 'Server Reachability',
      passed: isReachable,
      message: isReachable ? 
        `Server responded with status ${response.status}` :
        `Server unreachable (status ${response.status})`,
      duration: Date.now() - test1Start,
      details: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      }
    })
  } catch (error) {
    tests.push({
      name: 'Server Reachability',
      passed: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      duration: Date.now() - test1Start
    })
  }

  // Test 2: MCP Protocol Support  
  const test2Start = Date.now()
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'mcp-eval',
            version: '1.0.0'
          }
        },
        id: 1
      })
    })
    
    const contentType = response.headers.get('content-type')
    const isMCPResponse = contentType?.includes('json') || contentType?.includes('event-stream')
    
    tests.push({
      name: 'MCP Protocol Support',
      passed: response.ok || response.status === 405,
      message: isMCPResponse 
        ? 'Server appears to support MCP protocol'
        : `Server returned ${contentType || 'unknown'} content type`,
      duration: Date.now() - test2Start,
      details: {
        status: response.status,
        contentType: contentType
      }
    })
  } catch (error) {
    tests.push({
      name: 'MCP Protocol Support',
      passed: false,
      message: `Could not verify MCP protocol: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - test2Start
    })
  }

  // Test 3: MCP Connection with OAuth Support using lower-level SDK functions
  const test3Start = Date.now()

  try {
    // First try direct connection without auth
    const mcpClient = new Client({
      name: 'mcp-eval-client',
      version: '1.0.0'
    }, { capabilities: {} })

    try {
      const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
      await mcpClient.connect(transport)
      
      const tools = await mcpClient.listTools()
      tests.push({
        name: 'MCP Connection',
        passed: true,
        message: `Connected successfully without authentication. Found ${tools?.tools?.length || 0} tools`,
        duration: Date.now() - test3Start,
        details: {
          toolCount: tools?.tools?.length || 0,
          toolNames: tools?.tools?.map(t => t.name) || []
        }
      })
      
      await mcpClient.close()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isUnauthorized = error instanceof UnauthorizedError || 
                            errorMessage.includes('401') || 
                            errorMessage.includes('Unauthorized')
      
      if (isUnauthorized) {
        console.log('🔐 OAuth required (detected 401/Unauthorized), setting up authorization flow...')
        
        try {
          // Use lower-level OAuth functions for better control
          const oauthResult = await setupOAuthFlow(serverUrl, baseUrl)
          
          tests.push({
            name: 'OAuth Required',
            passed: true,
            message: 'Server requires OAuth authentication',
            duration: Date.now() - test3Start,
            details: {
              requiresAuth: true,
              oauthUrl: oauthResult.authorizationUrl,
              clientInfo: oauthResult.clientInformation,
              codeVerifier: oauthResult.codeVerifier,
              message: 'OAuth authentication available'
            }
          })
        } catch (oauthError) {
          console.error('❌ OAuth setup failed:', oauthError)
          tests.push({
            name: 'OAuth Setup Failed',
            passed: false,
            message: `OAuth setup failed: ${oauthError instanceof Error ? oauthError.message : 'Unknown error'}`,
            duration: Date.now() - test3Start,
            details: {
              requiresAuth: true,
              error: oauthError instanceof Error ? oauthError.message : 'Unknown error'
            }
          })
        }
      } else {
        throw error
      }
    }
  } catch (error) {
    tests.push({
      name: 'MCP Connection',
      passed: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - test3Start
    })
  }

  const requiresAuthTest = tests.find(t => t.details?.requiresAuth)
  
  return NextResponse.json({
    serverUrl,
    overallPassed: tests.filter(t => t.passed).length,
    totalTests: tests.length,
    tests,
    timestamp: new Date().toISOString(),
    requiresAuth: tests.some(t => t.details?.requiresAuth),
    oauthUrl: requiresAuthTest?.details?.oauthUrl || null
  })
  
  } catch (error) {
    console.error('❌ API route error:', error)
    return NextResponse.json({
      error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}