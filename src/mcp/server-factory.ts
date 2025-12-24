import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WorkerTokenManager } from '../oauth/worker-token-manager.js';
import { YnabApiClient } from '../ynab/api-client.js';
import { CallApiToolSchema, callApiTool } from '../tools/call-api.js';
import { OPENAPI_RESOURCE_URI, getOpenApiSchema } from '../resources/openapi-schema.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Create MCP server instance for a session
 * Each session gets its own server instance with isolated state
 */
export function createMCPServer(
  tokenManager: WorkerTokenManager,
  sessionId: string
): Server {
  const apiClient = new YnabApiClient(tokenManager, sessionId);

  const server = new Server(
    {
      name: 'mcp-ynab-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Error handler
  server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  // Register tool: call_api
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'call_api',
          description:
            'Make an arbitrary YNAB API call. Supports all HTTP methods (GET, POST, PUT, PATCH, DELETE) and any YNAB API endpoint. Authentication is handled automatically via OAuth.',
          inputSchema: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                description: 'HTTP method to use',
              },
              endpoint: {
                type: 'string',
                description:
                  'API endpoint path (e.g., "/budgets" or "/budgets/{budget_id}/accounts"). Can be a full URL or relative path.',
              },
              body: {
                type: 'object',
                description: 'Request body for POST/PUT/PATCH requests (JSON object)',
              },
              headers: {
                type: 'object',
                description: 'Additional HTTP headers to include',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['method', 'endpoint'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'call_api') {
      try {
        const input = CallApiToolSchema.parse(request.params.arguments);
        return await callApiTool(input, apiClient);
      } catch (error) {
        console.error('Tool execution error:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  // Register resource: OpenAPI schema
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: OPENAPI_RESOURCE_URI,
          name: 'YNAB OpenAPI Schema',
          description:
            'OpenAPI 3.0 specification for the YNAB API. Contains all available endpoints, request/response schemas, and data models.',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === OPENAPI_RESOURCE_URI) {
      try {
        return await getOpenApiSchema();
      } catch (error) {
        console.error('Resource error:', error);
        throw new Error(
          `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(`Unknown resource: ${request.params.uri}`);
  });

  return server;
}
