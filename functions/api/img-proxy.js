// ─────────────────────────────────────────────────────────────────────────
// GET /api/img-proxy?u=<url> — fetches a picture from a pasted link for the
// private fence-screen designer (/jess-f-f6e9bf06/). Browsers can't read
// pixels from other sites' images, so this brings the picture same-origin.
//
//   1. Same-site only   — Sec-Fetch-Site / Referer must be this site
//   2. http(s) only     — Google Images "imgres" links unwrapped to imgurl
//   3. Images only      — a web page link falls back to its og:image;
//                         anything else, or over 10 MB, is refused
// ─────────────────────────────────────────────────────────────────────────

const MAX = 10 * 1024 * 1024;
const err = (msg, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function unwrap(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (/(^|\.)google\./.test(u.hostname)) {
    const g = u.searchParams.get('imgurl') || u.searchParams.get('url');
    if (g) return unwrap(g);
  }
  return u;
}

async function grab(u) {
  return fetch(u.href, {
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrionImageFetch/1.0)', Accept: 'image/*,text/html;q=0.8,*/*;q=0.5' },
  });
}

export async function onRequestGet({ request }) {
  const site = request.headers.get('Sec-Fetch-Site');
  const ref = request.headers.get('Referer') || '';
  const selfOrigin = new URL(request.url).origin;
  if (!(site === 'same-origin' || ref.startsWith(selfOrigin + '/'))) return err('Forbidden', 403);

  const u = unwrap(new URL(request.url).searchParams.get('u') || '');
  if (!u) return err('That link is not a web address.');

  let r;
  try { r = await grab(u); } catch (e) { return err('That site did not answer.', 502); }
  if (!r.ok) return err(`That site refused the request (${r.status}).`, 502);
  let type = (r.headers.get('Content-Type') || '').toLowerCase();

  if (type.startsWith('text/html')) {
    const html = (await r.text()).slice(0, 400000);
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if (!m) return err('That link is a web page, not a picture. Right-click the picture and choose Copy image address.');
    const next = unwrap(new URL(m[1].replace(/&amp;/g, '&'), u).href);
    if (!next) return err('Could not find the picture on that page.');
    try { r = await grab(next); } catch (e) { return err('That site did not answer.', 502); }
    if (!r.ok) return err(`That site refused the request (${r.status}).`, 502);
    type = (r.headers.get('Content-Type') || '').toLowerCase();
  }

  if (!type.startsWith('image/')) return err('That link is not a picture.');
  const len = Number(r.headers.get('Content-Length') || 0);
  if (len > MAX) return err('That picture is over 10 MB.');
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX) return err('That picture is over 10 MB.');

  return new Response(buf, {
    headers: {
      'Content-Type': type.split(';')[0],
      'Cache-Control': 'private, max-age=600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
