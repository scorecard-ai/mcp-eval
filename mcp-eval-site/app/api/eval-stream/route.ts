import { NextRequest } from 'next/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  registerClient,
  startAuthorization,
  exchangeAuthorization
} from '@modelcontextprotocol/sdk/client/auth.js'

// Custom console.log that sends messages to SSE stream
function createLogger(encoder: TextEncoder, controller: ReadableStreamDefaultController<Uint8Array>) {
  return {
    log: (message: string) => {
      console.log(message) // Still log to console
      const data = JSON.stringify({ type: 'log', message })
      controller.enqueue(encoder.encode(`data: ${data}\n\n`))
    }
  }
}

async function setupOAuthFlowWithLogging(serverUrl: string, baseUrl: string, logger: any) {
  logger.log('🔍 Setting up OAuth flow using lower-level MCP SDK functions...')
  
  try {
    // Step 1: Discover OAuth metadata
    logger.log('📋 Discovering OAuth protected resource metadata...')
    const resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl)
    logger.log('✅ Resource metadata discovered')
    
    // Step 2: Discover authorization server metadata
    const authServerUrl = resourceMetadata?.authorization_server || serverUrl
    logger.log(`🔍 Discovering authorization server metadata from: ${authServerUrl}`)
    const authServerMetadata = await discoverAuthorizationServerMetadata(authServerUrl as string)
    logger.log('✅ Auth server metadata discovered')
    
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
    logger.log('📝 Registering OAuth client...')
    const clientInformation = await registerClient(authServerUrl as string, {
      metadata: authServerMetadata,
      clientMetadata
    })
    logger.log('✅ Client registered successfully')
    
    // Step 5: Start authorization flow
    logger.log('🚀 Starting authorization flow...')
    const authResult = await startAuthorization(authServerUrl as string, {
      metadata: authServerMetadata,
      clientInformation,
      redirectUrl: `${baseUrl}/api/mcp-auth-callback`,
      scope: 'openid'
    })
    
    logger.log('✅ OAuth flow setup complete')
    
    return {
      authorizationUrl: authResult.authorizationUrl,
      codeVerifier: authResult.codeVerifier,
      clientInformation
    }
  } catch (error) {
    logger.log(`❌ OAuth setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

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

Please analyze these tools and generate 2 realistic, practical test scenarios that would:
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

Return your response as a JSON array containing exactly 2 scenarios.

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
      const messageOutput = data.output.find((item: any) => item.type === 'message')
      if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
        // Find the text content
        const textContent = messageOutput.content.find((item: any) => item.type === 'output_text')
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
    
    // Ensure we have an array and limit to 2 scenarios
    if (!Array.isArray(scenarios)) {
      throw new Error('OpenAI response is not an array')
    }
    
    // Take up to 2 scenarios
    return scenarios.slice(0, 2)
    
  } catch (error) {
    console.error('❌ Failed to generate test scenarios with OpenAI:', error)
    
    // Fallback to hardcoded scenarios
    return [
      {
        title: "Tool Discovery Test",
        description: "Test the most commonly used tools from this MCP server", 
        expectedTools: ["create_projects", "list_projects", "create_testsets"],
        complexity: "simple",
        category: "general"
      },
      {
        title: "Advanced Workflow Test",
        description: "Test complex tool interactions and data processing", 
        expectedTools: ["get_data", "process_data", "export_results"],
        complexity: "medium",
        category: "workflow"
      }
    ]
  }
}

// Generate example tasks for each discovered tool (LLM-backed with heuristics fallback)
async function generateExampleTasksForTools(tools: any[]) {
  if (!tools || tools.length === 0) return [] as any[]

  const toolsSpec = tools.map((t: any) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema || null
  }))

  const prompt = `You are generating concrete example tasks for an MCP server's tools.\n\nFor EACH tool below, create 1-2 short, practical tasks a user would ask for that involve that specific tool. For each task, also propose example arguments matching the tool's input schema (best-effort).\n\nTOOLS (JSON):\n${JSON.stringify(toolsSpec, null, 2)}\n\nReturn STRICT JSON with this exact shape (array):\n[\n  {\n    "tool": "<tool name>",\n    "tasks": [\n      { "title": "...", "description": "...", "exampleArguments": { } }\n    ]\n  }\n]\nInclude an entry for each tool in the same order. Do not include any extra text.`

  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          input: prompt,
          max_output_tokens: 4000
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      let text: string | null = null
      if (data.output && Array.isArray(data.output)) {
        const msg = data.output.find((it: any) => it.type === 'message')
        if (msg?.content && Array.isArray(msg.content)) {
          const t = msg.content.find((c: any) => c.type === 'output_text')
          text = t?.text || null
        }
      }
      if (!text) throw new Error('Missing text content in Responses output')
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed
      throw new Error('LLM output not an array')
    }
  } catch (e) {
    console.error('Example task generation via LLM failed, using fallback:', e)
  }

  // Fallback: one smoke-test task per tool using generated arguments
  const results: any[] = []
  for (const tool of tools) {
    const args = generateToolArguments(tool)
    const toolName = tool.name || 'unknown_tool'
    const desc = typeof tool.description === 'string' && tool.description.trim().length > 0
      ? tool.description.trim()
      : 'Perform the primary operation of this tool.'

    results.push({
      tool: toolName,
      tasks: [
        {
          title: `Use ${toolName} (smoke test)`,
          description: `Run a basic call of ${toolName}. ${desc}`,
          exampleArguments: args
        }
      ]
    })
  }
  return results
}

async function testMCPServerWithCLI(serverUrl: string, logger: any, request: NextRequest) {
  const tests: any[] = []
  const test1Start = Date.now()
  
  logger.log('🔗 Testing MCP server using MCP SDK (no CLI)...')
  
  try {
    // Test 1: Basic connection and tool discovery via SDK
    logger.log('📋 Connecting and discovering tools via MCP SDK...')

    const mcpClient = new Client({ name: 'mcp-eval-sdk', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    await mcpClient.connect(transport)

    const toolsResult = await mcpClient.listTools()
    const toolCount = toolsResult.tools?.length || 0
    logger.log(`✅ Found ${toolCount} tools`)

    tests.push({
      name: 'Tool Discovery',
      passed: true,
      message: `Found ${toolCount} tools using MCP SDK`,
      duration: Date.now() - test1Start,
      details: { toolCount, tools: toolsResult.tools }
    })

    // Per-tool example tasks
    try {
      logger.log('🧪 Generating per-tool example tasks...')
      const perTool = await generateExampleTasksForTools((toolsResult as any).tools || [])
      tests.push({
        name: 'Per-Tool Example Tasks',
        passed: true,
        message: `Generated example tasks for ${perTool.length} tools`,
        duration: Date.now(),
        details: { items: perTool }
      })
      logger.log(`✅ Generated per-tool tasks for ${perTool.length} tools`)
    } catch (e) {
      logger.log(`⚠️  Per-tool task generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      tests.push({
        name: 'Per-Tool Example Tasks',
        passed: false,
        message: 'Failed to generate per-tool tasks',
        duration: Date.now(),
        details: { error: e instanceof Error ? e.message : String(e) }
      })
    }

    // Test 2: Generate scenarios
    logger.log('🧪 Generating test scenarios based on discovered tools...')
    logger.log('🤖 Using LLM to analyze tools and generate realistic scenarios...')
    
    const test2Start = Date.now()
    const scenarios = await generateTestScenarios((toolsResult as any).tools || [])
    
    logger.log(`✅ Generated ${scenarios.length} test scenarios`)
    
    tests.push({
      name: 'Test Scenario Generation',
      passed: true,
      message: `Generated ${scenarios.length} test scenarios`,
      duration: Date.now() - test2Start,
      details: { scenarios, toolCount }
    })

    // Test 3: Try calling a sample tool via SDK
    if (toolsResult.tools && toolsResult.tools.length > 0) {
      logger.log('🔧 Testing tool execution via MCP SDK...')
      const test3Start = Date.now()
      const sampleTool = toolsResult.tools[0]
      try {
        const testArgs = generateToolArguments(sampleTool)
        const toolCallResult = await mcpClient.callTool({ name: sampleTool.name, arguments: testArgs })
        tests.push({
          name: 'Sample Tool Execution',
          passed: true,
          message: `Called tool "${sampleTool.name}" via SDK`,
          duration: Date.now() - test3Start,
          details: { toolName: sampleTool.name, arguments: testArgs, result: toolCallResult }
        })
        logger.log(`✅ Tested tool execution for "${sampleTool.name}"`)
      } catch (toolError) {
        const msg = toolError instanceof Error ? toolError.message : 'Unknown error'
        logger.log(`⚠️  Tool execution test completed with error: ${msg}`)
        tests.push({
          name: 'Sample Tool Execution',
          passed: false,
          message: `Tool execution failed: ${msg}`,
          duration: Date.now() - test3Start,
          details: { toolName: sampleTool.name, error: msg }
        })
      }
    }

    // Close client
    await mcpClient.close()

    return {
      serverUrl,
      overallPassed: tests.filter(t => t.passed).length,
      totalTests: tests.length,
      tests,
      timestamp: new Date()
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.log(`❌ CLI evaluation failed: ${errorMessage}`)
    
    // Check if this might be an OAuth requirement
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
      logger.log('🔐 Server requires OAuth authentication, setting up OAuth flow...')

      try {
        // Get base URL for OAuth redirects
        const host = request.headers.get('host') || 'localhost:3000'
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`

        // Step 1: Discover OAuth metadata
        logger.log('📋 Discovering OAuth protected resource metadata...')
        const resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl)

        // Step 2: Discover authorization server metadata
        const authServerUrl = resourceMetadata?.authorization_server || serverUrl
        logger.log(`🔍 Discovering authorization server metadata from: ${authServerUrl}`)
        const authServerMetadata = await discoverAuthorizationServerMetadata(authServerUrl as string)
        logger.log('✅ Auth server metadata discovered')

        // Step 3: Define client metadata
        const clientMetadata = {
          client_name: 'MCP Eval Tool',
          client_uri: baseUrl,
          redirect_uris: [`${baseUrl}/api/mcp-auth-callback`],
          grant_types: ['authorization_code'],
          response_types: ['code'],
          scope: 'openid'
        }

        // Step 4: Register client dynamically
        logger.log('📝 Registering OAuth client...')
        const clientInformation = await registerClient(authServerUrl as string, {
          metadata: authServerMetadata,
          clientMetadata
        })
        logger.log('✅ Client registered successfully')

        // Step 5: Start authorization flow
        logger.log('🚀 Starting authorization flow...')
        const authResult = await startAuthorization(authServerUrl as string, {
          metadata: authServerMetadata,
          clientInformation,
          redirectUrl: `${baseUrl}/api/mcp-auth-callback`,
          scope: 'openid',
          resource: new URL(serverUrl)
        })

        logger.log('✅ OAuth flow setup complete')

        tests.push({
          name: 'OAuth Required',
          passed: true,
          message: 'Server requires OAuth authentication',
          duration: Date.now() - test1Start,
          details: {
            requiresAuth: true,
            oauthUrl: authResult.authorizationUrl.toString(),
            clientInfo: clientInformation,
            codeVerifier: authResult.codeVerifier,
            message: 'OAuth authentication available'
          }
        })
      } catch (oauthError) {
        logger.log(`❌ OAuth setup failed: ${oauthError instanceof Error ? oauthError.message : 'Unknown error'}`)
        tests.push({
          name: 'OAuth Setup Failed',
          passed: false,
          message: `OAuth setup failed: ${oauthError instanceof Error ? oauthError.message : 'Unknown error'}`,
          duration: Date.now() - test1Start,
          details: {
            requiresAuth: true,
            message: 'Use the provided OAuth authorization URL to authenticate'
          }
        })
      }
      
      return {
        serverUrl,
        overallPassed: tests.filter(t => t.passed).length,
        totalTests: tests.length,
        tests,
        timestamp: new Date()
      }
    }
    
    throw error
  }
}

// Generate intelligent test arguments based on tool schema and name
function generateToolArguments(tool: any): any {
  let args: any = {}

  // If tool has input schema, generate based on properties
  if (tool.inputSchema?.properties) {
    for (const [propName, propSchema] of Object.entries(tool.inputSchema.properties)) {
      const schema = propSchema as any
      args[propName] = generateValueForProperty(propName, schema, tool.name)
    }
  } else {
    // Fallback: generate common arguments based on tool name patterns
    args = generateFallbackArguments(tool.name, tool.description)
  }

  return args
}

function generateValueForProperty(propName: string, schema: any, toolName: string): any {
  const name = propName.toLowerCase()
  const type = schema.type || 'string'

  // Type-based generation
  if (type === 'string') {
    // Smart string generation based on property name
    if (name.includes('url') || name.includes('link')) {
      return 'https://example.com'
    }
    if (name.includes('email')) {
      return 'test@example.com'
    }
    if (name.includes('query') || name.includes('search')) {
      return 'test query'
    }
    if (name.includes('message') || name.includes('text') || name.includes('content')) {
      return 'Hello, this is a test message'
    }
    if (name.includes('name') || name.includes('title')) {
      return 'Test Item'
    }
    if (name.includes('path') || name.includes('file')) {
      return '/test/path'
    }
    if (name.includes('id')) {
      return 'test-id-123'
    }
    if (name.includes('code')) {
      return 'console.log("Hello World");'
    }
    if (name.includes('lang') || name.includes('language')) {
      return 'javascript'
    }
    // Default string
    return schema.default || 'test value'
  }

  if (type === 'number' || type === 'integer') {
    return schema.default || 42
  }

  if (type === 'boolean') {
    return schema.default !== undefined ? schema.default : true
  }

  if (type === 'array') {
    return schema.default || ['test item']
  }

  if (type === 'object') {
    return schema.default || {}
  }

  return schema.default || null
}

function generateFallbackArguments(toolName: string, description?: string): any {
  const name = toolName.toLowerCase()
  const desc = (description || '').toLowerCase()

  // Generate arguments based on common tool patterns
  if (name.includes('search') || name.includes('find') || name.includes('query')) {
    return { query: 'test search', limit: 5 }
  }

  if (name.includes('create') || name.includes('add') || name.includes('new')) {
    return { name: 'Test Item', description: 'A test item created by MCP Eval' }
  }

  if (name.includes('get') || name.includes('fetch') || name.includes('read')) {
    return { id: 'test-123' }
  }

  if (name.includes('update') || name.includes('edit') || name.includes('modify')) {
    return { id: 'test-123', name: 'Updated Test Item' }
  }

  if (name.includes('delete') || name.includes('remove')) {
    return { id: 'test-123' }
  }

  if (name.includes('list') || name.includes('all')) {
    return { limit: 10, offset: 0 }
  }

  if (name.includes('send') || name.includes('post') || name.includes('message')) {
    return { message: 'Hello from MCP Eval test', recipient: 'test@example.com' }
  }

  if (name.includes('file') || name.includes('document')) {
    return { path: '/test/document.txt', content: 'Test file content' }
  }

  if (name.includes('code') || name.includes('script') || name.includes('run')) {
    return { code: 'console.log("Hello from MCP Eval");', language: 'javascript' }
  }

  // Default minimal args
  return {}
}

async function testMCPServerWithAuthentication(
  serverUrl: string,
  authCode: string,
  clientInfo: any,
  codeVerifier: string,
  logger: any,
  request: NextRequest
) {
  const tests: any[] = []
  logger.log('🔐 Starting authenticated MCP server evaluation...')

  try {
    // Get base URL for OAuth
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    // Step 1: Exchange authorization code for tokens
    logger.log('🔄 Exchanging authorization code for access tokens...')

    const resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl)
    const authServerUrl = resourceMetadata?.authorization_server || serverUrl
    const authServerMetadata = await discoverAuthorizationServerMetadata(authServerUrl as string)

    const tokens = await exchangeAuthorization(authServerUrl as string, {
      metadata: authServerMetadata,
      clientInformation: clientInfo,
      authorizationCode: authCode,
      codeVerifier,
      redirectUri: `${baseUrl}/api/mcp-auth-callback`
    })

    logger.log('✅ OAuth token exchange successful')

    // Step 2: Create authenticated MCP client
    logger.log('🔌 Creating authenticated MCP client...')
    const mcpClient = new Client({
      name: 'mcp-eval-tool',
      version: '1.0.0'
    })

    // Create OAuth provider with the tokens
    const oauthProvider = {
      redirectUrl: `${baseUrl}/api/mcp-auth-callback`,
      clientMetadata: {
        client_name: 'MCP Eval Tool',
        client_uri: baseUrl,
        redirect_uris: [`${baseUrl}/api/mcp-auth-callback`],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'openid'
      },
      clientInformation: clientInfo,
      tokens: () => tokens,
      codeVerifier: () => codeVerifier,
      getAuthHeader: () => `Bearer ${tokens.access_token}`,
      startAuthFlow: async () => { throw new Error('Auth flow already completed') },
      finishAuthFlow: async () => { throw new Error('Auth flow already completed') },
      saveTokens: async (tokens: any) => { /* Already have tokens */ },
      redirectToAuthorization: (url: URL) => { throw new Error('Auth flow already completed') },
      saveCodeVerifier: (verifier: string) => { /* Already have code verifier */ }
    }

    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      authProvider: oauthProvider
    })

    await mcpClient.connect(transport)

    tests.push({
      name: 'Authenticated MCP Connection',
      passed: true,
      message: 'Successfully connected with OAuth authentication',
      duration: Date.now()
    })

    // Step 3: Test tool discovery
    logger.log('🔍 Discovering tools with authentication...')
    const toolsListResult = await mcpClient.listTools()

    const toolCount = toolsListResult.tools?.length || 0
    logger.log(`✅ Discovered ${toolCount} tools`)

    tests.push({
      name: 'Authenticated Tool Discovery',
      passed: true,
      message: `Discovered ${toolCount} tools`,
      duration: Date.now(),
      details: { tools: toolsListResult.tools, toolCount }
    })

    // Per-tool example tasks (authenticated)
    try {
      logger.log('🧪 Generating per-tool example tasks (authenticated)...')
      const perTool = await generateExampleTasksForTools(toolsListResult.tools || [])
      tests.push({
        name: 'Per-Tool Example Tasks',
        passed: true,
        message: `Generated example tasks for ${perTool.length} tools`,
        duration: Date.now(),
        details: { items: perTool }
      })
      logger.log(`✅ Generated per-tool tasks for ${perTool.length} tools`)
    } catch (e) {
      logger.log(`⚠️  Per-tool task generation (authenticated) failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      tests.push({
        name: 'Per-Tool Example Tasks',
        passed: false,
        message: 'Failed to generate per-tool tasks (authenticated)',
        duration: Date.now(),
        details: { error: e instanceof Error ? e.message : String(e) }
      })
    }

    // Step 4: Test multiple tools with intelligent arguments
    if (toolsListResult.tools && toolsListResult.tools.length > 0) {
      logger.log(`🧪 Running intelligent test scenarios for ${Math.min(5, toolsListResult.tools.length)} tools...`)

      // Test up to 5 different tools with smart arguments
      const toolsToTest = toolsListResult.tools.slice(0, 5)

      for (const tool of toolsToTest) {
        logger.log(`🔧 Testing tool: ${tool.name}`)

        try {
          // Generate intelligent arguments based on tool schema
          const testArgs = generateToolArguments(tool)
          logger.log(`📝 Generated arguments for ${tool.name}: ${JSON.stringify(testArgs)}`)

          const callResult = await mcpClient.callTool({
            name: tool.name,
            arguments: testArgs
          })

          tests.push({
            name: `Tool: ${tool.name}`,
            passed: true,
            message: `Successfully called "${tool.name}" with generated arguments`,
            duration: Date.now(),
            details: {
              toolName: tool.name,
              arguments: testArgs,
              result: callResult,
              description: tool.description
            }
          })

          logger.log(`✅ Tool call successful: ${tool.name}`)
        } catch (toolError) {
          const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error'

          tests.push({
            name: `Tool: ${tool.name}`,
            passed: false,
            message: `Tool call failed: ${errorMsg}`,
            duration: Date.now(),
            details: {
              toolName: tool.name,
              error: errorMsg,
              description: tool.description
            }
          })

          logger.log(`❌ Tool call failed for ${tool.name}: ${errorMsg}`)
        }
      }
    }

    // Step 5: Test resource discovery
    logger.log('📚 Discovering resources with authentication...')
    try {
      const resourcesResult = await mcpClient.listResources()

      const resourceCount = resourcesResult.resources?.length || 0
      logger.log(`✅ Discovered ${resourceCount} resources`)

      tests.push({
        name: 'Authenticated Resource Discovery',
        passed: true,
        message: `Discovered ${resourceCount} resources`,
        duration: Date.now(),
        details: { resources: resourcesResult.resources, resourceCount }
      })
    } catch (resourceError) {
      tests.push({
        name: 'Authenticated Resource Discovery',
        passed: false,
        message: `Resource discovery failed: ${resourceError instanceof Error ? resourceError.message : 'Unknown error'}`,
        duration: Date.now()
      })
    }

    await mcpClient.close()

  } catch (error) {
    logger.log(`❌ Authenticated evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)

    tests.push({
      name: 'OAuth Authentication',
      passed: false,
      message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now()
    })
  }

  return {
    serverUrl,
    overallPassed: tests.filter(t => t.passed).length,
    totalTests: tests.length,
    tests,
    timestamp: new Date()
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const serverUrl = searchParams.get('serverUrl')
  const authCode = searchParams.get('authCode')
  const clientInfo = searchParams.get('clientInfo')
  const codeVerifier = searchParams.get('codeVerifier')
  
  if (!serverUrl) {
    return new Response('Server URL is required', { status: 400 })
  }
  
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      const logger = createLogger(encoder, controller)
      
      // Check if this is an authenticated request
      if (authCode && clientInfo && codeVerifier) {
        logger.log('🔐 Running authenticated evaluation with OAuth tokens...')

        // Parse the stored client info
        let parsedClientInfo
        try {
          parsedClientInfo = JSON.parse(clientInfo)
        } catch (e) {
          logger.log('❌ Failed to parse client info')
          const data = JSON.stringify({
            type: 'error',
            message: 'Failed to parse OAuth client information'
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          controller.close()
          return
        }

        // Run authenticated MCP evaluation
        testMCPServerWithAuthentication(serverUrl, authCode, parsedClientInfo, codeVerifier, logger, request)
          .then((result) => {
            // Send final result
            const data = JSON.stringify({ type: 'result', result })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            controller.close()
          })
          .catch((error) => {
            // Send error
            const data = JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error'
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            controller.close()
          })
      } else {
        // Regular unauthenticated evaluation
        testMCPServerWithCLI(serverUrl, logger, request)
          .then((result) => {
            // Send final result
            const data = JSON.stringify({ type: 'result', result })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            controller.close()
          })
          .catch((error) => {
            // Send error
            const data = JSON.stringify({ 
              type: 'error', 
              message: error instanceof Error ? error.message : 'Unknown error' 
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            controller.close()
          })
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}
