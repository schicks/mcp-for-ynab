#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { TokenManager } from './oauth/token-manager.ts';
import { YnabApiClient } from './ynab/api-client.ts';
import { CallApiToolSchema, callApiTool } from './tools/call-api.ts';
import { OPENAPI_RESOURCE_URI, getOpenApiSchema } from './resources/openapi-schema.ts';

async function main() {
  // Initialize dependencies
  const tokenManager = new TokenManager();
  const apiClient = new YnabApiClient(tokenManager);

  // Create MCP server
  const server = new Server(
    {
      name: 'mcp-ynab-server',
      version: '1.0.0',
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

  // Handle process errors
  process.on('SIGINT', async () => {
    console.error('\nShutting down gracefully...');
    await server.close();
    process.exit(0);
  });

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
        throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`Unknown resource: ${request.params.uri}`);
  });

  // Connect to transport (stdio)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('YNAB MCP Server running on stdio');
  console.error('Tools: call_api');
  console.error('Resources: ynab://openapi-schema');
  console.error('Waiting for requests...\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
