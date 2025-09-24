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
import type {
  EvaluationResult,
  StreamLogger,
  TestResult,
} from "@/app/types/mcp-eval";

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

    await mcpClient.listTools();

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

    const tokens = await exchangeAuthorization(authServerUrl as string, {
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
