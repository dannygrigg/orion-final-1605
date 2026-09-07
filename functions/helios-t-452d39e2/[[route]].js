// ─────────────────────────────────────────────────────────────────────────
// Helios tariff model — PIN gate (Cloudflare Pages Function).
//
// Intercepts every request under /helios-t-452d39e2/. Without a valid
// HttpOnly auth cookie it serves a PIN screen; the static page behind it
// is only ever returned server-side after the PIN check, so the content
// never reaches an unauthenticated browser.
//
// Shared PIN: set env var HELIOS_PIN on the Pages project to override the
// default below (changing it logs every device out).
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_PIN = '7531';
const TOKEN_SALT = 'orion-helios-tariff-v1';
const BASE = '/helios-t-452d39e2';

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const pinOf = env => (env.HELIOS_PIN || DEFAULT_PIN).trim();

const baseHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...baseHeaders, ...extra },
  });

const PIN_PAGE = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0E1318">
<title>Helios — private</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500&family=Barlow+Semi+Condensed:wght@600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--slate-900:#0E1318;--slate-800:#151B22;--line:#323C48;--ink:#E7EBEF;--ink-dim:#93A0AE;--ink-faint:#5F6C7B;--amber:#F2A93B;--rose:#D9705E}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--slate-900);color:var(--ink);font-family:'Barlow',system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column}
header{border-bottom:1px solid var(--line);padding:18px 0}
.head-in{max-width:860px;margin:0 auto;padding:0 20px;display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.mark{font-family:'Barlow Semi Condensed',sans-serif;font-weight:600;font-size:23px;letter-spacing:0.14em}
.mark span{color:var(--amber)}
.head-meta{font-size:13px;color:var(--ink-faint);font-family:'IBM Plex Mono',monospace}
main{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:16vh 20px 0}
.card{width:100%;max-width:360px;text-align:center}
h1{font-family:'Barlow Semi Condensed',sans-serif;font-weight:600;font-size:22px;margin-bottom:4px}
p{color:var(--ink-dim);font-size:14px;margin-bottom:22px}
input{width:100%;background:var(--slate-800);border:1px solid var(--line);color:var(--ink);font-family:'IBM Plex Mono',monospace;font-size:28px;letter-spacing:10px;text-align:center;padding:12px 10px;border-radius:2px}
input:focus{outline:none;border-color:var(--amber)}
button{width:100%;margin-top:14px;background:var(--amber);border:1px solid var(--amber);color:#241704;font-family:'Barlow',sans-serif;font-weight:500;font-size:15px;padding:11px 0;border-radius:2px;cursor:pointer}
button:hover{filter:brightness(1.06)}
#err{color:var(--rose);font-size:14px;margin-top:12px;min-height:20px;font-family:'IBM Plex Mono',monospace}
</style>
</head>
<body>
<header><div class="head-in">
<div class="mark">HELIOS<span>.</span></div>
<div class="head-meta">private &middot; Orion MIS</div>
</div></header>
<main><div class="card">
<h1>Enter PIN</h1>
<p>This page is private to Orion MIS.</p>
<input id="pin" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="&bull;&bull;&bull;&bull;" autofocus>
<button id="go">Unlock</button>
<div id="err"></div>
</div></main>
<script>
var pin=document.getElementById('pin'),err=document.getElementById('err');
async function login(){
  err.textContent='';
  try{
    var r=await fetch('${BASE}/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin.value})});
    if(r.ok){location.reload();return}
    var d=await r.json().catch(function(){return{}});
    err.textContent=d.error||'Wrong PIN';pin.value='';pin.focus();
  }catch(e){err.textContent='Network error — try again'}
}
document.getElementById('go').addEventListener('click',login);
pin.addEventListener('keydown',function(e){if(e.key==='Enter')login()});
</script>
</body>
</html>`;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const token = await sha256hex(pinOf(env) + TOKEN_SALT);

  // ── login ──
  if (method === 'POST' && url.pathname === `${BASE}/login`) {
    let pin = '';
    try { pin = String((await request.json()).pin || '').trim(); } catch {}
    if (pin !== pinOf(env)) return json({ error: 'Wrong PIN' }, 401);
    return json({ ok: true }, 200, {
      'Set-Cookie': `helios_auth=${token}; Path=${BASE}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    });
  }

  // ── auth check ──
  const cookies = request.headers.get('Cookie') || '';
  const authed = cookies.split(/;\s*/).includes(`helios_auth=${token}`);

  if (!authed) {
    return new Response(PIN_PAGE, {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...baseHeaders },
    });
  }

  // ── authed: serve the static page from the asset store (bypasses functions) ──
  const assetRes = await env.ASSETS.fetch(new URL(`${BASE}/index.html`, url.origin));
  const h = new Headers(assetRes.headers);
  h.set('Cache-Control', 'no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(assetRes.body, { status: assetRes.status, headers: h });
}
