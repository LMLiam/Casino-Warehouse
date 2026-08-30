import { existsSync, readFileSync } from 'node:fs';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import helmet, { type HelmetOptions } from 'helmet';

export function createCasinoHttpHandler(distRoot: string, publicWebSocketUrl: () => string): (request: IncomingMessage, response: ServerResponse) => void {
  const successStatusCode = 200;
  const notFoundStatusCode = 404;
  const serverErrorStatusCode = 500;
  const permissionsPolicy = 'camera=(), geolocation=(), microphone=(), payment=(), usb=()';
  const securityHeaderOptions = {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'none'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        // Pixi's no-eval runtime module keeps scripts self-only. The current UI writes inline style attributes and CSS custom properties, so styles keep unsafe-inline.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", 'blob:'],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: false,
    xFrameOptions: { action: 'deny' },
  } satisfies HelmetOptions;
  const securityHeaders = helmet(securityHeaderOptions);

  return (request, response) => {
    applySecurityHeaders(request, response, () => {
      if (request.url === '/health') {
        response.writeHead(successStatusCode, responseHeaders({ 'content-type': 'application/json' }));
        response.end(JSON.stringify({ ok: true, multiplayer: true }));
        return;
      }

      const filePath = staticPath(request);
      if (!filePath || !existsSync(filePath)) {
        if (!shouldServeAppFallback(request, filePath)) {
          response.writeHead(notFoundStatusCode, responseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' }));
          response.end('Not found');
          return;
        }

        serveIndex(response);
        return;
      }

      if (isIndexHtml(filePath)) {
        serveIndex(response);
        return;
      }

      response.writeHead(successStatusCode, cacheHeaders(filePath));
      response.end(readFileSync(filePath));
    });
  };

  function serveIndex(response: ServerResponse): void {
    response.writeHead(successStatusCode, responseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' }));
    response.end(injectRuntimeConfig(readFileSync(join(distRoot, 'index.html'), 'utf8')));
  }

  function injectRuntimeConfig(html: string): string {
    const currentPublicWebSocketUrl = publicWebSocketUrl();
    if (!currentPublicWebSocketUrl) {
      return html;
    }
    const meta = `<meta name="casino-realtime-url" content="${escapeAttribute(currentPublicWebSocketUrl)}" />`;
    return html.includes('</head>') ? html.replace('</head>', `    ${meta}\n  </head>`) : `${meta}\n${html}`;
  }

  function escapeAttribute(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  function staticPath(request: IncomingMessage): string | undefined {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(distRoot, pathname);
    return filePath.startsWith(distRoot) ? filePath : undefined;
  }

  function shouldServeAppFallback(request: IncomingMessage, filePath: string | undefined): boolean {
    return Boolean(filePath) && acceptsHtml(request) && !isFileLikeOrSuspiciousRequest(request);
  }

  function isIndexHtml(filePath: string): boolean {
    return normalize(filePath) === normalize(join(distRoot, 'index.html'));
  }

  function acceptsHtml(request: IncomingMessage): boolean {
    const acceptHeader = request.headers.accept;
    if (!acceptHeader) {
      return true;
    }

    return acceptHeader.split(',').some((entry) => {
      const [mediaType, ...parameters] = entry.split(';').map((part) => part.trim().toLowerCase());
      const qValue = parameters.find((parameter) => parameter.startsWith('q='));
      if (qValue && Number(qValue.slice(2)) === 0) {
        return false;
      }

      return mediaType === 'text/html' || mediaType === 'application/xhtml+xml' || mediaType === 'text/*' || mediaType === '*/*';
    });
  }

  function isFileLikeOrSuspiciousRequest(request: IncomingMessage): boolean {
    const decodedPathname = decodedPath(rawRequestPath(request));
    if (!decodedPathname || decodedPathname.includes('\\') || decodedPathname.includes('\0') || decodedPathname.split('/').includes('..')) {
      return true;
    }

    return decodedPathname.split('/').some((segment) => extname(segment) !== '');
  }

  function rawRequestPath(request: IncomingMessage): string {
    const rawUrl = request.url ?? '/';
    const pathEnd = rawUrl.search(/[?#]/);
    const path = pathEnd === -1 ? rawUrl : rawUrl.slice(0, pathEnd);
    return path || '/';
  }

  function decodedPath(pathname: string): string | undefined {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return undefined;
    }
  }

  function contentType(filePath: string): string {
    return (
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      }[extname(filePath)] ?? 'application/octet-stream'
    );
  }

  function applySecurityHeaders(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    securityHeaders(request, response, (error) => {
      if (error) {
        response.writeHead(serverErrorStatusCode, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: false, error: 'security_headers_failed' }));
        return;
      }
      next();
    });
  }

  function responseHeaders(headers: Record<string, string>): Record<string, string> {
    return { 'permissions-policy': permissionsPolicy, ...headers };
  }

  function cacheHeaders(filePath: string): Record<string, string> {
    const headers = { 'content-type': contentType(filePath) };
    if (extname(filePath) === '.html') {
      return responseHeaders({ ...headers, 'cache-control': 'no-store' });
    }
    return responseHeaders(headers);
  }
}
