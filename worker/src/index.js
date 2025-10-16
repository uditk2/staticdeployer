export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = request.headers.get('host');
    if (!host) return new Response('Bad Request', { status: 400 });

    // Get redirect domain from environment variable or default
    const redirectDomain = env.REDIRECT_DOMAIN;

    // Redirect www subdomain to apex domain (preserve path and query)
    if (host.toLowerCase() === `www.${redirectDomain}`) {
      const location = `https://${redirectDomain}${url.pathname}${url.search}`;
      return Response.redirect(location, 301);
    }

    // Lookup mapping from KV
    const mapping = await env.HOSTMAP.get(`host:${host}`, { type: 'json' });
    if (!mapping) return new Response('Not Found', { status: 404 });

    const { tenant, version, root = 'index.html' } = mapping;

    // Resolve path -> object key
    let path = url.pathname;
    if (path.endsWith('/')) path = path + root;
    if (path === '/') path = '/' + root;
    const key = `sites/${tenant}/${version}${path}`;

    let obj = await env.SITES_BUCKET.get(key);
    if (!obj) {
      // Try directory index.html fallback: /foo -> /foo/index.html
      if (!path.endsWith('/' + root)) {
        const altKey = `sites/${tenant}/${version}${path.replace(/\/$/, '')}/${root}`;
        const alt = await env.SITES_BUCKET.get(altKey);
        if (alt) return respondWithObject(alt, `${path.replace(/\/$/, '')}/${root}`);
      }
      // Try site-level 404.html
      const notFoundKey = `sites/${tenant}/${version}/404.html`;
      const nf = await env.SITES_BUCKET.get(notFoundKey);
      if (nf) return respondWithObject(nf, '404.html', 404);
      return new Response('Not Found', { status: 404 });
    }

    return respondWithObject(obj, path || root);
  },
};

function contentType(filename) {
  // tiny mapping
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    txt: 'text/plain; charset=utf-8',
    woff: 'font/woff',
    woff2: 'font/woff2',
  };
  return map[ext] || 'application/octet-stream';
}

function respondWithObject(obj, reqPath, status = 200) {
  const ct = contentType(reqPath);
  const isHtml = ct.startsWith('text/html');
  const headers = new Headers();
  headers.set('Content-Type', ct);
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', isHtml ? 'public, max-age=60, s-maxage=60' : 'public, max-age=31536000, immutable');
  return new Response(obj.body, { status, headers });
}
