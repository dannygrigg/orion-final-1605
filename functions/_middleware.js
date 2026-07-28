// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Pages middleware — domain canonicalisation & 301 redirects
// Runs on every request to the Pages project (all attached custom domains + *.pages.dev).
//
// Goal: ONE canonical domain (orionmis.co.uk). Every other domain 301-redirects to it,
// preserving the path + query string. Consolidates SEO, avoids duplicate content.
//
// SAFE TO DEPLOY BEFORE THE FRIDAY CUTOVER:
//   • helixsorter.co.uk stays in SERVE_HOSTS, so it keeps serving until orionmis.co.uk is live.
//   • Spare/brand domains only redirect once you attach them to this Pages project
//     (Cloudflare → Workers & Pages → this project → Custom domains).
//
// AFTER orionmis.co.uk is live on Friday:
//   • Delete the two helixsorter lines below to fold helixsorter.co.uk into orionmis.co.uk too.
// ─────────────────────────────────────────────────────────────────────────

const CANONICAL = 'orionmis.co.uk';

// Hosts that SERVE the site directly (no redirect).
const SERVE_HOSTS = new Set([
  'orionmis.co.uk',
  // ── remove these two after the orionmis.co.uk cutover to redirect helixsorter as well ──
  'helixsorter.co.uk',
  'www.helixsorter.co.uk',
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  // Never redirect the Cloudflare preview domain (needed for testing/deploys).
  if (host.endsWith('.pages.dev')) return context.next();

  // Serve directly for the canonical host and any allow-listed hosts.
  if (host === CANONICAL || SERVE_HOSTS.has(host)) return context.next();

  // Everything else (www.orionmis.co.uk + every spare/brand domain) → 301 to canonical.
  const dest = `https://${CANONICAL}${url.pathname}${url.search}`;
  return Response.redirect(dest, 301);
}
