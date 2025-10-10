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

// Lazy-load json-schema-faker to avoid module loading issues
let jsf: any = null;
let jsfConfigured = false;

function getJSF() {
  if (!jsf) {
    try {
      const jsfModule = require("json-schema-faker");
      const { faker } = require("@faker-js/faker");
      jsf = jsfModule;
      
      // Configure on first use
      if (!jsfConfigured && typeof jsf.extend === 'function') {
        // Configure faker to avoid Lorem Ipsum
        faker.seed(123); // Use fixed seed for consistency
        
        jsf.extend("faker", () => faker);
        
        // Override lorem with more meaningful text
        jsf.define('lorem', () => 'test value');
        
        jsfConfigured = true;
      }
    } catch (e) {
      console.error("Failed to load json-schema-faker:", e);
      jsf = null;
    }
  }
  return jsf;
}

/**
 * Generates intelligent sample arguments for a tool using AI
 */
async function generateSampleArguments(
  tool: { name: string; description?: string; inputSchema?: any },
  logger: StreamLogger,
  serverUrl?: string
): Promise<any> {
  if (!tool.inputSchema || !tool.inputSchema.properties) {
    return {};
  }

  // Generate fallback first as a starting point
  logger.log(`🎲 Generating arguments for '${tool.name}'`);
  const fallbackArgs = await generateFallbackArguments(tool.inputSchema);
  logger.log(`✓ Arguments generated: ${JSON.stringify(fallbackArgs).substring(0, 100)}...`);
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    logger.log("⚠️  OpenAI API key not found, using fallback arguments as-is");
    return fallbackArgs;
  }

  try {
    logger.log(`🤖 Enhancing test cases with LLM`);
    const requiredFields = tool.inputSchema.required || [];
    const optionalFields = Object.keys(tool.inputSchema.properties || {}).filter(
      (field) => !requiredFields.includes(field)
    );
    
    // Pass server URL to LLM for context-aware generation
    let serverContext = '';
    if (serverUrl) {
      serverContext = `\nServer: ${serverUrl}`;
    }
    
    const prompt = `Generate realistic test arguments for this MCP tool.
    
    ${serverContext}

Tool: ${tool.name}
${tool.description || ""}

Schema:
${JSON.stringify(tool.inputSchema, null, 2)}

Template to improve:
${JSON.stringify(fallbackArgs, null, 2)}

RULES:
1. Match the schema exactly - respect all types, constraints (min/max/minLength/maxLength), required fields, and enums
2. Use realistic values appropriate for the service (analyze the server URL and tool name)
3. Numbers: Use positive integers for limit/count/page (1-100), respect min/max constraints
4. Strings: Use meaningful text (no Lorem Ipsum gibberish), proper formats for email/url/uuid/date-time
5. Arrays: Use concrete field names like ["user_query", "context"] for inputs, ["assistant_response"] for expected
6. Objects: For jsonSchema fields, use PROPER JSON Schema structure: {"type": "object", "properties": {...}, "required": [...]}
7. Optional fields: OMIT cursor/nextCursor/page/offset/jq_filter unless required

Return ONLY valid JSON matching the schema.`;

    const { text } = await generateText({
      model: openai("gpt-5"),
      system: "You are a JSON generator that only outputs valid JSON without any markdown formatting or explanations.",
      prompt,
      temperature: 0.3,
    });

    try {
      // Parse and validate the generated JSON
      const args = JSON.parse(text);
      
      // Validate required fields are present
      const missingRequired = requiredFields.filter((field: string) => !(field in args));
      if (missingRequired.length > 0) {
        logger.log(`⚠️  LLM response missing required fields: ${missingRequired.join(", ")}, using fallback`);
        return await generateFallbackArguments(tool.inputSchema);
      }
      
      logger.log(`✨ LLM successfully enhanced arguments for '${tool.name}'`);
      return args;
    } catch (parseError) {
      logger.log(`⚠️  Failed to parse AI response, using fallback for '${tool.name}'`);
      return await generateFallbackArguments(tool.inputSchema);
    }
  } catch (error) {
    logger.log(`⚠️  AI generation failed for '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    return await generateFallbackArguments(tool.inputSchema);
  }
}

/**
 * Post-process json-schema-faker output to apply smart domain-specific values and validate
 */
function applySmartDefaults(args: any, schema: any): any {
  if (!schema || !schema.properties || !args) {
    return args;
  }

  const required = schema.required || [];

  for (const [propName, value] of Object.entries(args)) {
    const nameLower = propName.toLowerCase();
    const propSchema = schema.properties[propName];
    const isRequired = required.includes(propName);
    
    if (!propSchema) continue;
    
    // ===== Type and format validation =====
    
    // Fix Lorem Ipsum / gibberish text (common pattern from faker/jsf)
    if (propSchema.type === 'string' && typeof value === 'string') {
      const looksLikeLoremIpsum = /^[a-z]+( [a-z]+){1,5}$/i.test(value.trim());
      const isTooShort = value.trim().length < 4;
      
      if (looksLikeLoremIpsum || isTooShort) {
        // Replace with meaningful default
        if (nameLower.includes('name')) {
          args[propName] = 'Test Chatbot Project';
        } else if (nameLower.includes('description') || nameLower.includes('desc')) {
          args[propName] = 'A test project for evaluating AI system performance';
        } else if (nameLower.includes('title')) {
          args[propName] = 'Test Title';
        } else {
          args[propName] = `test_${propName}`;
        }
      }
    }
    
    // Fix empty strings for required fields
    if (isRequired && propSchema.type === 'string' && (!value || value === '')) {
      args[propName] = `test_${propName}`;
    }
    
    // Fix empty arrays when minItems is set or clean up Lorem Ipsum in string arrays
    if (propSchema.type === 'array' && Array.isArray(value)) {
      // Clean up Lorem Ipsum text in string arrays
      if (propSchema.items?.type === 'string') {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'string') {
            const looksLikeLoremIpsum = /^[a-z]+( [a-z]+){1,5}$/i.test(value[i].trim());
            if (looksLikeLoremIpsum || value[i].trim().length < 3) {
              // Replace with meaningful field names based on context
              if (nameLower.includes('input')) {
                value[i] = ['user_query', 'context', 'conversation_history'][i % 3];
              } else if (nameLower.includes('expected') || nameLower.includes('output')) {
                value[i] = ['assistant_response', 'completion'][i % 2];
              } else if (nameLower.includes('metadata')) {
                value[i] = ['timestamp', 'user_id', 'session_id'][i % 3];
              } else {
                value[i] = `field_${i + 1}`;
              }
            }
          }
        }
      }
      
      if (propSchema.minItems && value.length < propSchema.minItems) {
        // Generate placeholder items
        const itemsNeeded = propSchema.minItems - value.length;
        for (let i = 0; i < itemsNeeded; i++) {
          if (propSchema.items?.type === 'string') {
            value.push(`item_${value.length + 1}`);
          } else if (propSchema.items?.type === 'object') {
            value.push({});
          } else {
            value.push(null);
          }
        }
      }
    }
    
    // Special handling for jsonSchema field (should be a proper JSON Schema, not random properties)
    if ((nameLower === 'jsonschema' || nameLower === 'json_schema' || nameLower === 'schema') && 
        propSchema.type === 'object' && propSchema.additionalProperties && 
        typeof value === 'object' && value !== null) {
      // Check if it looks like random properties (not a proper JSON Schema)
      const objValue = value as Record<string, any>;
      const hasType = 'type' in objValue;
      const hasProperties = 'properties' in objValue;
      
      if (!hasType || !hasProperties) {
        // Replace with a proper JSON Schema structure
        args[propName] = {
          type: "object",
          properties: {
            user_query: {
              type: "string",
              description: "The user's input query"
            },
            context: {
              type: "string",
              description: "Additional context for the query"
            },
            expected_response: {
              type: "string",
              description: "The expected AI response"
            },
            timestamp: {
              type: "string",
              format: "date-time"
            }
          },
          required: ["user_query", "expected_response"]
        };
      }
    }
    
    // Fix empty objects when properties are required
    if (propSchema.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (propSchema.required && propSchema.required.length > 0 && propSchema.properties) {
        // Ensure required nested properties exist
        const objValue = value as Record<string, any>;
        for (const reqProp of propSchema.required) {
          if (!(reqProp in objValue)) {
            const nestedPropSchema = propSchema.properties[reqProp as string];
            objValue[reqProp] = nestedPropSchema?.type === 'string' ? `test_${reqProp}` : null;
          }
        }
      }
    }
    
    // Ensure positive integers for count/limit/page/size fields
    if (propSchema.type === 'integer' || propSchema.type === 'number') {
      const isCountField = nameLower.match(/^(limit|page|count|size|offset|max|min|top|take|skip|per_?page|page_?size)$/);
      
      if (isCountField && typeof value === 'number') {
        const absValue = Math.abs(Math.floor(value));
        
        if (nameLower.includes('limit') || nameLower.includes('size') || nameLower.includes('per')) {
          args[propName] = absValue > 0 ? Math.min(absValue, 100) : 10;
        } else if (nameLower === 'page') {
          args[propName] = absValue > 0 ? absValue : 1;
        } else if (nameLower.includes('offset') || nameLower === 'skip') {
          args[propName] = absValue;
        } else {
          args[propName] = absValue > 0 ? absValue : 1;
        }
      }
      
      // Validate against schema minimum/maximum
      if (typeof value === 'number') {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          args[propName] = propSchema.minimum;
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          args[propName] = propSchema.maximum;
        }
      }
    }
    
    // ===== Format-specific validation =====
    
    // Email format validation
    if (propSchema.format === 'email' && typeof value === 'string') {
      if (!value.includes('@') || value.length < 5) {
        args[propName] = 'user@example.com';
      }
    }
    
    // URL format validation
    if ((propSchema.format === 'uri' || propSchema.format === 'url') && typeof value === 'string') {
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        args[propName] = 'https://example.com';
      }
    }
    
    // UUID format validation
    if (propSchema.format === 'uuid' && typeof value === 'string') {
      if (!value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        args[propName] = '12345678-1234-1234-1234-123456789abc';
      }
    }
    
    // ISO Date patterns (always current time for dates)
    if (propSchema.format === 'date-time' && typeof value === 'string') {
      if (!value || !value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        args[propName] = new Date().toISOString();
      }
    }
    
    // String pattern validation
    if (propSchema.pattern && typeof value === 'string') {
      try {
        const regex = new RegExp(propSchema.pattern);
        if (!regex.test(value)) {
          // Pattern failed, provide a safe default
          args[propName] = `test_${propName}`;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
    
    // String length validation
    if (propSchema.type === 'string' && typeof value === 'string') {
      if (propSchema.minLength && value.length < propSchema.minLength) {
        args[propName] = value.padEnd(propSchema.minLength, '_');
      }
      if (propSchema.maxLength && value.length > propSchema.maxLength) {
        args[propName] = value.substring(0, propSchema.maxLength);
      }
    }
    
    // Enum selection (ensure value is in enum)
    if (propSchema.enum && Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
      if (!value || !propSchema.enum.includes(value)) {
        args[propName] = propSchema.enum[0];
      }
    }
  }
  
  // Ensure all required fields exist
  for (const reqField of required) {
    if (!(reqField in args) && schema.properties[reqField]) {
      const fieldSchema = schema.properties[reqField];
      // Provide a default based on type
      if (fieldSchema.type === 'string') {
        args[reqField] = `test_${reqField}`;
      } else if (fieldSchema.type === 'integer' || fieldSchema.type === 'number') {
        args[reqField] = fieldSchema.minimum || 1;
      } else if (fieldSchema.type === 'boolean') {
        args[reqField] = false;
      } else if (fieldSchema.type === 'array') {
        args[reqField] = [];
      } else if (fieldSchema.type === 'object') {
        args[reqField] = {};
      }
    }
  }
  
  return args;
}

/**
 * Generate fallback arguments using json-schema-faker (async with full dereferencing)
 */
async function generateFallbackArguments(schema: any): Promise<any> {
  if (!schema || !schema.properties) {
    return {};
  }

  try {
    const jsf = getJSF();
    
    if (!jsf) {
      // If jsf failed to load, use basic fallback
      console.warn('[generateFallbackArguments] json-schema-faker not available, using basic generation');
      const args: any = {};
      const required = schema.required || [];
      for (const field of required) {
        args[field] = `test_${field}`;
      }
      return args;
    }

    // Configure jsf options (v0.5.x)
    if (typeof jsf.option === 'function') {
      jsf.option({
        alwaysFakeOptionals: false, // Don't generate optional fields by default
        useExamplesValue: true, // Use examples from schema if available
        useDefaultValue: true, // Use default values from schema
        fixedProbabilities: true, // More predictable generation
        minItems: 1,
        maxItems: 3,
        minLength: 3,
        maxLength: 100,
        requiredOnly: false, // Generate all properties defined in schema
        failOnInvalidTypes: false, // Don't fail on invalid types
        fillProperties: true, // Fill in all properties
      });
    }

    // Create a modified schema that skips problematic optional fields
    const modifiedSchema = {
      ...schema,
      type: 'object',
      properties: { ...schema.properties },
      additionalProperties: false, // CRITICAL: Prevent random extra properties
      required: schema.required || []
    };
    
    // Remove problematic optional fields
    const skipOptional = ['cursor', 'nextCursor', 'page', 'offset', 'jq_filter'];
    const required = schema.required || [];
    
    for (const field of skipOptional) {
      if (!required.includes(field) && modifiedSchema.properties[field]) {
        delete modifiedSchema.properties[field];
      }
    }
    
    // Enhance numeric fields with constraints for positive integers
    for (const [fieldName, fieldSchema] of Object.entries(modifiedSchema.properties) as [string, any][]) {
      const nameLower = fieldName.toLowerCase();
      const isCountField = nameLower.match(/^(limit|page|count|size|offset|max|min|top|take|skip|per_?page|page_?size)$/);
      
      if (isCountField && (fieldSchema.type === 'integer' || fieldSchema.type === 'number')) {
        // Add minimum constraint if not already present
        if (fieldSchema.minimum === undefined) {
          if (nameLower === 'offset' || nameLower === 'skip') {
            fieldSchema.minimum = 0; // Offset can be 0
          } else {
            fieldSchema.minimum = 1; // Others should be at least 1
          }
        }
        // Add reasonable maximum for limits
        if (fieldSchema.maximum === undefined && (nameLower.includes('limit') || nameLower.includes('size'))) {
          fieldSchema.maximum = 100;
        }
      }
    }

    // Generate using json-schema-faker with full dereferencing (async)
    let generated: any;
    if (typeof jsf.resolve === 'function') {
      generated = await jsf.resolve(modifiedSchema) as any;
    } else {
      // Fallback if resolve is not available
      console.warn('[generateFallbackArguments] jsf.resolve not available, using basic generation');
      generated = {};
      const required = schema.required || [];
      for (const field of required) {
        generated[field] = `test_${field}`;
      }
    }
    
    // Filter out any properties not in the schema (extra safety)
    const schemaPropertyNames = Object.keys(modifiedSchema.properties);
    const filtered: any = {};
    for (const key of schemaPropertyNames) {
      if (key in generated) {
        filtered[key] = generated[key];
      }
    }
    
    // Apply smart domain-specific defaults
    const withSmartDefaults = applySmartDefaults(filtered, modifiedSchema);
    
    return withSmartDefaults;
  } catch (error) {
    console.error('[generateFallbackArguments] Error generating with json-schema-faker:', error);
    // Very basic fallback if json-schema-faker fails
    const args: any = {};
    const required = schema.required || [];
    for (const field of required) {
      args[field] = `test_${field}`;
    }
    return args;
  }
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
 * Creates a logger that outputs to both console and SSE stream with keep-alive support
 *
 * @param encoder - TextEncoder for converting strings to bytes
 * @param controller - Stream controller for sending SSE messages
 * @returns Object containing the logger and a cleanup function
 */
function createLogger(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController<Uint8Array>
): { logger: StreamLogger; cleanup: () => void } {
  // Set up keep-alive heartbeat to prevent connection timeout during long operations
  let lastActivity = Date.now();
  const keepAliveInterval = setInterval(() => {
    // Send keep-alive ping every 15 seconds if no recent activity
    if (Date.now() - lastActivity > 15000) {
      try {
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        lastActivity = Date.now();
      } catch (e) {
        // Stream might be closed, clear interval
        clearInterval(keepAliveInterval);
      }
    }
  }, 15000);

  const logger: StreamLogger = {
    log: (message: string) => {
      console.log(message); // Still log to console
      const data = JSON.stringify({ type: "log", message });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      lastActivity = Date.now(); // Update activity timestamp
    },
  };

  const cleanup = () => {
    clearInterval(keepAliveInterval);
  };

  return { logger, cleanup };
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
        const sampleArgs = await generateSampleArguments(tool, logger, serverUrl);
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
        const sampleArgs = await generateSampleArguments(tool, logger, serverUrl);
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
      // Check if it's a "Method not found" error (code -32601)
      const errorMessage = resourceError instanceof Error ? resourceError.message : String(resourceError);
      const isMethodNotFound = errorMessage.includes("-32601") || errorMessage.includes("Method not found");
      
      if (isMethodNotFound) {
        logger.log("ℹ️  Server does not implement resources (optional feature)");
        tests.push({
          name: "Authenticated Resource Discovery",
          passed: true,
          message: "Server does not implement resources (only tools available)",
          details: { resourceCount: 0, note: "Resources are optional in MCP - this server only provides tools" },
        });
      } else {
        tests.push({
          name: "Authenticated Resource Discovery",
          passed: false,
          message: `Resource discovery failed: ${errorMessage}`,
        });
      }
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
      const { logger, cleanup } = createLogger(encoder, controller);

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
          cleanup();
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
            cleanup();
            controller.close();
          })
          .catch((error) => {
            // Send error
            const data = JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Unknown error",
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            cleanup();
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
            cleanup();
            controller.close();
          })
          .catch((error) => {
            // Send error
            const data = JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Unknown error",
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            cleanup();
            controller.close();
          });
      }
    },
    cancel() {
      // Stream was cancelled by client, no cleanup needed here as it's handled above
      console.log("SSE stream cancelled by client");
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
