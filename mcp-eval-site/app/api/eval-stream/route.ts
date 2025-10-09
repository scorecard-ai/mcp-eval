/**
 * MCP Server Evaluation Streaming API Route
 *
 * This route provides real-time evaluation of MCP servers using Server-Sent Events (SSE).
 * It streams evaluation progress and results to the client as they happen.
 *
 * Features:
 * - Real-time streaming of evaluation progress
 * - OAuth 2.0 authentication support with fallback
 * - Tool and resource discovery
 */

import { NextRequest } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  registerClient,
  startAuthorization,
  exchangeAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type {
  EvaluationResult,
  StreamLogger,
  TestResult,
  MCPTool,
} from "@/app/types/mcp-eval";

/**
 * Generates intelligent sample arguments for a tool using AI
 */
async function generateSampleArguments(
  tool: { name: string; description?: string; inputSchema?: any },
  logger: StreamLogger
): Promise<any> {
  if (!tool.inputSchema || !tool.inputSchema.properties) {
    return {};
  }

  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    logger.log("⚠️  OpenAI API key not found, using fallback argument generation");
    return generateFallbackArguments(tool.inputSchema);
  }

  try {
    const prompt = `
You are an expert at generating test arguments for MCP (Model Context Protocol) tools.

Tool Name: ${tool.name}
Tool Description: ${tool.description || "No description provided"}
Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}

Generate realistic and valid test arguments for this tool that conform to the JSON schema.
The arguments should be practical examples that would effectively test the tool's functionality.

Respond ONLY with valid JSON that matches the schema. Do not include any explanation or markdown formatting.
`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: "You are a JSON generator that only outputs valid JSON without any markdown formatting or explanations.",
      prompt,
      temperature: 0.3,
    });

    try {
      // Parse and validate the generated JSON
      const args = JSON.parse(text);
      logger.log(`✨ AI generated arguments for tool '${tool.name}'`);
      return args;
    } catch (parseError) {
      logger.log(`⚠️  Failed to parse AI response, using fallback for '${tool.name}'`);
      return generateFallbackArguments(tool.inputSchema);
    }
  } catch (error) {
    logger.log(`⚠️  AI generation failed for '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    return generateFallbackArguments(tool.inputSchema);
  }
}

/**
 * Fallback function to generate basic sample arguments
 */
function generateFallbackArguments(schema: any): any {
  if (!schema || !schema.properties) {
    return {};
  }

  const args: any = {};

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as any;

    // Generate sample values based on type
    if (prop.type === "string") {
      if (prop.enum) {
        args[propName] = prop.enum[0]; // Use first enum value
      } else if (propName.toLowerCase().includes("url")) {
        args[propName] = "https://example.com";
      } else if (propName.toLowerCase().includes("email")) {
        args[propName] = "user@example.com";
      } else if (propName.toLowerCase().includes("path")) {
        args[propName] = "/path/to/file";
      } else {
        args[propName] = `sample_${propName}`;
      }
    } else if (prop.type === "number" || prop.type === "integer") {
      args[propName] = prop.minimum ?? prop.default ?? 1;
    } else if (prop.type === "boolean") {
      args[propName] = prop.default ?? false;
    } else if (prop.type === "array") {
      args[propName] = [];
    } else if (prop.type === "object") {
      args[propName] = {};
    }
  }

  return args;
}

function evaluateClientCompatibility(tools: MCPTool[] = []) {
  const toolNames = tools.map((tool) => tool.name);
  const toolNameSet = new Set(toolNames.map((name) => name.toLowerCase()));
  const discoveredTools = Array.from(new Set(toolNames)).sort();
  const hasAnyTools = discoveredTools.length > 0;

  // Cursor looks for workspace/file-oriented tools
  const cursorKeywords = ["file", "workspace", "project", "repo", "read", "write"];
  const cursorTools = tools
    .filter((tool) =>
      cursorKeywords.some((keyword) =>
        tool.name.toLowerCase().includes(keyword.toLowerCase())
      )
    )
    .map((tool) => tool.name);

  const compatibility = [
    {
      client: "OpenAI (App SDK)",
      compatible: hasAnyTools,
      reason: hasAnyTools
        ? "Server exposes tools compatible with OpenAI's MCP integration"
        : "No tools discovered; OpenAI App SDK requires tools to be exposed",
    },
    {
      client: "Claude.ai",
      compatible: hasAnyTools,
      reason: hasAnyTools
        ? "Server exposes at least one tool via listTools"
        : "No tools discovered; Claude.ai needs tools to be exposed",
    },
    {
      client: "Cursor",
      compatible: cursorTools.length > 0,
      reason:
        cursorTools.length > 0
          ? `Found workspace-oriented tools (${cursorTools.join(", ")})`
          : "No workspace or file tools detected; Cursor integrations typically rely on these",
    },
  ];

  const incompatibleClients = compatibility
    .filter((entry) => !entry.compatible)
    .map((entry) => entry.client);

  const message =
    incompatibleClients.length === 0
      ? "Compatible with OpenAI, Claude.ai, and Cursor"
      : `Potential issues detected for ${incompatibleClients.join(", ")}`;

  return {
    passed: incompatibleClients.length === 0,
    message,
    details: {
      compatibility,
      discoveredTools,
      notes:
        "Compatibility checks are heuristic; verify with the target client before production use.",
    },
  };
}

/**
 * Creates a logger that outputs to both console and SSE stream
 *
 * @param encoder - TextEncoder for converting strings to bytes
 * @param controller - Stream controller for sending SSE messages
 * @returns Logger object with log method
 */
function createLogger(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController<Uint8Array>
): StreamLogger {
  return {
    log: (message: string) => {
      console.log(message); // Still log to console
      const data = JSON.stringify({ type: "log", message });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    },
  };
}

/**
 * Tests an MCP server without authentication and authenticates if necessary.
 *
 * Performs basic connectivity tests and tool discovery.
 * If authentication is required, sets up OAuth flow.
 *
 * @param serverUrl - URL of the MCP server to test
 * @param logger - Logger for streaming output
 * @param request - Next.js request object for extracting host information
 * @returns Evaluation result object
 */
async function testMCPServerConnectionAndAuthenticateIfNecessary(
  serverUrl: string,
  logger: StreamLogger,
  request: NextRequest
): Promise<EvaluationResult> {
  const tests: TestResult[] = [];

  logger.log("🔗 Testing MCP server connection...");

  try {
    // Try basic connection and tool discovery
    logger.log("📋 Attempting to connect without authentication...");

    const mcpClient = new Client({ name: "mcp-eval-sdk", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await mcpClient.connect(transport);

    const toolsListResult = await mcpClient.listTools();

    const compatibilityAssessment = evaluateClientCompatibility(
      toolsListResult.tools || []
    );

    logger.log(
      `🤝 Client compatibility: ${compatibilityAssessment.message}`
    );

    tests.push({
      name: "Client Compatibility",
      passed: compatibilityAssessment.passed,
      message: compatibilityAssessment.message,
      details: compatibilityAssessment.details,
    });

    if (toolsListResult.tools && toolsListResult.tools.length > 0) {
      logger.log(
        `📋 Found ${toolsListResult.tools.length} tools, generating test cases in parallel...`
      );

      const testCasePromises = toolsListResult.tools.map(async (tool) => {
        const sampleArgs = await generateSampleArguments(tool, logger);
        logger.log(`📋 Prepared test case for tool '${tool.name}'`);

        return {
          name: `Tool Test Case: ${tool.name}`,
          passed: false,
          message: `Test case prepared for tool '${tool.name}' - awaiting permission to execute`,
          details: {
            toolName: tool.name,
            description: tool.description || "No description provided",
            inputSchema: tool.inputSchema,
            sampleArguments: sampleArgs,
            requiresPermission: true,
            executed: false,
          },
        };
      });

      const toolTestCases = await Promise.all(testCasePromises);
      tests.push(...toolTestCases);

      logger.log(`✅ Generated ${toolTestCases.length} test cases in parallel`);
    }

    return {
      serverUrl,
      tests,
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.log(`❌ Unauthenticated connection failed: ${errorMessage}`);

    // Check if this might be an OAuth requirement
    if (
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("authentication")
    ) {
      logger.log(
        "🔐 Server requires OAuth authentication, setting up OAuth flow..."
      );

      try {
        // Get base URL for OAuth redirects
        const host = request.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;

        // Step 1: Try to discover OAuth protected resource metadata (may not be supported)
        logger.log(
          "📋 Attempting to discover OAuth protected resource metadata..."
        );
        let resourceMetadata;
        try {
          resourceMetadata = await discoverOAuthProtectedResourceMetadata(
            serverUrl
          );
          logger.log("✅ OAuth protected resource metadata found");
        } catch (metadataError) {
          logger.log(
            "⚠️  OAuth protected resource metadata not found, falling back to direct OAuth flow"
          );
          // This is OK - many servers don't implement this
        }

        // Step 2: Discover authorization server metadata
        // Use the auth server URL from metadata if available, otherwise treat the MCP server as the auth server
        const authServerUrl =
          resourceMetadata?.authorization_server || serverUrl;
        logger.log(
          `🔍 Discovering authorization server metadata from: ${authServerUrl}`
        );
        const authServerMetadata = await discoverAuthorizationServerMetadata(
          authServerUrl as string
        );

        if (!authServerMetadata) {
          throw new Error("Unable to discover authorization server metadata");
        }
        logger.log("✅ Auth server metadata discovered");

        // Step 3: Define client metadata
        const clientMetadata = {
          client_name: "MCP Eval Tool",
          client_uri: baseUrl,
          redirect_uris: [`${baseUrl}/api/mcp-auth-callback`],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "openid",
        };

        // Step 4: Register client dynamically
        logger.log("📝 Registering OAuth client...");
        const clientInformation = await registerClient(
          authServerUrl as string,
          {
            metadata: authServerMetadata,
            clientMetadata,
          }
        );
        logger.log("✅ Client registered successfully");

        // Step 5: Start authorization flow
        logger.log("🚀 Starting authorization flow...");
        // Include server URL in state so we can recover it after OAuth redirect
        const stateData = {
          serverUrl: serverUrl,
          timestamp: Date.now(),
        };
        const authResult = await startAuthorization(authServerUrl as string, {
          metadata: authServerMetadata,
          clientInformation,
          redirectUrl: `${baseUrl}/api/mcp-auth-callback`,
          scope: "openid",
          state: Buffer.from(JSON.stringify(stateData)).toString("base64"),
          // Only include resource parameter if we have metadata that supports it
          ...(resourceMetadata ? { resource: new URL(serverUrl) } : {}),
        });

        logger.log("✅ OAuth flow setup complete");

        tests.push({
          name: "OAuth Required",
          passed: true,
          message: "Server requires OAuth authentication",
          details: {
            requiresAuth: true,
            oauthUrl: authResult.authorizationUrl.toString(),
            clientInfo: clientInformation,
            codeVerifier: authResult.codeVerifier,
            message: "OAuth authentication available",
          },
        });
      } catch (oauthError) {
        logger.log(
          `❌ OAuth setup failed: ${
            oauthError instanceof Error ? oauthError.message : "Unknown error"
          }`
        );
        tests.push({
          name: "OAuth Setup Failed",
          passed: false,
          message: `OAuth setup failed: ${
            oauthError instanceof Error ? oauthError.message : "Unknown error"
          }`,
          details: {
            requiresAuth: true,
            message: "Use the provided OAuth authorization URL to authenticate",
          },
        });
      }

      return {
        serverUrl,
        tests,
        timestamp: new Date(),
      };
    }

    throw error;
  }
}

/**
 * Tests an MCP server with OAuth authentication
 *
 * Performs comprehensive testing after OAuth authentication:
 * 1. Exchanges auth code for tokens
 * 2. Connects with authentication
 * 3. Discovers and tests tools
 * 4. Discovers resources
 *
 * @param serverUrl - URL of the MCP server
 * @param authCode - OAuth authorization code
 * @param clientInfo - OAuth client information
 * @param codeVerifier - PKCE code verifier
 * @param logger - Logger for streaming output
 * @param request - Next.js request object
 * @returns Evaluation result object
 */
async function testMCPServerWithAuthentication(
  serverUrl: string,
  authCode: string,
  clientInfo: any,
  codeVerifier: string,
  logger: StreamLogger,
  request: NextRequest
): Promise<EvaluationResult> {
  const tests: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: any;
  }> = [];
  let tokens: any = null;
  logger.log("🔐 Starting authenticated MCP server evaluation...");

  try {
    // Get base URL for OAuth
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // Step 1: Exchange authorization code for tokens
    logger.log("🔄 Exchanging authorization code for access tokens...");

    // Try to discover OAuth protected resource metadata (may not be supported)
    let resourceMetadata;
    try {
      resourceMetadata = await discoverOAuthProtectedResourceMetadata(
        serverUrl
      );
      logger.log("OAuth protected resource metadata found");
    } catch (metadataError) {
      logger.log(
        "OAuth protected resource metadata not available, using direct OAuth"
      );
    }

    const authServerUrl = resourceMetadata?.authorization_server || serverUrl;
    const authServerMetadata = await discoverAuthorizationServerMetadata(
      authServerUrl as string
    );

    if (!authServerMetadata) {
      throw new Error(
        "Unable to discover authorization server metadata for token exchange"
      );
    }

    tokens = await exchangeAuthorization(authServerUrl as string, {
      metadata: authServerMetadata,
      clientInformation: clientInfo,
      authorizationCode: authCode,
      codeVerifier,
      redirectUri: `${baseUrl}/api/mcp-auth-callback`,
      // Only include resource parameter if we have metadata that supports it
      ...(resourceMetadata ? { resource: new URL(serverUrl) } : {}),
    });

    logger.log("✅ OAuth token exchange successful");

    // Step 2: Create authenticated MCP client
    logger.log("🔌 Creating authenticated MCP client...");
    const mcpClient = new Client({
      name: "mcp-eval-tool",
      version: "1.0.0",
    });

    // Create OAuth provider with the tokens
    // This provider is used for authenticated transport but doesn't
    // need full OAuth flow capabilities since auth is already complete
    const oauthProvider = {
      redirectUrl: `${baseUrl}/api/mcp-auth-callback`,
      clientMetadata: {
        client_name: "MCP Eval Tool",
        client_uri: baseUrl,
        redirect_uris: [`${baseUrl}/api/mcp-auth-callback`],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "openid",
      },
      // Return client info as a function as expected by SDK
      clientInformation: () => clientInfo,
      tokens: () => tokens,
      codeVerifier: () => codeVerifier,
      getAuthHeader: () => `Bearer ${tokens.access_token}`,
      startAuthFlow: async () => {
        throw new Error("Auth flow already completed");
      },
      finishAuthFlow: async () => {
        throw new Error("Auth flow already completed");
      },
      saveTokens: async (_tokens: any) => {
        // Already have tokens, no need to save
      },
      redirectToAuthorization: (_url: URL) => {
        throw new Error("Auth flow already completed");
      },
      saveCodeVerifier: (_verifier: string) => {
        // Already have code verifier, no need to save
      },
    };

    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      authProvider: oauthProvider,
    });

    await mcpClient.connect(transport);

    tests.push({
      name: "Authenticated MCP Connection",
      passed: true,
      message: "Successfully connected with OAuth authentication",
      details: {
        authenticated: true,
        accessToken: tokens.access_token,
      },
    });

    // Step 3: Test tool discovery
    logger.log("🔍 Discovering tools with authentication...");
    const toolsListResult = await mcpClient.listTools();

    const toolCount = toolsListResult.tools?.length || 0;
    logger.log(`✅ Discovered ${toolCount} tools`);

    tests.push({
      name: "Authenticated Tool Discovery",
      passed: true,
      message: `Discovered ${toolCount} tools`,
      details: { tools: toolsListResult.tools, toolCount },
    });

    const compatibilityAssessment = evaluateClientCompatibility(
      toolsListResult.tools || []
    );

    logger.log(
      `🤝 Client compatibility: ${compatibilityAssessment.message}`
    );

    tests.push({
      name: "Client Compatibility",
      passed: compatibilityAssessment.passed,
      message: compatibilityAssessment.message,
      details: compatibilityAssessment.details,
    });

    // Step 3.1: Generate test cases for each discovered tool (in parallel)
    if (toolsListResult.tools && toolsListResult.tools.length > 0) {
      logger.log("🧪 Generating test cases for discovered tools in parallel...");

      // Generate all test cases in parallel
      const testCasePromises = toolsListResult.tools.map(async (tool) => {
        const sampleArgs = await generateSampleArguments(tool, logger);
        logger.log(`📋 Prepared test case for tool '${tool.name}'`);

        return {
          name: `Tool Test Case: ${tool.name}`,
          passed: false, // Not executed yet
          message: `Test case prepared for tool '${tool.name}' - awaiting permission to execute`,
          details: {
            toolName: tool.name,
            description: tool.description || "No description provided",
            inputSchema: tool.inputSchema,
            sampleArguments: sampleArgs,
            requiresPermission: true,
            executed: false,
          },
        };
      });

      // Wait for all test cases to be generated
      const toolTestCases = await Promise.all(testCasePromises);
      tests.push(...toolTestCases);

      logger.log(`✅ Generated ${toolTestCases.length} test cases in parallel`);
    }

    // Step 4: Test resource discovery
    logger.log("📚 Discovering resources with authentication...");
    try {
      const resourcesResult = await mcpClient.listResources();

      const resourceCount = resourcesResult.resources?.length || 0;
      logger.log(`✅ Discovered ${resourceCount} resources`);

      tests.push({
        name: "Authenticated Resource Discovery",
        passed: true,
        message: `Discovered ${resourceCount} resources`,
        details: { resources: resourcesResult.resources, resourceCount },
      });
    } catch (resourceError) {
      tests.push({
        name: "Authenticated Resource Discovery",
        passed: false,
        message: `Resource discovery failed: ${
          resourceError instanceof Error
            ? resourceError.message
            : "Unknown error"
        }`,
      });
    }

    await mcpClient.close();
  } catch (error) {
    logger.log(
      `❌ Authenticated evaluation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );

    tests.push({
      name: "OAuth Authentication",
      passed: false,
      message: `Authentication failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }

  console.log("tests", tests);

  return {
    serverUrl,
    tests,
    timestamp: new Date(),
    accessToken: tokens?.access_token,
  };
}

/**
 * GET endpoint for streaming MCP server evaluation
 *
 * Uses Server-Sent Events to stream evaluation progress in real-time.
 * Supports both authenticated and unauthenticated evaluation.
 *
 * Query parameters:
 * - serverUrl: URL of the MCP server to evaluate (required)
 * - authCode: OAuth authorization code (optional)
 * - clientInfo: Stored OAuth client information (optional)
 * - codeVerifier: Stored PKCE code verifier (optional)
 *
 * @param request - Next.js request object
 * @returns SSE stream with evaluation progress and results
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const serverUrl = searchParams.get("serverUrl");
  const authCode = searchParams.get("authCode");
  const clientInfo = searchParams.get("clientInfo");
  const codeVerifier = searchParams.get("codeVerifier");

  if (!serverUrl) {
    return new Response("Server URL is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const logger = createLogger(encoder, controller);

      // Check if this is an authenticated request
      if (authCode && clientInfo && codeVerifier) {
        logger.log("🔐 Running authenticated evaluation with OAuth tokens...");

        // Parse the stored client info
        let parsedClientInfo;
        try {
          parsedClientInfo = JSON.parse(clientInfo);
        } catch (e) {
          logger.log("❌ Failed to parse client info");
          const data = JSON.stringify({
            type: "error",
            message: "Failed to parse OAuth client information",
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
          return;
        }

        // Run authenticated MCP evaluation
        testMCPServerWithAuthentication(
          serverUrl,
          authCode,
          parsedClientInfo,
          codeVerifier,
          logger,
          request
        )
          .then((result) => {
            // Send final result
            const data = JSON.stringify({ type: "result", result });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          })
          .catch((error) => {
            // Send error
            const data = JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Unknown error",
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          });
      } else {
        // Regular unauthenticated evaluation
        testMCPServerConnectionAndAuthenticateIfNecessary(
          serverUrl,
          logger,
          request
        )
          .then((result) => {
            // Send final result
            const data = JSON.stringify({ type: "result", result });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          })
          .catch((error) => {
            // Send error
            const data = JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Unknown error",
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
