# 🚀 MCP Eval

[![Live Demo](https://img.shields.io/badge/🔴-Live%20Demo-red?style=for-the-badge)](https://www.mcpevals.ai)
[![GitHub Stars](https://img.shields.io/github/stars/scorecard-ai/mcp-eval?style=for-the-badge)](https://github.com/scorecard-ai/mcp-eval/stargazers)
[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/keUXXXdR)

**Test any MCP server in seconds** - OAuth support, real-time results, intelligent test generation.

[🌐 Try it Now](https://www.mcpevals.ai) • [📖 Docs](#quick-start) • [💬 Discord](https://discord.gg/keUXXXdR)

## What is MCP Eval?

The first comprehensive testing platform for [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers. Test tools, resources, and authentication flows with one click.

## ✨ Key Features

- **🔐 OAuth Support** - Full OAuth 2.0 with PKCE, dynamic client registration
- **🧪 Smart Testing** - Automatically generates test arguments based on tool schemas
- **⚡ Real-time Results** - Stream test progress as it happens
- **🔍 Comprehensive** - Tests tools, resources, prompts, and performance

## 🚀 Quick Start

### Web (Easiest)

Visit [mcpevals.ai](https://www.mcpevals.ai) and enter your MCP server URL.

### Self-Host

```bash
git clone https://github.com/scorecard-ai/mcp-eval.git
cd mcp-eval/mcp-eval-site
npm install
npm run dev
# Open http://localhost:3000
```

Set environment variables:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=your-key  # Optional, for AI features
```

## 🧠 How It Works

MCP Eval intelligently tests your server by:

1. **Discovering** all available tools and resources
2. **Generating** appropriate test data for each tool
3. **Executing** tests with proper authentication
4. **Reporting** results with timing and error details

Example test generation:
```javascript
// For tool: search_users
{ query: "test search", limit: 10 }

// For tool: create_task
{ title: "Test Task", priority: "medium" }
```

## 🛠️ Tech Stack

- **Next.js 15** - React framework
- **MCP SDK** - Official TypeScript SDK
- **Server-Sent Events** - Real-time streaming
- **Tailwind CSS** - Styling

## 🏆 Powered by Scorecard

Built by [Scorecard AI](https://scorecard.ai), the leading platform for AI evaluation and testing.

## 📜 License

MIT © [Scorecard AI](https://scorecard.ai)

---

<div align="center">

⭐ **Star us on GitHub** • [Discord](https://discord.gg/keUXXXdR) • [Website](https://www.mcpevals.ai)

</div>