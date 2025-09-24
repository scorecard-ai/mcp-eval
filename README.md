# MCP Eval

<div align="center">

[![Live Demo](https://img.shields.io/badge/🔴-Live%20Demo-red?style=for-the-badge)](https://www.mcpevals.ai)
[![GitHub Stars](https://img.shields.io/github/stars/scorecard-ai/mcp-eval?style=for-the-badge)](https://github.com/scorecard-ai/mcp-eval/stargazers)
[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/keUXXXdR)

**Test MCP servers instantly with OAuth support and intelligent test generation**

</div>

## Features

- 🔐 **OAuth Support** - Full OAuth 2.0 with PKCE
- 🧠 **Smart Testing** - Generates realistic test arguments based on tool schemas
- 🌊 **Real-time Results** - Live streaming of test progress
- 🎯 **Comprehensive** - Tests tools, resources, and authentication
- ⚡ **Fast** - Results in seconds, not minutes

## Quick Start

### Web App

Visit [mcpevals.ai](https://www.mcpevals.ai) → Paste MCP URL → Click "Evaluate"

### Self-Host

```bash
git clone https://github.com/scorecard-ai/mcp-eval.git
cd mcp-eval/mcp-eval-site
npm install
npm run dev
```

Set environment variables in `.env.local`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=your-key-here
```

## How It Works

1. **Enter MCP Server URL** - Supports both public and OAuth-protected servers
2. **Automatic OAuth Flow** - Handles discovery, registration, and authorization
3. **Intelligent Testing** - Generates appropriate test data for each tool
4. **Real-time Results** - See tests run live with detailed feedback

## Example Test Generation

```javascript
// Tool: search_users
// Generated arguments:
{ "query": "test search", "limit": 10 }

// Tool: create_task
// Generated arguments:
{ "title": "Test Task", "priority": "medium" }
```

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- MCP SDK
- Server-Sent Events for streaming

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Powered by Scorecard

Built by [Scorecard AI](https://scorecard.ai), the leading platform for AI evaluation and testing.

## License

MIT © [Scorecard AI](https://scorecard.ai)

---

<div align="center">

[Website](https://www.mcpevals.ai) • [Discord](https://discord.gg/keUXXXdR) • [GitHub](https://github.com/scorecard-ai/mcp-eval)

</div>