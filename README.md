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
- YNAB OAuth application credentials (for building with embedded credentials)

### For Usage
- An MCP client (e.g., Claude Desktop)
- No additional setup required if using pre-built executables (OAuth credentials are embedded)

## Installation

### Option 1: Download Pre-Built Executables (Recommended)

Download the latest release for your platform from the [Releases page](https://github.com/YOUR_USERNAME/mcp-for-ynab/releases):

- **Linux**: `mcp-ynab-linux`
- **macOS**: `mcp-ynab-macos`
- **Windows**: `mcp-ynab.exe`

These executables have OAuth credentials embedded and require no additional configuration.

### Option 2: Build from Source

If you want to build your own executable with custom OAuth credentials:

#### 1. Register a YNAB OAuth Application

1. Log in to [YNAB](https://app.ynab.com/)
2. Go to Account Settings > Developer Settings
3. Click "New Application" or "Register New Application"
4. Fill in the details:
   - **Application Name**: Choose any name (e.g., "MCP Server")
   - **Redirect URI**: `http://localhost:3737/oauth/callback`
   - **Privacy Policy URL**: Link to [PRIVACY.md](PRIVACY.md) (required by YNAB)
5. Save the application and note your **Client ID** and **Client Secret**

#### 2. Configure Environment Variables

Set your YNAB OAuth credentials as environment variables:

```bash
export YNAB_CLIENT_ID="your_client_id_here"
export YNAB_CLIENT_SECRET="your_client_secret_here"
```

#### 3. Build the Executable

```bash
bun install
bun run build
```

The built executable will be in the `dist/` directory with credentials embedded.

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

**Production Mode** (using pre-built executable):
```json
{
  "mcpServers": {
    "ynab": {
      "command": "/absolute/path/to/mcp-ynab-linux"
    }
  }
}
```

**Note**: Pre-built executables have OAuth credentials embedded. If you built your own executable with custom credentials, you can override them by adding the `env` section:
```json
{
  "mcpServers": {
    "ynab": {
      "command": "/absolute/path/to/mcp-ynab-linux",
      "env": {
        "YNAB_CLIENT_ID": "your_custom_client_id",
        "YNAB_CLIENT_SECRET": "your_custom_client_secret"
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

## Security & Privacy

### OAuth Credentials in Executables

**Pre-built executables contain embedded OAuth client credentials.** This is standard practice for CLI tools (similar to GitHub CLI, AWS CLI, etc.) and has the following security characteristics:

- **Client Secret Extraction Risk**: Anyone who downloads the executable can potentially extract the embedded OAuth client secret through reverse engineering
- **Limited Impact**: Even with the client secret, an attacker still cannot access your YNAB data without:
  1. Physically accessing your computer to intercept the OAuth callback
  2. You authorizing their application in your browser
- **No PKCE**: YNAB's OAuth implementation does not currently support PKCE (Proof Key for Code Exchange), which would provide additional security for public clients
- **Mitigation**: The OAuth flow uses:
  - State parameter for CSRF protection
  - Localhost-only callback server (not accessible remotely)
  - Browser-based user authorization required for each session

### Data Privacy

- **No Remote Storage**: All OAuth tokens are stored in-memory only and never written to disk
- **No Telemetry**: This application does not collect any usage data or analytics
- **Local-Only**: Your YNAB data is only transmitted between your computer and YNAB's servers
- **Open Source**: All code is available for audit in this repository

For complete privacy details, see [PRIVACY.md](PRIVACY.md).

### Building Your Own

If you prefer not to use the pre-built executables with shared OAuth credentials, you can:
1. Register your own YNAB OAuth application
2. Build the executable yourself with your own credentials (see "Build from Source" above)
3. Your credentials will be embedded only in your build

### Token Management

- **OAuth Tokens**: Stored in-memory only (cleared on server restart)
- **Authentication**: Each session requires browser-based authorization on first API call
- **Auto-Refresh**: Tokens automatically refresh before expiry
- **Localhost Only**: OAuth callback server binds to `localhost:3737` only (not accessible from network)

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
