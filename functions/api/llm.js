const ALLOWED_HOSTS = new Set(['ollama.com']);
const ALLOWED_HEADER_NAMES = new Set(['authorization', 'content-type']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400'
};

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
  } catch (_) {
    return false;
  }
}

function filteredHeaders(input) {
  const headers = new Headers();
  Object.entries(input || {}).forEach(([name, value]) => {
    if (!ALLOWED_HEADER_NAMES.has(String(name).toLowerCase()) || value == null) return;
    headers.set(name, String(value));
  });
  return headers;
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'x-crisismaker-proxy': '1' }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch (_) {
    return jsonError('Invalid proxy request JSON.', 400);
  }

  if (!isAllowedUrl(payload?.url)) return jsonError('Provider URL is not allowed.', 400);
  const method = String(payload?.method || 'POST').toUpperCase();
  if (!['GET', 'POST'].includes(method)) return jsonError('Provider method is not allowed.', 400);

  let providerResponse;
  try {
    providerResponse = await fetch(payload.url, {
      method,
      headers: filteredHeaders(payload.headers),
      body: method === 'GET' ? undefined : (payload.body || '')
    });
  } catch (error) {
    return jsonError(`Ollama fetch failed from Cloudflare: ${error?.message || 'network error'}`, 502);
  }

  const headers = new Headers(providerResponse.headers);
  Object.entries(CORS).forEach(([name, value]) => headers.set(name, value));
  headers.set('x-crisismaker-proxy', '1');
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('set-cookie');

  return new Response(providerResponse.body, {
    status: providerResponse.status,
    statusText: providerResponse.statusText,
    headers
  });
}
