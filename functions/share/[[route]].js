// ─────────────────────────────────────────────────────────────────────────
// Customer document share — PIN gate (Cloudflare Pages Function).
//
// Handles every request under /share/. Each document lives at
// /share/<slug>/ and is listed in functions/_lib/share-docs.js with its own
// PIN hash. Without a valid HttpOnly cookie for that slug the visitor gets a
// PIN screen; the files behind it are only ever returned server-side after
// the PIN check, so nothing reaches an unauthenticated browser.
//
//   GET  /share/<slug>/            → index.html (inline)
//   GET  /share/<slug>/<file>      → download, named per the register
//   POST /share/<slug>/login       → { pin } → sets cookie share_<slug>
//   GET  /share/<slug>/logout      → clears the cookie
//   GET|POST /share/<slug>/answers → shared fill-in fields (only if the register sets answers: true)
//
// Wrong PINs are rate-limited per IP and per document via SNAG_DB
// (same limiter as functions/_lib/pin-guard.js, inlined below). No PIN is ever stored: the register holds
// SHA-256(PIN + salt) and the cookie is a hash derived from that.
// ─────────────────────────────────────────────────────────────────────────

// Guard helpers (same logic as functions/_lib/pin-guard.js, kept inline so this
// route has no dependency on files that may not be deployed yet).
const MAX_IP_FAILS = 8, IP_WINDOW_MIN = 15, MAX_SCOPE_FAILS = 200, SCOPE_WINDOW_MIN = 60;
const LOCKED_MSG = 'Too many wrong PINs. Try again later.';
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256hex(String(a)), sha256hex(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
const ipOf = request => request.headers.get('CF-Connecting-IP') || 'local';
const since = min => new Date(Date.now() - min * 60000).toISOString();
async function ensureTable(db) {
  if (globalThis.__pinFailsReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS pin_fails (ip TEXT NOT NULL, scope TEXT NOT NULL, at TEXT NOT NULL)').run();
  globalThis.__pinFailsReady = true;
}
async function lockedOut(db, request, scope, { ipOnly = false } = {}) {
  if (!db) return false;
  await ensureTable(db);
  const ip = await db.prepare('SELECT COUNT(*) n FROM pin_fails WHERE ip = ? AND scope = ? AND at > ?').bind(ipOf(request), scope, since(IP_WINDOW_MIN)).first();
  if (ip.n >= MAX_IP_FAILS) return true;
  if (ipOnly) return false;
  const all = await db.prepare('SELECT COUNT(*) n FROM pin_fails WHERE scope = ? AND at > ?').bind(scope, since(SCOPE_WINDOW_MIN)).first();
  return all.n >= MAX_SCOPE_FAILS;
}
async function recordFail(db, request, scope) {
  if (!db) return;
  await ensureTable(db);
  await db.batch([
    db.prepare('INSERT INTO pin_fails (ip, scope, at) VALUES (?,?,?)').bind(ipOf(request), scope, new Date().toISOString()),
    db.prepare('DELETE FROM pin_fails WHERE at < ?').bind(since(24 * 60)),
  ]);
}
import { DOCS, PIN_SALT } from '../_lib/share-docs.js';

const TOKEN_SALT = 'orion-share-cookie-v1';
const COOKIE_DAYS = 30;

const baseHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

const html = (body, status = 200, extra = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...baseHeaders, ...extra } });
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...baseHeaders, ...extra } });

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// PIN screen in the Orion "British technology house" style (tokens/orion-tokens.css).
const pinPage = (slug, doc, msg = '') => `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#060A16">
<title>${esc(doc.title)} · private</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--ink:#060A16;--panel:#101C36;--line:rgba(150,180,230,.18);--white:#F4F7FC;--text:#C9D3E6;--soft:#8592AD;--acc:#3AA0FF;--warn:#F5B544}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--ink);color:var(--text);font-family:'Inter',system-ui,sans-serif;display:flex;flex-direction:column;position:relative;-webkit-font-smoothing:antialiased}
.grid{position:fixed;inset:0;pointer-events:none;opacity:.35;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:46px 46px}
header{position:relative;border-bottom:1px solid var(--line);padding:18px max(16px,4vw)}
.head{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px}
.mark{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:20px;letter-spacing:.12em;color:var(--white)}
.meta{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft)}
main{position:relative;flex:1;display:flex;align-items:flex-start;justify-content:center;padding:14vh 16px 40px}
.card{width:100%;max-width:400px}
.lbl{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);display:inline-flex;align-items:center;gap:.6em}
.lbl::before{content:"";width:4px;height:1.3em;background:var(--acc)}
h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:26px;letter-spacing:-.02em;color:var(--white);line-height:1.1;margin:10px 0 6px}
p{color:var(--soft);font-size:14px;line-height:1.55;margin-bottom:22px}
p b{color:var(--text);font-weight:500}
input{width:100%;background:var(--panel);border:1px solid var(--line);color:var(--white);font-family:'IBM Plex Mono',monospace;font-size:26px;letter-spacing:6px;text-align:center;padding:12px 10px;border-radius:8px}
input:focus{outline:none;border-color:var(--acc)}
button{width:100%;margin-top:12px;background:var(--acc);border:1px solid var(--acc);color:#041223;font-family:'Inter',sans-serif;font-weight:600;font-size:15px;padding:12px 0;border-radius:8px;cursor:pointer}
button:hover{filter:brightness(1.08)}
#err{color:var(--warn);font-size:13px;margin-top:12px;min-height:20px;font-family:'IBM Plex Mono',monospace}
.foot{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-top:28px;line-height:1.8}
</style>
</head>
<body>
<div class="grid"></div>
<header><div class="head"><div class="mark">${doc.neutral ? '' : 'ORION'}</div><div class="meta">${doc.neutral ? 'Private document' : 'Private document · Orion MIS'}</div></div></header>
<main><div class="card">
<span class="lbl">${esc(doc.ref)}</span>
<h1>${esc(doc.title)}</h1>
<p>Prepared for <b>${esc(doc.customer)}</b>. Enter the PIN ${doc.neutral ? 'you were given' : 'Orion gave you'} to open it. The PIN is sent separately from the link.</p>
<input id="pin" type="password" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="one-time-code" maxlength="32" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autofocus>
<button id="go">Open document</button>
<div id="err">${esc(msg)}</div>
<div class="foot">Commercial in confidence${doc.neutral ? '' : '<br>Orion MIS Ltd · orionmis.co.uk'}</div>
</div></main>
<script>
var pin=document.getElementById('pin'),err=document.getElementById('err');
async function login(){
  err.textContent='';
  try{
    var r=await fetch('/share/${esc(slug)}/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin.value})});
    if(r.ok){location.reload();return}
    var d=await r.json().catch(function(){return{}});
    err.textContent=d.error||'Wrong PIN';pin.value='';pin.focus();
  }catch(e){err.textContent='Network error. Try again.'}
}
document.getElementById('go').addEventListener('click',login);
pin.addEventListener('keydown',function(e){if(e.key==='Enter')login()});
</script>
</body>
</html>`;

const NOT_FOUND = `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title>
<style>body{background:#060A16;color:#C9D3E6;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}p{font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#8592AD}</style></head>
<body><p>No document at this address · Orion MIS</p></body></html>`;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const db = env.SNAG_DB;

  // /share/<slug>[/<rest>]
  const m = url.pathname.match(/^\/share\/([a-z0-9-]+)(?:\/(.*))?$/i);
  if (!m) return html(NOT_FOUND, 404);
  const slug = m[1].toLowerCase();
  const rest = m[2] || '';
  const doc = DOCS[slug];
  if (!doc) return html(NOT_FOUND, 404);
  if (doc.expires && new Date(doc.expires + 'T23:59:59Z') < new Date()) return html(NOT_FOUND, 404);

  // Canonical trailing slash for the document root, so relative links resolve.
  if (rest === '' && !url.pathname.endsWith('/')) {
    return Response.redirect(`${url.origin}/share/${slug}/${url.search}`, 302);
  }

  const cookieName = `share_${slug.replace(/-/g, '_')}`;
  const token = await sha256hex(doc.pinHash + TOKEN_SALT);
  const scope = `share:${slug}`;

  // ── login ──
  if (method === 'POST' && rest === 'login') {
    if (await lockedOut(db, request, scope)) return json({ error: LOCKED_MSG }, 429);
    let given = '';
    try { given = String((await request.json()).pin || '').trim(); } catch {}
    const givenHash = await sha256hex(given + PIN_SALT);
    if (!given || !(await safeEqual(givenHash, doc.pinHash))) {
      await recordFail(db, request, scope);
      return json({ error: 'Wrong PIN' }, 401);
    }
    return json({ ok: true }, 200, {
      'Set-Cookie': `${cookieName}=${token}; Path=/share/${slug}; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_DAYS * 86400}`,
    });
  }

  // ── logout ──
  if (rest === 'logout') {
    return new Response(null, { status: 302, headers: { Location: `/share/${slug}/`, 'Set-Cookie': `${cookieName}=; Path=/share/${slug}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`, ...baseHeaders } });
  }

  // ── auth check (a wrong cookie counts as a guess, per IP only) ──
  const sent = (request.headers.get('Cookie') || '').split(/;\s*/)
    .find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  let authed = false;
  if (sent) {
    authed = !(await lockedOut(db, request, scope + ':cookie', { ipOnly: true })) && await safeEqual(sent, token);
    if (!authed) await recordFail(db, request, scope + ':cookie');
  }
  if (!authed) return html(pinPage(slug, doc), 401);

  // ── answers: shared fill-in fields, only for packs that opt in with `answers: true` ──
  //   GET  /share/<slug>/answers  → { answers: { key: { text, at } } }
  //   POST /share/<slug>/answers  → { key, text }  (same-site cookie; text stored as plain text)
  if (rest === 'answers' && doc.answers) {
    if (!db) return json({ error: 'Storage unavailable' }, 503);
    if (!globalThis.__shareAnswersReady) {
      await db.prepare('CREATE TABLE IF NOT EXISTS share_answers (slug TEXT NOT NULL, k TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (slug, k))').run();
      globalThis.__shareAnswersReady = true;
    }
    if (method === 'GET') {
      const { results } = await db.prepare('SELECT k, text, at FROM share_answers WHERE slug = ?').bind(slug).all();
      const answers = {};
      for (const r of results || []) answers[r.k] = { text: r.text, at: r.at };
      return json({ answers });
    }
    if (method === 'POST') {
      if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json({ error: 'JSON only' }, 415);
      let body = {};
      try { body = await request.json(); } catch {}
      const k = String(body.key || ''), text = String(body.text ?? '');
      if (!/^[a-z0-9_-]{1,40}$/.test(k)) return json({ error: 'Bad key' }, 400);
      if (text.length > 8000) return json({ error: 'Too long (8,000 characters max)' }, 413);
      const at = new Date().toISOString();
      await db.prepare('INSERT INTO share_answers (slug, k, text, at) VALUES (?,?,?,?) ON CONFLICT(slug, k) DO UPDATE SET text = excluded.text, at = excluded.at')
        .bind(slug, k, text, at).run();
      return json({ ok: true, at });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── authed: serve from the asset store ──
  if (rest === '' || rest === 'index.html') {
    const res = await env.ASSETS.fetch(new URL(`/share/${slug}/index.html`, url.origin));
    if (res.status === 404) return html(NOT_FOUND, 404);
    const h = new Headers(res.headers);
    Object.entries(baseHeaders).forEach(([k, v]) => h.set(k, v));
    h.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(res.body, { status: res.status, headers: h });
  }
  const file = doc.files[rest];
  if (!file) return html(NOT_FOUND, 404);
  const res = await env.ASSETS.fetch(new URL(`/share/${slug}/${rest}`, url.origin));
  if (res.status === 404) return html(NOT_FOUND, 404);
  const h = new Headers();
  Object.entries(baseHeaders).forEach(([k, v]) => h.set(k, v));
  h.set('Content-Type', file.type || 'application/octet-stream');
  // inline: true = open in the browser (e.g. an embedded digital-twin viewer page); everything else downloads
  const disp = file.inline ? 'inline' : 'attachment';
  h.set('Content-Disposition', `${disp}; filename="${file.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return new Response(res.body, { status: 200, headers: h });
}
