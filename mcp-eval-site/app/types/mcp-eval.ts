/**
 * Type definitions for MCP Evaluation Tool
 * Provides comprehensive typing for OAuth flows, test results, and MCP protocol interactions
 */

import type {
  OAuthClientInformation,
  AuthorizationServerMetadata,
  OAuthProtectedResourceMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";

/**
 * Represents the result of a single test execution
 */
export interface TestResult {
  /** Name of the test being executed */
  name: string;
  /** Whether the test passed successfully */
  passed: boolean;
  /** Human-readable message describing the test result */
  message: string;
  /** Time taken to execute the test in milliseconds */
  duration?: number;
  /** Additional details about the test result */
  details?: TestResultDetails;
}

/**
 * Detailed information about a test result
 */
export interface TestResultDetails {
  /** Indicates if authentication is required */
  requiresAuth?: boolean;
  /** OAuth authorization URL for user redirect */
  oauthUrl?: string;
  /** OAuth client information for token exchange */
  clientInfo?: OAuthClientInformation;
  /** PKCE code verifier for OAuth flow */
  codeVerifier?: string;
  /** Number of tools discovered */
  toolCount?: number;
  /** Names of discovered tools */
  toolNames?: string[];
  /** Full tool definitions from MCP server */
  tools?: MCPTool[];
  /** Generated test scenarios */
  scenarios?: TestScenario[];
  /** High-level user tasks */
  tasks?: HighLevelTask[];
  /** HTTP status code */
  status?: number;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Content type of response */
  contentType?: string | null;
  /** Error message if test failed */
  error?: string;
  /** Tool execution details */
  toolName?: string;
  arguments?: any;
  result?: any;
  description?: string;
  /** Resource discovery details */
  resources?: any[];
  resourceCount?: number;
  /** Generic message field */
  message?: string;
}

/**
 * Represents an MCP tool definition
 */
export interface MCPTool {
  /** Unique name identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description?: string;
  /** JSON Schema defining the tool's input parameters */
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Represents a test scenario for evaluating MCP tools
 */
export interface TestScenario {
  /** Brief title of the scenario */
  title: string;
  /** Detailed description of what the scenario tests */
  description: string;
  /** List of tool names expected to be used in this scenario */
  expectedTools: string[];
  /** Complexity level of the scenario */
  complexity: "simple" | "medium" | "complex";
  /** Category of the test scenario */
  category: string;
}

/**
 * Represents a high-level user task
 */
export interface HighLevelTask {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Expected tools to complete the task */
  expectedTools: string[];
}

/**
 * OAuth flow result containing all necessary information for authentication
 */
export interface OAuthFlowResult {
  /** URL to redirect user for authorization */
  authorizationUrl: string;
  /** PKCE code verifier for secure token exchange */
  codeVerifier: string;
  /** OAuth client registration information */
  clientInformation: OAuthClientInformation;
  /** Authorization server metadata */
  authServerMetadata?: AuthorizationServerMetadata;
  /** Protected resource metadata (may not be available for all servers) */
  resourceMetadata?: OAuthProtectedResourceMetadata;
}

/**
 * Complete evaluation result for an MCP server
 */
export interface EvaluationResult {
  /** URL of the evaluated MCP server */
  serverUrl: string;
  /** Number of tests that passed */
  overallPassed: number;
  /** Total number of tests executed */
  totalTests: number;
  /** Array of individual test results */
  tests: TestResult[];
  /** ISO timestamp of when the evaluation was performed */
  timestamp: string | Date;
  /** Whether the server requires authentication */
  requiresAuth?: boolean;
  /** OAuth URL if authentication is required */
  oauthUrl?: string | null;
  /** Whether the evaluation was performed with authentication */
  authenticated?: boolean;
}

/**
 * Request payload for the evaluation API
 */
export interface EvaluationRequest {
  /** URL of the MCP server to evaluate */
  serverUrl: string;
  /** Whether to run auto-evaluation (not yet implemented) */
  autoEval?: boolean;
  /** OAuth authorization code from callback */
  authCode?: string;
  /** OAuth state parameter for CSRF protection */
  state?: string;
  /** Stored OAuth client information */
  clientInfo?: any;
  /** Stored PKCE code verifier */
  codeVerifier?: string;
}

/**
 * SSE (Server-Sent Events) message types
 */
export interface SSEMessage {
  /** Type of SSE message */
  type: "log" | "result" | "error";
  /** Log message (for type: "log") */
  message?: string;
  /** Evaluation result (for type: "result") */
  result?: EvaluationResult;
}

/**
 * Configuration for generating test arguments
 */
export interface ArgumentGenerationConfig {
  /** Name of the property being generated */
  propName: string;
  /** JSON Schema for the property */
  schema: any;
  /** Name of the tool this argument belongs to */
  toolName: string;
}

/**
 * Logger interface for SSE streaming
 */
export interface StreamLogger {
  /** Log a message to both console and SSE stream */
  log: (message: string) => void;
}
