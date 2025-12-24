# mcp-for-ynab

A Model Context Protocol (MCP) server for the YNAB (You Need A Budget) API, distributed as a Bun single-file executable with OAuth authentication.

## Features

- **OAuth Authentication**: Secure OAuth 2.0 flow with browser-based authorization
- **MCP Tool**: `call_api` - Make arbitrary YNAB API calls with automatic authentication
- **MCP Resource**: OpenAPI schema for the YNAB API
- **Single-File Executable**: Distributed as a standalone binary (no dependencies to install)
- **Cross-Platform**: Supports Linux, macOS, and Windows

## Prerequisites

### For Development
- [Bun](https://bun.sh/) v1.0 or later

### For Usage
- YNAB OAuth application credentials (see Setup section)
- An MCP client (e.g., Claude Desktop)

## Setup

### 1. Register a YNAB OAuth Application

1. Log in to [YNAB](https://app.ynab.com/)
2. Go to Account Settings > Developer Settings
3. Click "New Application" or "Register New Application"
4. Fill in the details:
   - **Application Name**: Choose any name (e.g., "MCP Server")
   - **Redirect URI**: `http://localhost:3737/oauth/callback`
   - **Website**: Optional
5. Save the application and note your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Set your YNAB OAuth credentials as environment variables:

```bash
export YNAB_CLIENT_ID="your_client_id_here"
export YNAB_CLIENT_SECRET="your_client_secret_here"
```

Or add them to your MCP client configuration (see Claude Desktop section below).

## Development

### Install Dependencies

```bash
bun install
```

### Run in Development Mode

```bash
bun run dev
```

### Build Executables

Build for your current platform:
```bash
bun run build
```

Build for all platforms:
```bash
bun run build:all
```

This creates executables in the `dist/` directory:
- `mcp-ynab-linux` - Linux x64
- `mcp-ynab-macos` - macOS ARM64
- `mcp-ynab.exe` - Windows x64

## Usage with Claude Desktop

### Configuration

Add the MCP server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Linux**: `~/.config/Claude/claude_desktop_config.json`

**Development Mode** (running from source):
```json
{
  "mcpServers": {
    "ynab": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/mcp-for-ynab/src/index.ts"],
      "env": {
        "YNAB_CLIENT_ID": "your_client_id_here",
        "YNAB_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

**Production Mode** (using built executable):
```json
{
  "mcpServers": {
    "ynab": {
      "command": "/absolute/path/to/mcp-ynab-linux",
      "env": {
        "YNAB_CLIENT_ID": "your_client_id_here",
        "YNAB_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

### First Run

1. Start Claude Desktop
2. The MCP server will start automatically
3. When you make your first YNAB API request through Claude:
   - Your browser will open automatically
   - Log in to YNAB and authorize the application
   - The browser will show "Authorization Successful!"
   - Return to Claude Desktop - the request will complete

## Available Tools

### `call_api`

Make arbitrary YNAB API calls with automatic authentication.

**Parameters**:
- `method` (required): HTTP method - one of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- `endpoint` (required): API endpoint path (e.g., `/budgets` or `/budgets/{budget_id}/accounts`)
- `body` (optional): Request body for POST/PUT/PATCH requests (JSON object)
- `headers` (optional): Additional HTTP headers

**Example Usage in Claude Desktop**:

```
Can you get my YNAB budgets?
```

Claude will use the `call_api` tool with:
```json
{
  "method": "GET",
  "endpoint": "/budgets"
}
```

## Available Resources

### `ynab://openapi-schema`

The complete OpenAPI 3.0 specification for the YNAB API, including all endpoints, request/response schemas, and data models.

## Common YNAB API Endpoints

Here are some common endpoints you can use with the `call_api` tool:

- `GET /user` - Get authenticated user info
- `GET /budgets` - List all budgets
- `GET /budgets/{budget_id}` - Get a specific budget
- `GET /budgets/{budget_id}/accounts` - List accounts
- `GET /budgets/{budget_id}/accounts/{account_id}/transactions` - Get transactions for an account
- `GET /budgets/{budget_id}/transactions` - Get all transactions
- `POST /budgets/{budget_id}/transactions` - Create a new transaction
- `GET /budgets/{budget_id}/categories` - List categories
- `GET /budgets/{budget_id}/payees` - List payees
- `GET /budgets/{budget_id}/months` - Get monthly budget data

For complete API documentation, see [https://api.ynab.com](https://api.ynab.com)

## Security Notes

- **OAuth Tokens**: Stored in-memory only (cleared on server restart)
- **Authentication**: Each session requires browser-based authorization
- **Credentials**: OAuth client ID/secret should be kept secure
- **Localhost Only**: OAuth callback server binds to localhost only

## Troubleshooting

### Browser doesn't open automatically

If the browser doesn't open during OAuth authorization, manually open the URL shown in the terminal.

### "OAuth authorization timeout"

The authorization flow times out after 5 minutes. Restart Claude Desktop and try again.

### "Token exchange failed"

Check that your `YNAB_CLIENT_ID` and `YNAB_CLIENT_SECRET` are correct and match your registered OAuth application.

### "Missing code or state in OAuth callback"

Ensure your OAuth application's redirect URI is set to `http://localhost:3737/oauth/callback` exactly.

## License

MIT
