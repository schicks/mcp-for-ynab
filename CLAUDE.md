# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server for the YNAB (You Need A Budget) API. It's built with Bun and TypeScript, compiled into standalone executables for Linux, macOS, and Windows. The server provides OAuth 2.0 authentication and exposes YNAB API functionality through the MCP protocol.

## Development Commands

### Running the server
```bash
bun run dev
```

### Building executables
```bash
bun run build           # Current platform
bun run build:linux     # Linux x64
bun run build:macos     # macOS ARM64
bun run build:windows   # Windows x64
bun run build:all       # All platforms
```

### Installing dependencies
```bash
bun install
```

## Architecture

### Core Components

**MCP Server Layer** ([src/index.ts](src/index.ts))
- Entry point that initializes the MCP server using `@modelcontextprotocol/sdk`
- Registers one tool (`call_api`) and one resource (`ynab://openapi-schema`)
- Uses stdio transport for communication with MCP clients
- Handles graceful shutdown on SIGINT

**OAuth Flow** ([src/oauth/](src/oauth/))
- **TokenManager** ([src/oauth/token-manager.ts](src/oauth/token-manager.ts)): Manages OAuth token lifecycle, including automatic refresh with 5-minute buffer before expiry
- **OAuthClient** ([src/oauth/client.ts](src/oauth/client.ts)): Implements OAuth 2.0 authorization code flow, opens browser for user authorization
- **CallbackServer** ([src/oauth/callback-server.ts](src/oauth/callback-server.ts)): Temporary HTTP server on port 3737 to receive OAuth callbacks, with 5-minute timeout
- **Config** ([src/oauth/config.ts](src/oauth/config.ts)): OAuth configuration from environment variables `YNAB_CLIENT_ID` and `YNAB_CLIENT_SECRET`

**YNAB API Client** ([src/ynab/api-client.ts](src/ynab/api-client.ts))
- Wraps YNAB API calls with automatic OAuth token injection
- Handles both relative paths and full URLs
- Base URL: `https://api.ynab.com/v1`

**MCP Tools** ([src/tools/](src/tools/))
- **call_api** ([src/tools/call-api.ts](src/tools/call-api.ts)): Generic tool for making arbitrary YNAB API calls with any HTTP method (GET, POST, PUT, PATCH, DELETE)

**MCP Resources** ([src/resources/](src/resources/))
- **openapi-schema** ([src/resources/openapi-schema.ts](src/resources/openapi-schema.ts)): Serves the YNAB OpenAPI spec from [ynab_api_spec.json](ynab_api_spec.json)

### Key Design Patterns

1. **In-Memory Token Storage**: OAuth tokens are stored only in memory and cleared on server restart. Each session requires browser authorization on first use.

2. **Automatic Token Refresh**: Tokens are automatically refreshed 5 minutes before expiry if a refresh token is available.

3. **Stdio Transport**: The MCP server communicates over stdin/stdout, making it compatible with MCP clients like Claude Desktop.

4. **Browser-Based OAuth**: Uses platform-specific commands (`open`/`start`/`xdg-open`) to automatically open the authorization URL in the user's browser.

5. **Single Executable Distribution**: Uses Bun's `--compile` flag to create standalone binaries with no runtime dependencies.

## Configuration

Required environment variables:
- `YNAB_CLIENT_ID`: OAuth client ID from YNAB developer settings
- `YNAB_CLIENT_SECRET`: OAuth client secret from YNAB developer settings

OAuth redirect URI must be: `http://localhost:3737/oauth/callback`

## TypeScript Configuration

- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Uses `.ts` file extensions in imports (Bun-specific)
- No emit (runtime is Bun)
