// ─────────────────────────────────────────────────────────────────────────
// Orion Live — customer project pages (Cloudflare Pages Function).
//
//   /track-180021fb/<project code>        the page (PIN once per device)
//   /track-180021fb/a/<file>              its script, styles, shared engine
//   /track-180021fb/api/<project code>    GET view / POST { pin }
//
// The page files live in the staff folder and are fetched server-side, so
// customers never see or need the staff address. Code: live-6c93deb1/_srv/server.js
// ─────────────────────────────────────────────────────────────────────────
import {
  STAFF_BASE, TRACK_BASE, json, bad, withHeaders, ensureSchema, cookie, setCookie,
  pinHash, customerToken, customerCookie, lockedOut, recordFail, loadEvents, customerView,
} from '../../live-6c93deb1/_srv/server.js';
import { derive } from '../../live-6c93deb1/js/spine.js';

const FILES = { 'cust.js': 'cust.js', 'app.css': 'app.css', 'spine.js': 'js/spine.js', 'system.js': 'js/system.js' };
const isToken = t => /^[0-9a-f]{24}$/.test(t || '');

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = (Array.isArray(context.params.route) ? context.params.route : []).filter(Boolean);
  const asset = path => env.ASSETS.fetch(new Request(url.origin + STAFF_BASE + '/' + path, request));

  if (parts[0] === 'a' && FILES[parts[1]]) return withHeaders(await asset(FILES[parts[1]]));
  if (!env.SNAG_DB) return bad('Not available', 503);
  const db = env.SNAG_DB;
  await ensureSchema(db);

  if (parts[0] === 'api' && isToken(parts[1])) {
    const p = await db.prepare('SELECT * FROM ol_projects WHERE token = ?').bind(parts[1]).first();
    if (!p || !p.pin_hash) return bad('This project page is not available', 404);
    if (request.method === 'POST') {
      if (await lockedOut(db, request, 'c:' + p.id)) return bad('Too many wrong PINs. Try again in 15 minutes.', 429);
      const { pin } = await request.json().catch(() => ({}));
      if (await pinHash(pin || '', p.token) !== p.pin_hash) { await recordFail(db, request, 'c:' + p.id); return bad('That PIN is not right', 401); }
      return json({ ok: true }, 200, { 'Set-Cookie': setCookie(customerCookie(p.token), await customerToken(p), TRACK_BASE, 60) });
    }
    if (cookie(request, customerCookie(p.token)) !== await customerToken(p)) return bad('PIN needed', 401);
    return json(customerView(p, derive(await loadEvents(db, p.id))));
  }
  if (parts.length === 1 && isToken(parts[0])) return withHeaders(await asset('cust'));
  return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
}
