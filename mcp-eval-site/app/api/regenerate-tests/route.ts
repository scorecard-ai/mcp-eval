/**
 * API endpoint to regenerate test arguments based on execution context
 * 
 * This endpoint allows regenerating test arguments after some tools have been executed,
 * using the actual execution results to inform better argument generation for remaining tools.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Helper function to extract actual data from MCP response
 */
function extractActualData(result: any): any {
  const contentArray = result.result || result.content;
  if (!contentArray) return result;
  
  try {
    const textContent = Array.isArray(contentArray) 
      ? contentArray.find((c: any) => c.type === 'text')
      : null;
      
    if (textContent?.text) {
      return JSON.parse(textContent.text);
    }
  } catch (e) {
    // Return raw if parsing fails
  }
  
  return result;
}

/**
 * Helper function to clean markdown code fences from LLM response
 */
function cleanLLMResponse(text: string): string {
  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = text.trim();
  
  // Remove opening fence with optional language identifier
  cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
  
  // Remove closing fence
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  
  return cleaned.trim();
}

/**
 * Generates sample arguments using execution context
 */
async function generateWithContext(
  tools: Array<{ name: string; description?: string; inputSchema?: any }>,
  serverUrl: string,
  executionContext: Record<string, {
    result: any;
    description?: string;
    responseSchema?: any;
    responseFields?: string[];
  }>
): Promise<Record<string, any>> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  // Build execution context section
  const contextExamples = Object.entries(executionContext)
    .map(([toolName, context]) => {
      const data = extractActualData(context.result);
      return `Tool: ${toolName}
Description: ${context.description || 'N/A'}
Actual Output Example:
${JSON.stringify(data, null, 2)}
${context.responseFields ? `Response Fields: ${context.responseFields.join(', ')}` : ''}`;
    })
    .join('\n\n---\n\n');
  
  const executionContextSection = `
EXECUTION CONTEXT (Real outputs from previous tool executions):
${contextExamples}

IMPORTANT: Use the actual output examples above to:
1. Understand what IDs and values are ACTUALLY returned by tools
2. Use these real IDs in dependent tools (e.g., if create_project returned {id: "proj_123"}, use "proj_123" in tools that need project_id)
3. Match the actual output format and field names you see
4. Avoid placeholder values when you have real data available

`;

  const prompt = `Generate a CONSISTENT SET of realistic test arguments for these ${tools.length} MCP tools.

Server: ${serverUrl}

${executionContextSection}
IMPORTANT: Generate arguments that form a coherent test scenario across ALL tools.
- If one tool creates something (e.g., create_project), use realistic IDs in tools that reference it
- Use consistent naming, values, and context across all tools
- Make the arguments tell a story of how these tools would be used together
- **USE THE ACTUAL OUTPUT VALUES from execution context in dependent tools**

TOOLS:
${tools.map((tool, idx) => `
Tool ${idx + 1}: ${tool.name}
Description: ${tool.description || "No description provided"}
Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`).join('\n\n---')}

RULES:
1. Match each schema EXACTLY - respect all types, constraints (min/max/minLength/maxLength), required fields, and enums
2. Use realistic values appropriate for the service (analyze the server URL and tool names)
3. Numbers: Use positive integers for limit/count/page (1-100), respect min/max constraints
4. Strings: Use meaningful text (no Lorem Ipsum gibberish), proper formats for email/url/uuid/date-time
5. Arrays: Use concrete field names like ["user_query", "context"] for inputs, ["assistant_response"] for expected
6. Objects: For jsonSchema fields and field mappings, use PROPER JSON Schema structure: {"type": "object", "properties": {...}, "required": [...]}
7. Optional fields: OMIT cursor/nextCursor/page/offset/jq_filter unless required
8. Cross-tool consistency: If a tool creates/updates something, use that same identifier in related tools
9. **PRIORITY**: Prefer REAL IDs and values from execution context over generated placeholders

Return ONLY valid JSON in this exact format:
{
  "tool_name_1": { ...arguments for tool 1... },
  "tool_name_2": { ...arguments for tool 2... },
  ...
}`;

  const { text } = await generateText({
    model: openai("gpt-4o"),
    system: "You are a JSON generator that only outputs valid JSON without any markdown formatting or explanations. Generate consistent, coherent test data across multiple tools. Use real output values from execution context to populate dependent tool inputs.",
    prompt,
    temperature: 0.3,
  });

  // Clean markdown code fences if present
  const cleanedText = cleanLLMResponse(text);
  
  let args: any;
  try {
    args = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("❌ Failed to parse LLM response. Raw text:", text);
    console.error("❌ Cleaned text:", cleanedText);
    throw new Error(`Failed to parse LLM response as JSON. The LLM may have returned invalid JSON. Original error: ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
  }
  
  // Validate each tool's arguments
  for (const tool of tools) {
    if (!args[tool.name]) {
      throw new Error(`LLM response missing tool '${tool.name}'`);
    }
    
    // Validate required fields are present
    const requiredFields = tool.inputSchema?.required || [];
    const missingRequired = requiredFields.filter((field: string) => !(field in args[tool.name]));
    
    if (missingRequired.length > 0) {
      throw new Error(`Tool '${tool.name}' missing required fields: ${missingRequired.join(", ")}`);
    }
  }
  
  return args;
}

/**
 * POST endpoint to regenerate test arguments based on execution context
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { tools, serverUrl, executionContext } = body;

    console.log(`🔄 [regenerate-tests] Received request to regenerate ${tools?.length || 0} tools`);
    console.log(`📊 [regenerate-tests] Execution context size: ${Object.keys(executionContext || {}).length}`);

    if (!tools || !Array.isArray(tools)) {
      return NextResponse.json(
        { error: "Tools array is required" },
        { status: 400 }
      );
    }

    if (!serverUrl) {
      return NextResponse.json(
        { error: "Server URL is required" },
        { status: 400 }
      );
    }

    if (!executionContext || Object.keys(executionContext).length === 0) {
      return NextResponse.json(
        { error: "Execution context is required. Execute some tools first to build context." },
        { status: 400 }
      );
    }

    console.log(`🤖 [regenerate-tests] Generating arguments with execution context...`);
    const regeneratedArgs = await generateWithContext(
      tools,
      serverUrl,
      executionContext
    );

    console.log(`✅ [regenerate-tests] Successfully regenerated arguments for ${Object.keys(regeneratedArgs).length} tools`);

    return NextResponse.json({
      success: true,
      arguments: regeneratedArgs,
      contextUsed: Object.keys(executionContext).length,
    });
  } catch (error) {
    console.error("❌ [regenerate-tests] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Regeneration failed",
      },
      { status: 500 }
    );
  }
}
