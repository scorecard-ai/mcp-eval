# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Development server:
```bash
cd mcp-eval-site && npm run dev
```

Build for production:
```bash
cd mcp-eval-site && npm run build
```

Start production server:
```bash
cd mcp-eval-site && npm run start
```

Lint code:
```bash
cd mcp-eval-site && npm run lint
```

## Architecture Overview

This is an MCP (Model Context Protocol) server evaluation tool built with Next.js 15 and TypeScript. The application provides a web interface for testing and evaluating MCP servers, with support for both authenticated and unauthenticated servers.

### Core Components

**Frontend (`app/page.tsx`)**
- Google-style search interface for MCP server URLs
- OAuth authorization flow handling with localStorage state management
- Real-time test results display with comprehensive error handling
- Supports both basic evaluation and auto-evaluation modes

**API Layer (`app/api/eval/route.ts`)**
- Main evaluation endpoint handling both authenticated and unauthenticated MCP servers
- OAuth discovery using `.well-known/oauth-authorization-server` endpoints
- Dynamic OAuth client registration with PKCE flow
- Token exchange and authenticated MCP client testing
- Multi-dimensional scoring for auto-evaluation mode

**OAuth Flow (`app/api/mcp-auth-callback/route.ts`)**
- Handles OAuth callback redirects with authorization codes
- Manages state parameter validation and error handling

### OAuth Implementation

The OAuth flow supports MCP servers that require authentication:

1. **Discovery**: Automatically detects OAuth endpoints via well-known URLs
2. **Registration**: Dynamically registers OAuth clients using Dynamic Client Registration (DCR)
3. **Authorization**: Redirects users to OAuth provider for consent
4. **Token Exchange**: Exchanges authorization codes for access tokens using PKCE
5. **Authenticated Testing**: Uses Bearer tokens with MCP SDK StreamableHTTPClientTransport

### MCP SDK Integration

Uses `@modelcontextprotocol/sdk` for:
- **SSEClientTransport**: Server-Sent Events transport for unauthenticated connections
- **StreamableHTTPClientTransport**: HTTP transport with OAuth Bearer token support
- **Client**: Main MCP client for tool/resource discovery and testing

### Key Implementation Details

- **Port Handling**: Dynamic host detection for OAuth redirects (handles development vs production)
- **State Management**: Uses localStorage to preserve server URLs across OAuth redirects
- **Error Handling**: Comprehensive error handling for network failures, OAuth errors, and MCP protocol issues
- **Scope Management**: Uses 'openid' scope for OAuth registration (scorecard.io compatible)

The application is designed to work with real MCP servers in production, supporting the full spectrum from simple HTTP connectivity tests to complex authenticated tool evaluations.