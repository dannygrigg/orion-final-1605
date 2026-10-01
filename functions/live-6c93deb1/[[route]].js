// ─────────────────────────────────────────────────────────────────────────
// Orion Live — staff app gate + staff API (Cloudflare Pages Function).
//
// Intercepts everything under /live-6c93deb1/. Without a valid sign-in it
// serves only the sign-in screen; the app files are returned server-side
// after the check. /api/* is the staff API. Code: live-6c93deb1/_srv/server.js
//
// Needs: D1 binding SNAG_DB (shared with the snag app) and secret LIVE_PIN.
// ─────────────────────────────────────────────────────────────────────────
import {
  STAFF_BASE, json, bad, withHeaders, ensureSchema, staffUser, staffToken, setCookie,
  lockedOut, recordFail, staffApi, STAFF_LOGIN_PAGE,
} from '../../live-6c93deb1/_srv/server.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = (Array.isArray(context.params.route) ? context.params.route : []).filter(Boolean);
  if (!env.SNAG_DB) return bad('D1 binding SNAG_DB is not configured on this Pages project.', 500);
  const db = env.SNAG_DB;
  await ensureSchema(db);

  if (url.pathname === STAFF_BASE) return Response.redirect(url.origin + STAFF_BASE + '/', 301);
  if (parts[0] === '_srv') return new Response('Not found', { status: 404 });

  // sign-in
  if (parts[0] === 'api' && parts[1] === 'login' && request.method === 'POST') {
    if (!env.LIVE_PIN) return bad('Staff sign-in is not set up yet (LIVE_PIN secret missing).', 503);
    if (await lockedOut(db, request, 'staff')) return bad('Too many wrong PINs. Try again in 15 minutes.', 429);
    const { pin } = await request.json().catch(() => ({}));
    if (String(pin || '').trim() !== env.LIVE_PIN.trim()) { await recordFail(db, request, 'staff'); return bad('Wrong PIN', 401); }
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie('ol_staff', await staffToken(env), STAFF_BASE, 30) });
  }

  const user = await staffUser(request, env);
  if (parts[0] === 'api') {
    if (!user) return bad('Sign in', 401);
    return staffApi(request, env, user, parts.slice(1), url.origin);
  }
  if (!user) {
    return new Response(STAFF_LOGIN_PAGE, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  return withHeaders(await env.ASSETS.fetch(request));
}
