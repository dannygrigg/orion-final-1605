// ─────────────────────────────────────────────────────────────────────────
// POST /api/submit — same-origin proxy in front of Basin (usebasin.com).
//
// Why: the Basin endpoint used to be public in the page HTML, so bots could
// POST to it directly (bypassing the site entirely) and burn the monthly
// submission quota — which is exactly what killed the sketch form on
// 13 Sep 2026 (50 requests / 1 minute from one IP).
//
// Layers, in order:
//   1. Origin allow-list  — non-browser or off-site posts are refused
//   2. Honeypot           — the form names its trap field in _honeypot
//   3. Turnstile verify   — token checked server-side (TURNSTILE_SECRET)
//   4. Forward to Basin   — endpoint from BASIN_ENDPOINT env var, so the
//                           real form ID never appears in public HTML
// A Cloudflare rate-limiting rule on /api/submit* caps per-IP volume on
// top of all of this.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'https://orionmis.co.uk',
  'https://www.orionmis.co.uk',
  'https://helixsorter.co.uk',
  'https://www.helixsorter.co.uk',
]);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get('Origin') || '';
  const originOk =
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/[a-z0-9-]+\.orion-final-1605\.pages\.dev$/.test(origin);
  if (!originOk) return json({ success: false, message: 'Forbidden' }, 403);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ success: false, message: 'Bad request' }, 400);
  }

  // Honeypot: pretend success so bots don't learn they were caught.
  const trapName = form.get('_honeypot');
  if (trapName && String(form.get(String(trapName)) || '').trim() !== '') {
    return json({ success: true });
  }

  // Turnstile server-side verification.
  const token = form.get('cf-turnstile-response');
  if (!token) {
    return json(
      { success: false, message: 'Verification missing — please refresh the page and try again.' },
      403,
    );
  }
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Env var wins when set; fallback keeps forms alive without it
      // (private repo; this secret only validates Turnstile tokens).
      secret: env.TURNSTILE_SECRET || '0x4AAAAAAEzmsgHgMfLmgj9Yv9rmYMUApo0',
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || undefined,
    }),
  })
    .then((r) => r.json())
    .catch(() => ({ success: false }));
  if (!verify.success) {
    return json({ success: false, message: 'Verification failed — please try again.' }, 403);
  }
  form.delete('cf-turnstile-response');

  // Forward to Basin. BASIN_ENDPOINT holds the (rotatable) real form URL.
  const endpoint = env.BASIN_ENDPOINT || 'https://usebasin.com/f/d04288a27fc6';
  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  });
}
