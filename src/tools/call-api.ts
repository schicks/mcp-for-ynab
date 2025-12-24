import { z } from 'zod';
import type { YnabApiClient } from '../ynab/api-client.ts';

export const CallApiToolSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    .describe('HTTP method to use'),
  endpoint: z.string()
    .describe('API endpoint path (e.g., "/budgets" or "/budgets/{budget_id}/accounts"). Can be a full URL or relative path.'),
  body: z.record(z.unknown()).optional()
    .describe('Request body for POST/PUT/PATCH requests (JSON object)'),
  headers: z.record(z.string()).optional()
    .describe('Additional HTTP headers to include'),
});

export type CallApiToolInput = z.infer<typeof CallApiToolSchema>;

export async function callApiTool(
  input: CallApiToolInput,
  apiClient: YnabApiClient
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const result = await apiClient.callApi({
      method: input.method,
      endpoint: input.endpoint,
      body: input.body,
      headers: input.headers,
    });

    // Format response
    const responseText = JSON.stringify(result, null, 2);

    // Check if YNAB returned an error
    if (result.error) {
      return {
        content: [{
          type: 'text',
          text: `YNAB API Error:\n${responseText}`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: responseText,
      }],
    };
  } catch (error) {
    console.error('Tool execution error:', error);

    return {
      content: [{
        type: 'text',
        text: `Error executing API call: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}
