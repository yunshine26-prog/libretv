import { sha256 } from './js/sha256.js';

const INTERNAL_REQUEST_HEADER = 'x-libretv-middleware-internal';

// Vercel Middleware to inject environment variables
export default async function middleware(request) {
  // Internal fetches must bypass the response transformation. Without this
  // guard, fetch(request) re-enters this middleware until Vercel returns 508.
  if (request.headers.get(INTERNAL_REQUEST_HEADER) === '1') {
    return;
  }

  const url = new URL(request.url);

  // Only process HTML pages
  const isHtmlPage = url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (!isHtmlPage) {
    return;
  }

  // Fetch the original response once, marking the subrequest so that the
  // middleware pass triggered by this fetch does not recurse.
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_REQUEST_HEADER, '1');
  const response = await fetch(new Request(request, { headers }));

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const originalHtml = await response.text();

  const password = process.env.PASSWORD || '';
  const passwordHash = password ? await sha256(password) : '';
  const adminpassword = process.env.ADMINPASSWORD || '';
  const adminpasswordHash = adminpassword ? await sha256(adminpassword) : '';

  const modifiedHtml = originalHtml
    .replace(
      'window.__ENV__.PASSWORD = "{{PASSWORD}}";',
      `window.__ENV__.PASSWORD = "${passwordHash}"; // SHA-256 hash`
    )
    .replace(
      'window.__ENV__.ADMINPASSWORD = "{{ADMINPASSWORD}}";',
      `window.__ENV__.ADMINPASSWORD = "${adminpasswordHash}"; // SHA-256 hash`
    );

  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export const config = {
  matcher: ['/', '/((?!api|_next/static|_vercel|favicon.ico).*)'],
};
