import type { Server } from 'bun';

const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head><title>Authorization Successful</title></head>
<body style="font-family: system-ui; text-align: center; padding: 50px;">
  <h1>Authorization Successful!</h1>
  <p>You can close this window and return to your terminal.</p>
</body>
</html>
`;

const ERROR_HTML = (error: string) => `
<!DOCTYPE html>
<html>
<head><title>Authorization Failed</title></head>
<body style="font-family: system-ui; text-align: center; padding: 50px;">
  <h1>Authorization Failed</h1>
  <p>${error}</p>
  <p>Please try again or check your terminal for details.</p>
</body>
</html>
`;

export async function startCallbackServer(): Promise<{
  promise: Promise<{ code: string; state: string }>;
  url: string;
}> {
  let resolveCallback: (value: { code: string; state: string }) => void;
  let rejectCallback: (error: Error) => void;
  let server: Server | null = null;

  const promise = new Promise<{ code: string; state: string }>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;

    // 5-minute timeout
    setTimeout(() => {
      server?.stop();
      reject(new Error('OAuth authorization timeout (5 minutes)'));
    }, 5 * 60 * 1000);
  });

  server = Bun.serve({
    port: 3737,
    hostname: 'localhost',

    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          const errorMsg = errorDescription || error;
          rejectCallback(new Error(`OAuth error: ${errorMsg}`));
          return new Response(ERROR_HTML(errorMsg), {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        if (!code || !state) {
          rejectCallback(new Error('Missing code or state in OAuth callback'));
          return new Response(ERROR_HTML('Invalid callback parameters'), {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Success! Resolve the promise and stop the server
        resolveCallback({ code, state });
        setTimeout(() => server?.stop(), 1000); // Delay to allow response to send

        return new Response(SUCCESS_HTML, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  return {
    promise,
    url: `http://localhost:3737/oauth/callback`,
  };
}
