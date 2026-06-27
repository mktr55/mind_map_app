/**
 * Cloudflare Pages Function – GitHub OAuth token exchange
 * Path: /api/auth/callback
 *
 * GitHub redirects here with ?code=xxx&state=xxx after user approves.
 * We exchange the code for an access_token server-side (keeping client_secret safe),
 * then redirect back to the SPA with #access_token=xxx in the hash.
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const origin = url.origin;

  // Basic validation
  if (!code) {
    return Response.redirect(`${origin}/#error=missing_code`, 302);
  }

  const clientId     = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET env vars');
    return Response.redirect(`${origin}/#error=server_misconfigured`, 302);
  }

  // Exchange code → token
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const data = await tokenRes.json();

    if (data.error || !data.access_token) {
      const msg = encodeURIComponent(data.error_description || data.error || 'unknown');
      return Response.redirect(`${origin}/#error=${msg}`, 302);
    }

    // Redirect SPA with token in URL hash (never in query string to avoid server logs)
    return Response.redirect(`${origin}/#access_token=${data.access_token}`, 302);

  } catch (err) {
    console.error('Token exchange error:', err);
    return Response.redirect(`${origin}/#error=token_exchange_failed`, 302);
  }
}
