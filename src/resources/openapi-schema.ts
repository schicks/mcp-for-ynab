import schemaData from '../../ynab_api_spec.json';

export const OPENAPI_RESOURCE_URI = 'ynab://openapi-schema';

let cachedSchema: string | null = null;

export async function getOpenApiSchema(): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  try {
    // Cache the stringified schema
    if (!cachedSchema) {
      cachedSchema = JSON.stringify(schemaData, null, 2);
    }

    return {
      contents: [{
        uri: OPENAPI_RESOURCE_URI,
        mimeType: 'application/json',
        text: cachedSchema,
      }],
    };
  } catch (error) {
    console.error('Error loading OpenAPI schema:', error);
    throw new Error(`Failed to load OpenAPI schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}
