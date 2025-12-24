# Privacy Policy for MCP for YNAB

**Last Updated: December 24, 2025**

## Overview

MCP for YNAB is an open-source Model Context Protocol (MCP) server that provides local access to the YNAB (You Need A Budget) API. This privacy policy explains how your data is handled when you use this application.

## Data Collection and Storage

### What Data We Access

When you authorize this application, it receives:
- OAuth access tokens and refresh tokens from YNAB
- YNAB API responses when you make API calls through the MCP server

### How We Store Your Data

**All data is stored locally on your device only:**
- OAuth tokens are stored exclusively in memory (RAM) while the server is running
- No tokens, credentials, or YNAB data are ever written to disk
- No data is transmitted to any servers other than YNAB's official API (`api.ynab.com`)
- When you stop the server, all tokens are immediately cleared from memory

### What We Do NOT Do

We do not:
- Store your data on remote servers or in the cloud
- Share your data with any third parties
- Collect analytics, telemetry, or usage statistics
- Track your activity
- Store logs containing sensitive information
- Persist OAuth tokens between sessions

## Data Transmission

The only network communication this application performs is:
1. **OAuth Authorization**: Connects to `app.ynab.com` for user authorization
2. **Token Exchange**: Connects to `api.ynab.com` to exchange authorization codes for tokens
3. **API Requests**: Forwards your API requests to `api.ynab.com`
4. **Local Callback**: Runs a temporary HTTP server on `localhost:3737` to receive OAuth callbacks (accessible only from your local machine)

All connections use HTTPS encryption. Your data never leaves your local machine except to communicate directly with YNAB's servers.

## Token Management

- **Initial Authorization**: Requires browser-based OAuth flow on first use
- **Token Refresh**: Automatically refreshes access tokens before expiry using the refresh token
- **Token Expiry**: When you restart the server, all tokens are lost and you must re-authorize
- **Revocation**: You can revoke this application's access at any time through your YNAB account settings at https://app.ynab.com/settings/developer

## Open Source Transparency

This is an open-source project. You can:
- Review all source code at https://github.com/YOUR_USERNAME/mcp-for-ynab
- Verify that no data is transmitted to third parties
- Build the application yourself from source
- Audit the code for security and privacy practices

## Your Rights

You have the right to:
- Revoke this application's access to your YNAB account at any time
- Request information about what data is being processed (all data flows are documented in the source code)
- Stop using the application at any time by terminating the server process

## Changes to This Policy

Any changes to this privacy policy will be reflected in updates to this document in the source code repository. The "Last Updated" date at the top indicates when the policy was last modified.

## Contact

This is an open-source project. For questions, concerns, or issues:
- Open an issue on the GitHub repository
- Review the source code to verify privacy claims
- Contact the maintainers through the repository

## Compliance

This privacy policy complies with YNAB's OAuth application requirements, which mandate:
- Clear disclosure of data collection practices
- Transparency about data storage and sharing
- Information about user rights and data retention

## Technical Implementation

For technical users who want to verify our claims:
- OAuth tokens: Stored in `TokenManager` class in memory ([src/oauth/token-manager.ts](src/oauth/token-manager.ts))
- No database or persistent storage layer exists in the codebase
- Network requests: Only to `api.ynab.com` and `app.ynab.com` via `APIClient` ([src/ynab/api-client.ts](src/ynab/api-client.ts))
- Callback server: Runs on `localhost:3737` only ([src/oauth/callback-server.ts](src/oauth/callback-server.ts))
