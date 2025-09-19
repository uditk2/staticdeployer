// Minimal content-type resolver to avoid extra deps.
const map = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
]);

export function contentTypeFor(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return 'application/octet-stream';
  const ext = filename.slice(idx).toLowerCase();
  return map.get(ext) || 'application/octet-stream';
}

export function isHtml(filename: string): boolean {
  const ct = contentTypeFor(filename);
  return ct.startsWith('text/html');
}