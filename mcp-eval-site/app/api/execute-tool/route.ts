/**
 * MCP Tool Execution API Route
 *
 * This route handles the execution of individual MCP tools with user permission.
 * It supports both authenticated and unauthenticated connections.
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * POST endpoint for executing a specific MCP tool
 *
 * Request body:
 * - serverUrl: URL of the MCP server
 * - toolName: Name of the tool to execute
 * - arguments: Arguments to pass to the tool
 * - authToken: Optional OAuth token for authenticated servers
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { serverUrl, toolName, arguments: toolArgs, authToken } = body;

    if (!serverUrl || !toolName) {
      return NextResponse.json(
        { error: "Server URL and tool name are required" },
        { status: 400 }
      );
    }

    // Create MCP client
    const mcpClient = new Client({
      name: "mcp-eval-tool",
      version: "1.0.0",
    });

    console.log(`Connecting to MCP server: ${serverUrl}`);
    console.log(`Auth token present: ${!!authToken}`);

    // Create transport with proper auth handling
    let transport;
    if (authToken) {
      // Create OAuth provider matching the pattern from eval-stream
      // Get base URL for OAuth redirect URLs (not actually used but required by type)
      const host = request.headers.get("host") || "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${host}`;

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
        // Return minimal but valid values for required functions
        clientInformation: () => ({ client_id: "mcp-eval-tool" }),
        tokens: () => ({
          access_token: authToken,
          token_type: "Bearer",
        }),
        codeVerifier: () => "",
        getAuthHeader: () => `Bearer ${authToken}`,
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

      transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
        authProvider: oauthProvider,
      });
    } else {
      transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    }

    await mcpClient.connect(transport);

    // Execute the tool
    console.log(`Executing tool '${toolName}' with args:`, toolArgs);

    try {
      const result = await mcpClient.callTool({
        name: toolName,
        arguments: toolArgs || {},
      });

      await mcpClient.close();

      console.log(`Tool execution successful for '${toolName}'`);

      return NextResponse.json({
        success: true,
        toolName,
        result: result.content,
        isError: result.isError,
      });
    } catch (toolError) {
      console.error("Tool execution failed:", toolError);
      await mcpClient.close();

      // Extract more detailed error information
      const errorMessage = toolError instanceof Error
        ? toolError.message
        : "Tool execution failed";

      // Check if this is a routing issue
      if (errorMessage.includes("404") && errorMessage.includes("api")) {
        return NextResponse.json({
          success: false,
          toolName,
          error: `Tool execution failed: The MCP tool appears to be making HTTP requests to relative paths that cannot be resolved. This is likely an issue with the MCP server implementation. The tool may need to use absolute URLs or be configured differently.`,
          details: {
            originalError: errorMessage,
            hint: "The MCP server tool is trying to make requests to relative paths like '/api/v2/projects' which are resolving to your local Next.js app instead of the MCP server.",
          },
        });
      }

      return NextResponse.json({
        success: false,
        toolName,
        error: errorMessage,
        details: toolError,
      });
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      },
      { status: 500 }
    );
  }
}