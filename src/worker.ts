import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { KVTokenStore } from './storage/kv-token-store.js';
import { WebOAuthClient } from './oauth/web-client.js';
import { WorkerTokenManager } from './oauth/worker-token-manager.js';
import { createMCPServer } from './mcp/server-factory.js';
import { handleOAuthAuthorize, handleOAuthCallback } from './routes/oauth-routes.js';
import { getOAuthConfig } from './oauth/config.js';
import type { Env } from './worker-env.js';

// Global session-to-server mapping
// Maps session ID to { server, transport, lastAccessed }
const sessionServers = new Map<
  string,
  {
    server: Server;
    transport: WebStandardStreamableHTTPServerTransport;
    lastAccessed: number;
  }
>();

// Cleanup stale sessions (older than 1 hour of inactivity)
function cleanupStaleSessions() {
  const now = Date.now();
  const staleThreshold = 60 * 60 * 1000; // 1 hour

  for (const [sessionId, data] of sessionServers.entries()) {
    if (now - data.lastAccessed > staleThreshold) {
      data.server.close();
      sessionServers.delete(sessionId);
      console.log(`Cleaned up stale session: ${sessionId}`);
    }
  }
}

// Run cleanup periodically (Cloudflare Workers don't support setInterval in the same way,
// but we can call it on each request to clean up old sessions opportunistically)
let lastCleanup = 0;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function maybeCleanupSessions() {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupStaleSessions();
    lastCleanup = now;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, MCP-Session-Id, MCP-Protocol-Version',
      'Access-Control-Expose-Headers': 'MCP-Session-Id',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Opportunistically clean up stale sessions
    maybeCleanupSessions();

    try {
      // Route: Health check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            timestamp: Date.now(),
            version: '2.0.0',
            sessions: sessionServers.size,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: OAuth authorization initiation
      if (url.pathname === '/oauth/authorize' && request.method === 'GET') {
        const sessionId = request.headers.get('MCP-Session-Id') || crypto.randomUUID();
        const response = await handleOAuthAuthorize(request, env, sessionId);

        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      }

      // Route: OAuth callback
      if (url.pathname === '/oauth/callback' && request.method === 'GET') {
        const response = await handleOAuthCallback(request, env);

        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      }

      // Route: MCP endpoint
      if (url.pathname === '/mcp' || url.pathname === '/') {
        // Extract or generate session ID
        let sessionId = request.headers.get('MCP-Session-Id');

        if (!sessionId) {
          // Generate new session ID if not provided
          sessionId = crypto.randomUUID();
        }

        // Get or create server/transport for this session
        let serverData = sessionServers.get(sessionId);

        if (!serverData) {
          // Create new server and transport for this session
          const tokenStore = new KVTokenStore(env.MCP_FOR_YNAB, env.TOKEN_ENCRYPTION_KEY);
          await tokenStore.initialize();

          const workerUrl = url.origin;
          const config = getOAuthConfig(env, workerUrl);
          const oauthClient = new WebOAuthClient(config);
          const tokenManager = new WorkerTokenManager(tokenStore, oauthClient);

          const server = createMCPServer(tokenManager, sessionId);

          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId!,
          });

          await server.connect(transport);

          serverData = {
            server,
            transport,
            lastAccessed: Date.now(),
          };

          sessionServers.set(sessionId, serverData);
          console.log(`Created new session: ${sessionId}`);
        }

        // Update last accessed time
        serverData.lastAccessed = Date.now();

        // Handle the request
        const response = await serverData.transport.handleRequest(request);

        // Add CORS headers and session ID
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        response.headers.set('MCP-Session-Id', sessionId);

        return response;
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: `Unknown endpoint: ${url.pathname}`,
          availableEndpoints: ['/health', '/oauth/authorize', '/oauth/callback', '/mcp'],
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal Server Error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
