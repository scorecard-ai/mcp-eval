"use client";

import { Search, PlayCircle, AlertTriangle, Link, Check, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EvaluationResult } from "@/app/types/mcp-eval";
import TestDetails from "./TestDetails";
import NextLink from "next/link";
import DonutChart from "./DonutChart";

interface ResultsProps {
  results: EvaluationResult;
  serverUrl: string;
  authRequired: {
    oauthUrl?: string;
    clientInfo?: any;
    codeVerifier?: string;
  } | null;
  handleOAuthFlow: () => void;
  accessToken?: string;
}

export default function Results({
  results,
  serverUrl,
  authRequired,
  handleOAuthFlow,
  accessToken,
}: ResultsProps) {
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set());
  const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());
  const [executingAll, setExecutingAll] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState<{
    testName: string;
    toolName: string;
    description: string;
    arguments: any;
    inputSchema?: any;
    autoPopulatedFields?: string[];
    missingDependencies?: string[];
    invalidFields?: string[];
    prerequisites?: string[];
  } | null>(null);
  const [editedArguments, setEditedArguments] = useState<string>("");
  const [argumentsError, setArgumentsError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
  // Store regenerated arguments for tools (overrides original sampleArguments)
  const [regeneratedArguments, setRegeneratedArguments] = useState<Map<string, any>>(new Map());
  // Execution context to track all successful tool responses with metadata
  const [executionContext, setExecutionContext] = useState<Map<string, {
    result: any;
    description?: string;
    responseSchema?: any;
    responseFields?: string[];
    inferredOutputSchema?: any;
  }>>(new Map());

  const hasExecutableTools = results.tests.some(
    (test) => test.details?.requiresPermission
  );

  // Extract search term from MCP URL for Smithery
  function extractSmitherySearchTerm(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Remove common MCP subdomains (mcp., api., etc.)
      let cleaned = hostname.replace(/^(mcp|api|server)\./i, '');
      
      // Remove TLD (.com, .io, .dev, .ai, etc.)
      cleaned = cleaned.replace(/\.(com|io|dev|ai|net|org|co)$/i, '');
      
      // Remove www if present
      cleaned = cleaned.replace(/^www\./i, '');
      
      // If there are still dots, take the last part (e.g., scorecard.io -> scorecard)
      const parts = cleaned.split('.');
      const searchTerm = parts[parts.length - 1];
      
      return searchTerm || 'mcp';
    } catch {
      return 'mcp';
    }
  }

  const smitherySearchTerm = extractSmitherySearchTerm(serverUrl);


  useEffect(() => {
    setOpenSections({});
  }, [results.serverUrl, results.timestamp]);

  useEffect(() => {
    setOpenSections((prev) => {
      const nextState: Record<string, boolean> = { ...prev };

      results.tests.forEach((test) => {
        const executionResult = toolResults.get(test.name);
        const requiresPermission = Boolean(test.details?.requiresPermission);
        const hasExecuted =
          !requiresPermission ||
          Boolean(test.details?.executed) ||
          Boolean(executionResult);

        const success = executionResult
          ? Boolean(executionResult.success)
          : Boolean(test.passed);

        if (!(test.name in nextState)) {
          nextState[test.name] = hasExecuted ? !success : false;
        }

        if (hasExecuted && success) {
          nextState[test.name] = false;
        }
      });

      return nextState;
    });
  }, [results.tests, toolResults]);

  const scorecard = useMemo(() => {
    const executedToolEntries = Array.from(toolResults.entries());
    const executedToolNames = new Set(
      executedToolEntries.map(([name]) => name)
    );

    let executedCount = 0;
    let passedCount = 0;

    results.tests.forEach((test) => {
      const requiresPermission = Boolean(test.details?.requiresPermission);
      const executionResult = toolResults.get(test.name);
      const executed =
        !requiresPermission ||
        Boolean(test.details?.executed) ||
        executedToolNames.has(test.name);

      if (!executed) {
        return;
      }

      executedCount += 1;

      const passed = executionResult
        ? Boolean(executionResult.success)
        : Boolean(test.passed);

      if (passed) {
        passedCount += 1;
      }
    });

    const pendingCount = results.tests.length - executedCount;
    const passRate =
      executedCount > 0
        ? Math.round((passedCount / executedCount) * 100)
        : null;

    const timestamp = new Date(results.timestamp);
    const testedAt = Number.isNaN(timestamp.getTime())
      ? `${results.timestamp}`
      : timestamp.toLocaleString();

    const authConnectionTest = results.tests.find(
      (test) => test.name === "Authenticated MCP Connection"
    );
    const oauthRequiredTest = results.tests.find(
      (test) => test.name === "OAuth Required"
    );
    const oauthFailureTest = results.tests.find((test) =>
      ["OAuth Setup Failed", "OAuth Authentication"].includes(test.name)
    );

    let authLabel = "Public (no authentication detected)";
    let authDetail = "Server responded to unauthenticated requests.";

    if (authConnectionTest) {
      authLabel = "OAuth (authenticated)";
      authDetail =
        authConnectionTest.message ||
        "Successfully connected using OAuth credentials.";
    } else if (oauthRequiredTest) {
      authLabel = oauthFailureTest
        ? "OAuth required (setup failed)"
        : "OAuth required";
      authDetail =
        oauthFailureTest?.message ||
        oauthRequiredTest.message ||
        "Server indicated OAuth is required.";
    }

    const compatibilityTest = [...results.tests]
      .reverse()
      .find((test) => test.name === "Client Compatibility");

    const compatibilityDetails = Array.isArray(
      (compatibilityTest?.details as any)?.compatibility
    )
      ? (compatibilityTest?.details as any)?.compatibility
      : [];

    type CompatibilityEntry = {
      client: string;
      compatible: boolean;
      reason?: string;
    };

    const compatibilityEntries: CompatibilityEntry[] = compatibilityDetails.map(
      (entry: any) => ({
        client: entry.client,
        compatible: entry.compatible,
        reason: entry.reason,
      })
    );

    const resourceTest = [...results.tests]
      .reverse()
      .find((test) => test.name.includes("Resource Discovery"));

    const resourceStatus = resourceTest
      ? resourceTest.passed
        ? "Success"
        : "Failed"
      : "Not attempted";

    const resourceDetail =
      resourceTest?.message ||
      (resourceStatus === "Not attempted"
        ? "Resource discovery was not part of this evaluation."
        : undefined);

    return {
      serverUrl: results.serverUrl,
      testedAt,
      auth: {
        label: authLabel,
        detail: authDetail,
      },
      compatibility: {
        summary: compatibilityTest?.message || "Compatibility not evaluated",
        entries: compatibilityEntries,
      },
      resources: {
        status: resourceStatus,
        detail: resourceDetail,
      },
      tests: {
        passed: passedCount,
        executed: executedCount,
        pending: pendingCount,
        total: results.tests.length,
        passRate,
      },
    };
  }, [results, toolResults]);

  // Helper function to normalize field/tool names for comparison (handles both camelCase and snake_case)
  function normalizeForComparison(str: string): string {
    // Convert camelCase to snake_case, then remove all separators and lowercase
    // Example: "projectId" -> "project_id" -> "projectid"
    // Example: "project_id" -> "project_id" -> "projectid"
    const snakeCase = str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    return snakeCase.replace(/[-_]/g, '');
  }

  // Helper function to extract prefix from ID field (handles both camelCase and snake_case)
  function extractIdPrefix(fieldName: string): string | null {
    // Match various ID patterns: project_id, projectId, project-id, etc.
    // Case-insensitive match for "id" suffix
    const match = fieldName.match(/^(.+?)(?:[-_]?id|Id)$/i);
    if (match) {
      return match[1];
    }
    return null;
  }

  // Helper function to infer output schema from actual data
  function inferOutputSchema(data: any): any {
    if (data === null || data === undefined) return null;
    
    const type = Array.isArray(data) ? 'array' : typeof data;
    
    if (type === 'object' && !Array.isArray(data)) {
      const properties: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        properties[key] = inferOutputSchema(value);
      }
      return {
        type: 'object',
        properties,
        required: Object.keys(data), // All present fields treated as required
      };
    }
    
    if (type === 'array' && data.length > 0) {
      return {
        type: 'array',
        items: inferOutputSchema(data[0]),
      };
    }
    
    return { type };
  }

  // Helper function to parse response schema from tool description
  function parseResponseSchema(description: string | undefined): any {
    if (!description) return null;
    
    try {
      // Look for "Response Schema" section with JSON
      const schemaMatch = description.match(/Response Schema[^\n]*\n```json\n([\s\S]*?)\n```/i);
      if (!schemaMatch) return null;
      
      const schemaText = schemaMatch[1];
      // Try to parse as JSON (handle pseudo-JSON with $ref, etc.)
      // This is a best-effort parse since the schema might not be valid JSON
      const cleanedSchema = schemaText
        .replace(/\$ref:/g, '"$ref":')
        .replace(/\$defs:/g, '"$defs":')
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
      
      return JSON.parse(cleanedSchema);
    } catch (e) {
      console.log('[parseResponseSchema] Failed to parse schema:', e);
      return null;
    }
  }

  // Helper function to extract field names from a schema object
  function extractSchemaFields(schema: any): string[] {
    const fields: string[] = [];
    
    if (!schema) return fields;
    
    // Direct properties
    if (schema.properties) {
      fields.push(...Object.keys(schema.properties));
    }
    
    // Handle $ref and $defs
    if (schema.$ref && schema.$defs) {
      const refPath = schema.$ref.replace('#/$defs/', '');
      const refSchema = schema.$defs[refPath];
      if (refSchema?.properties) {
        fields.push(...Object.keys(refSchema.properties));
      }
    }
    
    // Handle nested $defs
    if (schema.$defs) {
      for (const defSchema of Object.values(schema.$defs)) {
        if (typeof defSchema === 'object' && (defSchema as any).properties) {
          fields.push(...Object.keys((defSchema as any).properties));
        }
      }
    }
    
    return fields;
  }

  // Helper function to extract data from tool response (handles both new and old context format)
  function extractResponseData(contextEntry: any): any {
    // Handle new format with metadata
    const response = contextEntry.result || contextEntry;
    
    console.log('[extractResponseData] Processing response:', response);
    
    // The execute-tool API returns { success: true, result: [...content...] }
    // where result is the MCP content array
    const contentArray = response.result || response.content;
    
    if (!contentArray) {
      console.log('[extractResponseData] No content/result found in response');
      return null;
    }
    
    try {
      // MCP responses are in content array with text type
      const textContent = Array.isArray(contentArray) 
        ? contentArray.find((c: any) => c.type === 'text')
        : null;
        
      if (textContent?.text) {
        const parsed = JSON.parse(textContent.text);
        console.log('[extractResponseData] Successfully parsed:', parsed);
        return parsed;
      }
    } catch (e) {
      console.log('[extractResponseData] Parse error:', e);
      // If parsing fails, return raw response
    }
    
    console.log('[extractResponseData] Returning response as-is');
    return response;
  }

  // Helper function to find matching value in execution context
  function findMatchingValue(fieldName: string, fieldSchema: any): { value: any; source: string } | null {
    console.log(`[findMatchingValue] Looking for field: ${fieldName}`);
    console.log(`[findMatchingValue] Execution context has ${executionContext.size} entries:`, Array.from(executionContext.keys()));
    
    let bestMatch: { value: any; source: string; priority: number } | null = null;
    
    // Extract prefix if this is an ID field (handles both camelCase and snake_case)
    const idPrefix = extractIdPrefix(fieldName);
    console.log(`[findMatchingValue] 🔍 Extracted ID prefix from "${fieldName}": "${idPrefix}"`);
    
    for (const [toolName, contextEntry] of executionContext.entries()) {
      console.log(`[findMatchingValue] Checking tool: ${toolName}`);
      const data = extractResponseData(contextEntry);
      
      // Get response schema fields if available
      const responseFields = contextEntry.responseFields || [];
      console.log(`[findMatchingValue] Tool ${toolName} data type:`, typeof data, 'value:', data);
      console.log(`[findMatchingValue] Tool ${toolName} returns fields:`, responseFields);
      if (!data) continue;

      // Priority 0: If response is a simple value (string/number) and tool name matches field, use it directly
      if (idPrefix && (typeof data === 'string' || typeof data === 'number')) {
        console.log(`[findMatchingValue] 🔍 Priority 0 check: Simple value detected for ${fieldName}`);
        console.log(`[findMatchingValue] 🔍 idPrefix: "${idPrefix}", data: "${data}"`);
        
        const normalizedPrefix = normalizeForComparison(idPrefix);
        const normalizedToolName = normalizeForComparison(toolName);
        const toolBaseName = normalizedToolName.replace(/^(create|list|get|update|delete|upsert)/, '');
        
        console.log(`[findMatchingValue] 🔍 Normalized: prefix="${normalizedPrefix}", toolName="${normalizedToolName}", baseName="${toolBaseName}"`);
        console.log(`[findMatchingValue] 🔍 Checking matches:`, {
          toolNameIncludesPrefix: normalizedToolName.includes(normalizedPrefix),
          baseNameEqualsPrefix: toolBaseName === normalizedPrefix,
          prefixIncludesBaseName: normalizedPrefix.includes(toolBaseName),
        });
        
        if (normalizedToolName.includes(normalizedPrefix) || 
            toolBaseName === normalizedPrefix ||
            normalizedPrefix.includes(toolBaseName)) {
          console.log(`[findMatchingValue] ✅ Simple value match: ${fieldName} with ${toolName} -> ${data} (response is primitive)`);
          if (!bestMatch || 0 < bestMatch.priority) {
            bestMatch = {
              value: data,
              source: toolName,
              priority: 0  // Highest priority
            };
          }
        } else {
          console.log(`[findMatchingValue] ❌ No match: tool name doesn't match field prefix`);
        }
      }

      // Priority 1: Direct exact field match (case-insensitive)
      if (typeof data === 'object' && data !== null && !Array.isArray(data) && data[fieldName] !== undefined && data[fieldName] !== null) {
        console.log(`[findMatchingValue] Found direct match for ${fieldName}: ${data[fieldName]}`);
        if (!bestMatch || 1 < bestMatch.priority) {
          bestMatch = {
            value: data[fieldName],
            source: toolName,
            priority: 1
          };
        }
      }
      
      // Priority 2: Check for snake_case/camelCase variations
      // If field is "projectId", also check "project_id" and vice versa
      const alternateFieldName = fieldName.includes('_') 
        ? fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) // snake_case to camelCase
        : fieldName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(); // camelCase to snake_case
      
      if (typeof data === 'object' && data !== null && !Array.isArray(data) && alternateFieldName !== fieldName && data[alternateFieldName] !== undefined && data[alternateFieldName] !== null) {
        console.log(`[findMatchingValue] Found alternate match ${alternateFieldName} for ${fieldName}: ${data[alternateFieldName]}`);
        if (!bestMatch || 2 < bestMatch.priority) {
          bestMatch = {
            value: data[alternateFieldName],
            source: toolName,
            priority: 2
          };
        }
      }

      // Priority 3: Schema-aware ID field matching
      // Use response schema to verify the tool actually returns an 'id' field
      if (typeof data === 'object' && data !== null && !Array.isArray(data) && idPrefix && responseFields.includes('id')) {
        const normalizedPrefix = normalizeForComparison(idPrefix);
        const normalizedToolName = normalizeForComparison(toolName);
        
        console.log(`[findMatchingValue] ID field detected: ${fieldName} -> prefix: ${idPrefix} (normalized: ${normalizedPrefix})`);
        console.log(`[findMatchingValue] Tool name: ${toolName} (normalized: ${normalizedToolName})`);
        console.log(`[findMatchingValue] Response schema confirms 'id' field exists`);
        
        // Check if tool name contains the prefix
        // Examples: "createprojects" contains "project", "listprojects" contains "project"
        const toolBaseName = normalizedToolName.replace(/^(create|list|get|update|delete|upsert)/, '');
        
        if (normalizedToolName.includes(normalizedPrefix) || 
            toolBaseName === normalizedPrefix ||
            normalizedPrefix.includes(toolBaseName)) {
          
          const idValue = data.id || data.ID;
          if (idValue !== undefined && idValue !== null) {
            console.log(`[findMatchingValue] Schema-verified match: ${fieldName} with ${toolName} -> id: ${idValue}`);
            if (!bestMatch || 3 < bestMatch.priority) {
              bestMatch = {
                value: idValue,
                source: toolName,
                priority: 3
              };
            }
          }
        }
      }
      
      // Priority 4: ID field matching without schema verification (fallback)
      else if (typeof data === 'object' && data !== null && !Array.isArray(data) && idPrefix) {
        const normalizedPrefix = normalizeForComparison(idPrefix);
        const normalizedToolName = normalizeForComparison(toolName);
        const toolBaseName = normalizedToolName.replace(/^(create|list|get|update|delete|upsert)/, '');
        
        if (normalizedToolName.includes(normalizedPrefix) || 
            toolBaseName === normalizedPrefix ||
            normalizedPrefix.includes(toolBaseName)) {
          
          const idValue = data.id || data.ID;
          if (idValue !== undefined && idValue !== null) {
            console.log(`[findMatchingValue] Matched ID field ${fieldName} with ${toolName} -> id: ${idValue} (no schema verification)`);
            if (!bestMatch || 4 < bestMatch.priority) {
              bestMatch = {
                value: idValue,
                source: toolName,
                priority: 4
              };
            }
          }
        }
      }

      // Priority 5: Check nested data structures (for list/paginated responses)
      if (typeof data === 'object' && data !== null && idPrefix && data.data && Array.isArray(data.data) && data.data.length > 0) {
        const firstItem = data.data[0];
        const normalizedPrefix = normalizeForComparison(idPrefix);
        const normalizedToolName = normalizeForComparison(toolName);
        const toolBaseName = normalizedToolName.replace(/^(create|list|get|update|delete|upsert)/, '');
        
        if ((normalizedToolName.includes(normalizedPrefix) || toolBaseName === normalizedPrefix) && firstItem.id) {
          console.log(`[findMatchingValue] Found ID in nested data for ${fieldName}: ${firstItem.id}`);
          if (!bestMatch || 5 < bestMatch.priority) {
            bestMatch = {
              value: firstItem.id,
              source: toolName,
              priority: 5
            };
          }
        }
      }
    }

    if (bestMatch) {
      console.log(`[findMatchingValue] Best match for ${fieldName}: ${bestMatch.value} from ${bestMatch.source} (priority ${bestMatch.priority})`);
    } else {
      console.log(`[findMatchingValue] No match found for ${fieldName}`);
    }

    return bestMatch ? { value: bestMatch.value, source: bestMatch.source } : null;
  }

  // Function to detect potential prerequisite tools for a test
  function detectPrerequisites(test: any): string[] {
    if (!test.details?.inputSchema?.properties) return [];
    
    const prerequisites: string[] = [];
    const required = test.details.inputSchema.required || [];
    
    // Check for common dependency patterns in required fields
    for (const fieldName of required) {
      const idPrefix = extractIdPrefix(fieldName);
      
      if (idPrefix) {
        // Field is an ID field (e.g., project_id, projectId, testset_id, testsetId)
        const normalizedPrefix = normalizeForComparison(idPrefix);
        
        console.log(`[detectPrerequisites] Checking dependencies for ${fieldName} (prefix: ${idPrefix}, normalized: ${normalizedPrefix})`);
        
        // Look for matching tools (handles both camelCase and snake_case)
        const matchingTools = results.tests
          .filter(t => {
            if (!t.details?.toolName) return false;
            const normalizedToolName = normalizeForComparison(t.details.toolName);
            const toolBaseName = normalizedToolName.replace(/^(create|list|get|update|delete|upsert)/, '');
            
            // Match if tool name includes the prefix
            // Examples: "createprojects" or "projects" matches "project"
            const matches = normalizedToolName.includes(normalizedPrefix) || 
                           toolBaseName === normalizedPrefix ||
                           normalizedPrefix === toolBaseName;
            
            if (matches) {
              console.log(`[detectPrerequisites] Found potential prerequisite: ${t.details.toolName}`);
            }
            
            return matches;
          })
          .filter(t => t.details?.toolName !== test.details?.toolName); // Don't include self
        
        // Prefer "create" tools as prerequisites
        const createTools = matchingTools.filter(t => t.details?.toolName?.toLowerCase().includes('create'));
        const toolsToCheck = createTools.length > 0 ? createTools : matchingTools;
        
        if (toolsToCheck.length > 0 && toolsToCheck[0].details?.toolName) {
          const toolName = toolsToCheck[0].details.toolName;
          if (!executionContext.has(toolName)) {
            console.log(`[detectPrerequisites] Adding prerequisite: ${toolName} for field ${fieldName}`);
            prerequisites.push(toolName);
          }
        }
      }
    }
    
    return [...new Set(prerequisites)]; // Remove duplicates
  }

  // Function to detect if a value is a placeholder/invalid
  function isPlaceholderValue(value: any, fieldName: string, fieldSchema: any): boolean {
    if (value === null || value === undefined || value === '') return true;
    
    // String placeholders
    if (typeof value === 'string') {
      // Common placeholder patterns
      const placeholderPatterns = [
        /^test-/i,                    // test-xxx
        /^test_/i,                    // test_xxx
        /^sample_/i,                  // sample_xxx
        /^placeholder/i,              // placeholder
        /^dummy/i,                    // dummy
        /^example/i,                  // example
        /^tmp/i,                      // tmp
        /^12345678-1234-1234-1234/,  // default UUID pattern
      ];
      
      // Exact matches
      if (value === 'test_value' || 
          value === 'Sample description for ' + fieldName ||
          value.includes('sample_item')) {
        return true;
      }
      
      // Pattern matches
      return placeholderPatterns.some(pattern => pattern.test(value));
    }
    
    // Empty objects/arrays
    if (fieldSchema?.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).length === 0;
    }
    
    // Arrays with placeholder items
    if (Array.isArray(value)) {
      return value.length === 0 || value.every(item => 
        item === 'sample_item' || 
        (typeof item === 'string' && (
          item.startsWith('test-') || 
          item.startsWith('test_') ||
          item.startsWith('sample_')
        ))
      );
    }
    
    return false;
  }

  // Function to auto-populate arguments from execution context
  function autoPopulateArguments(originalArgs: any, inputSchema: any): { 
    args: any; 
    autoPopulatedFields: string[];
    missingDependencies: string[];
    invalidFields: string[];
  } {
    console.log('[autoPopulateArguments] Starting with args:', originalArgs);
    console.log('[autoPopulateArguments] Input schema:', inputSchema);
    
    const args = { ...originalArgs };
    const autoPopulatedFields: string[] = [];
    const missingDependencies: string[] = [];
    const invalidFields: string[] = [];
    const required = inputSchema.required || [];

    if (!inputSchema.properties) {
      console.log('[autoPopulateArguments] No properties in schema');
      return { args, autoPopulatedFields, missingDependencies, invalidFields };
    }

    for (const [fieldName, fieldSchema] of Object.entries(inputSchema.properties)) {
      const isRequired = required.includes(fieldName);
      console.log(`[autoPopulateArguments] Processing field: ${fieldName}, required: ${isRequired}, current value:`, args[fieldName]);
      
      // Check if this looks like an ID field (handles both camelCase and snake_case)
      const idPrefix = extractIdPrefix(fieldName);
      const hasGenericValue = typeof args[fieldName] === 'string' && 
        (args[fieldName].startsWith('test-') || args[fieldName] === 'test_value');
      
      // Skip non-ID fields that already have real values
      if (!idPrefix && args[fieldName] !== undefined && args[fieldName] !== null && args[fieldName] !== '' && !hasGenericValue) {
        console.log(`[autoPopulateArguments] Skipping ${fieldName} - already has non-ID value`);
        continue;
      }
      
      // For ID fields or empty/placeholder fields, try to find from execution context
      if (idPrefix || !args[fieldName] || hasGenericValue) {
        // Try to find a matching value from execution context
        const match = findMatchingValue(fieldName, fieldSchema);
        
        if (match) {
          console.log(`[autoPopulateArguments] Auto-populating ${fieldName} with value from execution:`, match.value, '(replacing:', args[fieldName], ')');
          args[fieldName] = match.value;
          autoPopulatedFields.push(fieldName);
        } else if (isRequired && executionContext.size > 0 && idPrefix && isPlaceholderValue(args[fieldName], fieldName, fieldSchema)) {
          // Only mark as missing if it's required, we have context, it's an ID field, and value is placeholder
          console.log(`[autoPopulateArguments] Missing required ID field: ${fieldName} (no match found)`);
          missingDependencies.push(fieldName);
        } else {
          console.log(`[autoPopulateArguments] No match for ${fieldName}, keeping current value:`, args[fieldName]);
        }
      }
    }

    // Check for invalid placeholder values in required fields
    // Skip fields that were successfully auto-populated or already in missingDependencies
    for (const [fieldName, fieldSchema] of Object.entries(inputSchema.properties)) {
      const isRequired = required.includes(fieldName);
      
      // Skip if already auto-populated or marked as missing dependency
      if (autoPopulatedFields.includes(fieldName) || missingDependencies.includes(fieldName)) {
        continue;
      }
      
      if (isRequired && isPlaceholderValue(args[fieldName], fieldName, fieldSchema)) {
        console.log(`[autoPopulateArguments] Field ${fieldName} has placeholder/invalid value:`, args[fieldName]);
        invalidFields.push(fieldName);
      }
    }

    console.log('[autoPopulateArguments] Final args:', args);
    console.log('[autoPopulateArguments] Auto-populated fields:', autoPopulatedFields);
    console.log('[autoPopulateArguments] Missing dependencies:', missingDependencies);
    console.log('[autoPopulateArguments] Invalid/placeholder fields:', invalidFields);
    return { args, autoPopulatedFields, missingDependencies, invalidFields };
  }

  async function executeToolWithPermission(test: any) {
    const { toolName, sampleArguments, inputSchema } = test.details;

    // Use regenerated arguments if available, otherwise use original sampleArguments
    const baseArguments = regeneratedArguments.has(toolName) 
      ? regeneratedArguments.get(toolName)
      : sampleArguments;

    // Auto-populate arguments from execution context (works on both original and regenerated args)
    const { args, autoPopulatedFields, missingDependencies, invalidFields } = autoPopulateArguments(
      baseArguments || {},
      inputSchema || {}
    );

    // Detect prerequisites for this test
    const prerequisites = detectPrerequisites(test);

    // Show permission dialog with auto-populated info
    setShowPermissionDialog({
      testName: test.name,
      toolName,
      description: test.details.description,
      arguments: args,
      inputSchema: inputSchema,
      autoPopulatedFields: autoPopulatedFields.length > 0 ? autoPopulatedFields : undefined,
      missingDependencies: missingDependencies.length > 0 ? missingDependencies : undefined,
      invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
      prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
    });
    // Initialize edited arguments with formatted JSON
    setEditedArguments(JSON.stringify(args, null, 2));
    setArgumentsError(null);
  }

  async function runToolExecution(
    testName: string,
    toolName: string,
    toolArgs: any
  ) {
    setExecutingTools((prev) => new Set(prev).add(testName));

    try {
      const response = await fetch("/api/execute-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          toolName,
          arguments: toolArgs,
          // Include auth token if available (from props or from results)
          authToken: accessToken || results.accessToken,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setToolResults((prev) =>
          new Map(prev).set(testName, {
            ...result,
            error: result.error || "Unknown error occurred",
            formattedError: true,
          })
        );
        setOpenSections((prev) => ({ ...prev, [testName]: true }));
      } else {
        setToolResults((prev) => new Map(prev).set(testName, result));
        setOpenSections((prev) => ({ ...prev, [testName]: false }));
        
        // Store successful result in execution context with schema metadata
        console.log('[runToolExecution] Execution successful for:', toolName);
        console.log('[runToolExecution] Result:', result);
        console.log('[runToolExecution] Storing in execution context with metadata');
        
        // Find the test to get the description
        const test = results.tests.find(t => t.details?.toolName === toolName);
        const description = test?.details?.description;
        
        // Parse response schema from description
        const responseSchema = parseResponseSchema(description);
        const responseFields = extractSchemaFields(responseSchema);
        
        // Infer output schema from actual data
        const parsedData = extractResponseData(result);
        const inferredSchema = inferOutputSchema(parsedData);
        
        console.log('[runToolExecution] Parsed response schema fields:', responseFields);
        console.log('[runToolExecution] Inferred output schema:', inferredSchema);
        
        setExecutionContext((prev) => {
          const newContext = new Map(prev).set(toolName, {
            result,
            description,
            responseSchema: inferredSchema || responseSchema, // Prefer inferred schema
            responseFields: inferredSchema ? Object.keys(inferredSchema.properties || {}) : responseFields,
            inferredOutputSchema: inferredSchema,
          });
          console.log('[runToolExecution] New context size:', newContext.size);
          console.log('[runToolExecution] Context keys:', Array.from(newContext.keys()));
          return newContext;
        });
      }
    } catch (error) {
      setToolResults((prev) =>
        new Map(prev).set(testName, {
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        })
      );
      setOpenSections((prev) => ({ ...prev, [testName]: true }));
    } finally {
      setExecutingTools((prev) => {
        const newSet = new Set(prev);
        newSet.delete(testName);
        return newSet;
      });
    }
  }

  async function handleToolExecution(approved: boolean) {
    if (!showPermissionDialog || !approved) {
      setShowPermissionDialog(null);
      setArgumentsError(null);
      return;
    }

    // Parse and validate the edited arguments
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(editedArguments);
    } catch (error) {
      setArgumentsError("Invalid JSON: " + (error instanceof Error ? error.message : "Unable to parse"));
      return;
    }

    const { testName, toolName } = showPermissionDialog;
    setShowPermissionDialog(null);
    setArgumentsError(null);

    await runToolExecution(testName, toolName, parsedArgs);
  }

  async function executeAllTools() {
    const testsToExecute = results.tests.filter(
      (test) => test.details?.requiresPermission
    );

    if (testsToExecute.length === 0) {
      alert("No tools available for execution.");
      return;
    }

    const confirmed = window.confirm(
      `Execute ${testsToExecute.length} tool${
        testsToExecute.length > 1 ? "s" : ""
      } with their sample arguments?`
    );

    if (!confirmed) return;

    setExecutingAll(true);

    try {
      const executionPromises = testsToExecute.map(async (test) => {
        const toolName = test.details?.toolName;
        const sampleArguments = test.details?.sampleArguments;
        const inputSchema = test.details?.inputSchema;

        if (!toolName) {
          setToolResults((prev) =>
            new Map(prev).set(test.name, {
              success: false,
              error: "Tool name not provided for execution",
            })
          );
          return;
        }

        // Use regenerated arguments if available, otherwise use original sampleArguments
        const baseArguments = regeneratedArguments.has(toolName) 
          ? regeneratedArguments.get(toolName)
          : sampleArguments;

        if (typeof baseArguments === "undefined") {
          setToolResults((prev) =>
            new Map(prev).set(test.name, {
              success: false,
              error: "Sample arguments not available for this tool",
            })
          );
          return;
        }

        // Auto-populate arguments from execution context
        const { args } = autoPopulateArguments(
          baseArguments || {},
          inputSchema || {}
        );

        await runToolExecution(test.name, toolName, args);
      });

      await Promise.all(executionPromises);
    } finally {
      setExecutingAll(false);
    }
  }

  async function regenerateTestsWithContext() {
    if (executionContext.size === 0) {
      alert("No execution context available. Run some tools first to build context.");
      return;
    }

    // Find tools that haven't been executed yet
    const unexecutedTools = results.tests
      .filter((test) => {
        const toolName = test.details?.toolName;
        return toolName && !executionContext.has(toolName) && test.details?.requiresPermission;
      })
      .map((test) => ({
        name: test.details!.toolName!,
        description: test.details!.description,
        inputSchema: test.details!.inputSchema,
      }));

    if (unexecutedTools.length === 0) {
      alert("All tools have already been executed. No tests to regenerate.");
      return;
    }

    const confirmed = window.confirm(
      `Regenerate test arguments for ${unexecutedTools.length} tool${unexecutedTools.length > 1 ? 's' : ''} using execution context from ${executionContext.size} completed tool(s)?`
    );

    if (!confirmed) return;

    setIsRegenerating(true);

    try {
      // Convert executionContext Map to plain object for JSON serialization
      const contextObj: Record<string, any> = {};
      executionContext.forEach((value, key) => {
        contextObj[key] = value;
      });

      console.log('[regenerateTestsWithContext] Sending request with context:', Object.keys(contextObj));

      const response = await fetch("/api/regenerate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: unexecutedTools,
          serverUrl: serverUrl,
          executionContext: contextObj,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[regenerateTestsWithContext] Successfully regenerated arguments:', result.arguments);
        
        // Update regenerated arguments state
        setRegeneratedArguments((prev) => {
          const newMap = new Map(prev);
          Object.entries(result.arguments).forEach(([toolName, args]) => {
            newMap.set(toolName, args);
          });
          return newMap;
        });
        
        alert(
          `✅ Successfully regenerated arguments for ${unexecutedTools.length} tool${unexecutedTools.length > 1 ? 's' : ''} using ${result.contextUsed} execution context${result.contextUsed > 1 ? 's' : ''}!\n\nThe updated arguments will be used when you execute these tools.`
        );
      } else {
        alert(`Regeneration failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Regeneration error:", error);
      alert("Failed to regenerate tests. Check console for details.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function regenerateSingleTool(toolName: string, description: string, inputSchema: any) {
    if (executionContext.size === 0) {
      alert("No execution context available. Run some tools first to build context.");
      return;
    }

    setIsRegeneratingSingle(true);

    try {
      // Convert executionContext Map to plain object for JSON serialization
      const contextObj: Record<string, any> = {};
      executionContext.forEach((value, key) => {
        contextObj[key] = value;
      });

      console.log(`[regenerateSingleTool] Regenerating ${toolName} with ${executionContext.size} context(s)`);

      const response = await fetch("/api/regenerate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: [{
            name: toolName,
            description: description,
            inputSchema: inputSchema,
          }],
          serverUrl: serverUrl,
          executionContext: contextObj,
        }),
      });

      const result = await response.json();

      if (result.success && result.arguments[toolName]) {
        console.log(`[regenerateSingleTool] Successfully regenerated for ${toolName}:`, result.arguments[toolName]);
        
        // Update regenerated arguments state
        setRegeneratedArguments((prev) => {
          const newMap = new Map(prev);
          newMap.set(toolName, result.arguments[toolName]);
          return newMap;
        });
        
        // Apply auto-population to the regenerated args
        const { args } = autoPopulateArguments(
          result.arguments[toolName],
          inputSchema || {}
        );
        
        // Update the edited arguments in the dialog
        setEditedArguments(JSON.stringify(args, null, 2));
        setArgumentsError(null);
        
        // Don't show alert since user is actively looking at the dialog
        console.log(`✅ Arguments regenerated using ${result.contextUsed} execution context${result.contextUsed > 1 ? 's' : ''}`);
        
        // Update the dialog state to remove warnings now that args are regenerated
        if (showPermissionDialog) {
          const { autoPopulatedFields } = autoPopulateArguments(
            result.arguments[toolName],
            inputSchema || {}
          );
          setShowPermissionDialog({
            ...showPermissionDialog,
            arguments: args,
            autoPopulatedFields: autoPopulatedFields.length > 0 ? autoPopulatedFields : undefined,
            missingDependencies: undefined, // Clear since we regenerated
            invalidFields: undefined, // Clear since we regenerated
          });
        }
      } else {
        alert(`Regeneration failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Single tool regeneration error:", error);
      alert("Failed to regenerate. Check console for details.");
    } finally {
      setIsRegeneratingSingle(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Simple header for results */}
      <div className="border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center gap-4">
          <NextLink 
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
            title="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </NextLink>
          <span>MCP Eval</span>
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={serverUrl}
                disabled
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-sm"
                placeholder="Enter MCP server URL"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Permission Dialog */}
      {showPermissionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Permission Required
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  The tool <strong>{showPermissionDialog.toolName}</strong>{" "}
                  wants to execute with the following arguments:
                </p>
              </div>
            </div>

            {/* Auto-populated fields indicator */}
            {showPermissionDialog.autoPopulatedFields && showPermissionDialog.autoPopulatedFields.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">
                      Auto-populated from previous executions
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Fields: {showPermissionDialog.autoPopulatedFields.map(f => `"${f}"`).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Missing dependencies warning */}
            {showPermissionDialog.missingDependencies && showPermissionDialog.missingDependencies.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">
                      Missing required fields
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Consider executing prerequisite tools first to populate: {showPermissionDialog.missingDependencies.map(f => `"${f}"`).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Invalid/placeholder fields warning */}
            {showPermissionDialog.invalidFields && showPermissionDialog.invalidFields.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900">
                      ⚠️ Placeholder values detected
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      These fields have generic/invalid values and need editing: {showPermissionDialog.invalidFields.map(f => `"${f}"`).join(", ")}
                    </p>
                    <p className="text-xs text-orange-600 mt-1 font-medium">
                      Please edit the arguments below before executing to avoid errors.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Prerequisites tip */}
            {showPermissionDialog.prerequisites && showPermissionDialog.prerequisites.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      💡 Tip
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Execute <span className="font-mono font-semibold">{showPermissionDialog.prerequisites.join(", ")}</span> first to auto-populate required fields
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded p-3 mb-4">
              <p className="text-xs text-gray-500 mb-2">Tool Description:</p>
              <div className="text-sm text-gray-700 mb-3 max-h-24 overflow-y-auto pr-2">
                {showPermissionDialog.description}
              </div>
              <p className="text-xs text-gray-500 mb-2">Arguments (editable):</p>
              <textarea
                value={editedArguments}
                onChange={(e) => {
                  setEditedArguments(e.target.value);
                  setArgumentsError(null);
                }}
                className="w-full text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-32 min-h-[8rem] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                spellCheck={false}
              />
              {argumentsError && (
                <p className="text-xs text-red-600 mt-1">{argumentsError}</p>
              )}
            </div>

            <div className="flex gap-3 justify-between">
              {executionContext.size > 0 && showPermissionDialog && (
                <button
                  onClick={() => {
                    regenerateSingleTool(
                      showPermissionDialog.toolName,
                      showPermissionDialog.description || '',
                      showPermissionDialog.inputSchema
                    );
                  }}
                  disabled={isRegeneratingSingle}
                  className="px-4 py-2 text-purple-600 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  title={`Regenerate arguments using ${executionContext.size} execution context${executionContext.size > 1 ? 's' : ''}`}
                >
                  {isRegeneratingSingle ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate Dataset ({executionContext.size})
                    </>
                  )}
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => handleToolExecution(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToolExecution(true)}
                  className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  Execute Tool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {/* Header with URL */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  MCP Server Evaluation
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {scorecard.serverUrl}
                </h2>
              </div>
              <div className="text-xs text-slate-500">
                Tested {scorecard.testedAt}
              </div>
            </div>
          </div>

          {/* Lighthouse-style metrics with donuts */}
          <div className="bg-slate-50 px-8 py-10">
            <div className="flex justify-center items-center gap-10 flex-wrap">
              <DonutChart 
                score={scorecard.tests.passRate ?? 0} 
                label="Test Pass Rate" 
                size={112} 
                strokeWidth={8} 
              />
              <DonutChart 
                score={scorecard.tests.executed > 0 
                  ? Math.round((scorecard.tests.passed / scorecard.tests.executed) * 100)
                  : 0
                } 
                label="Tool Execution" 
                size={112} 
                strokeWidth={8} 
              />
              <DonutChart 
                score={scorecard.resources.status === "Success" ? 100 
                  : scorecard.resources.status === "Failed" ? 0 : 50
                } 
                label="Resource Discovery" 
                size={112} 
                strokeWidth={8} 
              />
              <DonutChart 
                score={scorecard.compatibility.entries.length > 0
                  ? Math.round((scorecard.compatibility.entries.filter(e => e.compatible).length / 
                    scorecard.compatibility.entries.length) * 100)
                  : 0
                } 
                label="Client Support" 
                size={112} 
                strokeWidth={8} 
              />
            </div>
          </div>

          {/* Detailed metrics */}
          <div className="grid gap-6 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Authentication
                </p>
                <div className={`w-2 h-2 rounded-full ${
                  scorecard.auth.label.includes("OAuth") ? "bg-blue-500" : "bg-green-500"
                }`}></div>
              </div>
              <p className="text-base font-semibold text-slate-900 mb-1">
                {scorecard.auth.label}
              </p>
              <p className="text-sm text-slate-600 mb-3">
                {scorecard.auth.detail}
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Connection Test</span>
                  <span className="font-medium text-green-600">✓ Passed</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Tools Discovered
                </p>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">
                {results.tests.filter(t => t.details?.requiresPermission).length}
              </p>
              <p className="text-sm text-slate-600 mb-3">
                Tools available for execution
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Tests Executed</span>
                  <span className="font-medium text-slate-700">{scorecard.tests.executed}/{scorecard.tests.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pass Rate</span>
                  <span className="font-medium text-green-600">{scorecard.tests.passRate ?? 0}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Resource Discovery
                </p>
                <div className={`w-2 h-2 rounded-full ${
                  scorecard.resources.status === "Success" ? "bg-green-500" 
                  : scorecard.resources.status === "Failed" ? "bg-red-500" 
                  : "bg-gray-400"
                }`}></div>
              </div>
              <p className={`text-base font-semibold mb-1 ${
                scorecard.resources.status === "Success" ? "text-emerald-600"
                : scorecard.resources.status === "Failed" ? "text-rose-600"
                : "text-slate-700"
              }`}>
                {scorecard.resources.status}
              </p>
              <p className="text-sm text-slate-600 mb-3">
                {scorecard.resources.detail || "Resource discovery attempted"}
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Schema Valid</span>
                  <span className="font-medium text-green-600">
                    {scorecard.resources.status === "Success" ? "✓ Yes" : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Compatibility Section */}
          {scorecard.compatibility.entries.length > 0 && (
            <div className="border-t border-slate-200 px-6 py-5 bg-slate-50/50">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">
                Client Compatibility
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {scorecard.compatibility.entries.map((entry) => {
                  const clientInitial = entry.client.charAt(0).toUpperCase();
                  const bgColor = entry.client.toLowerCase().includes('openai') 
                    ? 'from-green-400 to-green-600'
                    : entry.client.toLowerCase().includes('claude')
                    ? 'from-orange-400 to-orange-600'
                    : 'from-blue-400 to-blue-600';
                  
                  return (
                    <div key={entry.client} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-slate-200 shadow-sm">
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${bgColor} flex items-center justify-center text-white font-bold text-lg`}>
                          {clientInitial}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900 text-sm">
                            {entry.client}
                          </span>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${
                            entry.compatible ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {entry.compatible ? "✓ Compatible" : "⚠ Issues"}
                          </span>
                        </div>
                        {entry.reason && (
                          <p className="text-xs text-slate-600">
                            {entry.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Copy link
                </>
              )}
            </button>
            <a
              href={`https://smithery.ai/search?q=${encodeURIComponent(smitherySearchTerm)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
              title={`Search for "${smitherySearchTerm}" on Smithery`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Find on Smithery
            </a>
          </div>
          <div className="flex gap-2">
            <button
            onClick={executeAllTools}
            disabled={
              !hasExecutableTools || executingAll || executingTools.size > 0
            }
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executingAll ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Executing all...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                Execute all
              </>
            )}
          </button>
          {executionContext.size > 0 && (
            <button
              onClick={regenerateTestsWithContext}
              disabled={isRegenerating || executingAll || executingTools.size > 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Use execution results from ${executionContext.size} completed tool(s) to generate better arguments for remaining tools`}
            >
              {isRegenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate Dataset ({executionContext.size})
                </>
              )}
            </button>
          )}
          </div>
        </div>

        {/* Test Summary Card */}
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-5 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                Test Execution Results
              </p>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-700 font-semibold">{scorecard.tests.passed} passed</span>
                </div>
                <span className="text-slate-400">•</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-slate-600">{scorecard.tests.executed - scorecard.tests.passed} failed</span>
                </div>
                {scorecard.tests.pending > 0 && (
                  <>
                    <span className="text-slate-400">•</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      <span className="text-slate-600">{scorecard.tests.pending} pending</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-200">
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{scorecard.tests.total}</p>
              <p className="text-xs text-slate-600 mt-1">Total Tests</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-green-600">{scorecard.tests.passed}</p>
              <p className="text-xs text-slate-600 mt-1">Passed</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-red-600">{scorecard.tests.executed - scorecard.tests.passed}</p>
              <p className="text-xs text-slate-600 mt-1">Failed</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{scorecard.tests.passRate ?? 0}%</p>
              <p className="text-xs text-slate-600 mt-1">Success Rate</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {results.tests.map((test, index) => {
            console.log(`🔄 [RENDER] Rendering test ${index}: ${test.name}`, {
              toolName: test.details?.toolName,
              requiresPermission: test.details?.requiresPermission,
            });
            const executionResult = toolResults.get(test.name);
            const requiresPermission = Boolean(
              test.details?.requiresPermission
            );
            const hasExecutedResult = Boolean(executionResult);
            const wasExecuted =
              !requiresPermission ||
              Boolean(test.details?.executed) ||
              hasExecutedResult;

            let statusClass = "bg-gray-300";

            if (hasExecutedResult) {
              statusClass = executionResult?.success
                ? "bg-green-500"
                : "bg-red-500";
            } else if (!requiresPermission || wasExecuted) {
              statusClass = test.passed ? "bg-green-500" : "bg-red-500";
            }

            const hasBeenExecuted =
              hasExecutedResult ||
              !requiresPermission ||
              Boolean(test.details?.executed);
            const success = executionResult
              ? Boolean(executionResult.success)
              : Boolean(test.passed);
            const computedDefaultOpen = hasBeenExecuted ? !success : false;
            const isOpen = openSections[test.name] ?? computedDefaultOpen;
            
            // Detect if this test has unmet prerequisites
            const prerequisites = requiresPermission && !hasExecutedResult 
              ? detectPrerequisites(test) 
              : [];
            
            // Compute effective arguments (regenerated + auto-populated)
            let effectiveTest = test;
            let effectiveAutoPopulatedFields: string[] | undefined;
            
            if (test.details?.toolName && test.details?.requiresPermission && !hasExecutedResult) {
              const toolName = test.details.toolName;
              const sampleArguments = test.details.sampleArguments;
              const inputSchema = test.details.inputSchema;
              
              console.log(`🔍 [REACTIVE] Computing args for ${toolName}`, {
                hasRegeneratedArgs: regeneratedArguments.has(toolName),
                executionContextSize: executionContext.size,
                executionContextKeys: Array.from(executionContext.keys()),
              });
              
              // Use regenerated arguments if available, otherwise use original
              const baseArguments = regeneratedArguments.has(toolName) 
                ? regeneratedArguments.get(toolName)
                : sampleArguments;
              
              console.log(`🔍 [REACTIVE] Base arguments for ${toolName}:`, baseArguments);
              
              // Apply auto-population from execution context
              const { args, autoPopulatedFields } = autoPopulateArguments(
                baseArguments || {},
                inputSchema || {}
              );
              
              console.log(`🔍 [REACTIVE] After auto-populate for ${toolName}:`, {
                autoPopulatedFields,
                updatedArgs: args,
              });
              
              // If any fields were auto-populated, update the test details
              if (autoPopulatedFields.length > 0 || regeneratedArguments.has(toolName)) {
                effectiveTest = {
                  ...test,
                  details: {
                    ...test.details,
                    sampleArguments: args,
                  }
                };
                effectiveAutoPopulatedFields = autoPopulatedFields.length > 0 ? autoPopulatedFields : undefined;
                
                console.log(`✅ [REACTIVE] Updated effective test for ${toolName}`, {
                  effectiveAutoPopulatedFields,
                  hasUpdates: true,
                });
              } else {
                console.log(`⚠️ [REACTIVE] No updates for ${toolName} - no auto-population or regeneration`);
              }
            }
            
            // Check if this tool has regenerated arguments
            const hasRegeneratedArgs = test.details?.toolName 
              ? regeneratedArguments.has(test.details.toolName)
              : false;

            // Log what we're passing to TestDetails
            if (effectiveAutoPopulatedFields && effectiveAutoPopulatedFields.length > 0) {
              console.log(`🎨 [PASSING TO TestDetails] ${test.details?.toolName}:`, {
                autoPopulatedFields: effectiveAutoPopulatedFields,
                hasRegeneratedArgs,
                sampleArguments: effectiveTest.details?.sampleArguments,
              });
            }

            return (
              <TestDetails
                key={`${index}-${executionContext.size}-${regeneratedArguments.size}`}
                test={effectiveTest}
                statusClass={statusClass}
                isOpen={isOpen}
                onToggle={(open) =>
                  setOpenSections((prev) => ({ ...prev, [test.name]: open }))
                }
                onRequestExecute={executeToolWithPermission}
                isExecuting={executingTools.has(test.name)}
                executionResult={executionResult}
                prerequisites={prerequisites.length > 0 ? prerequisites : undefined}
                hasRegeneratedArgs={hasRegeneratedArgs}
                autoPopulatedFields={effectiveAutoPopulatedFields}
              />
            );
          })}
        </div>

        {/* OAuth Authorization Card */}
        {authRequired && (
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Authentication Required
                </h3>
                <p className="text-blue-800 mb-4">
                  This MCP server requires OAuth authentication. Click below to
                  authorize MCP Eval to access your server.
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

        {/* Call to Action Section */}
        <div className="mt-12 mb-8 p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 border border-blue-200 rounded-2xl">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              This is cool; what's my next step?
            </h3>
            <p className="text-gray-600">
              Take your MCP testing to the next level
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Sign up CTA */}
            <a
              href="https://scorecard.io"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 bg-white border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    Sign up for Scorecard
                  </h4>
                  <p className="text-sm text-gray-600">
                    Build, test, and monitor AI applications with comprehensive evaluation tools
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:gap-3 transition-all">
                    <span>Get started</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>

            {/* Contact CTA */}
            <a
              href="https://www.scorecard.io/book-a-demo"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 bg-white border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                    Automated MCP Evals in CI/CD
                  </h4>
                  <p className="text-sm text-gray-600">
                    Contact us to set up automated MCP evaluations in your CI/CD pipeline
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium text-purple-600 group-hover:gap-3 transition-all">
                    <span>Contact us</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
