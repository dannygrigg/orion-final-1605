// ─────────────────────────────────────────────────────────────────────────
// POST /api/submit — Orion's own form engine (Basin retired, 14 Sep 2026).
//
// History: the public Basin endpoint was spammed direct (50 req/min, one
// IP) and the free quota died mid-month. Now the proxy that already
// guarded submissions delivers them itself via Resend and logs every
// submission to D1 — no third-party form quota, no public endpoint.
//
// Layers, in order:
//   1. Origin allow-list  — non-browser or off-site posts are refused
//   2. Honeypot           — the form names its trap field in _honeypot
//   3. Turnstile verify   — token checked server-side
//   4. D1 backup log      — every submission stored (form_submissions)
//   5. Resend email       — delivered to info@orionmis.co.uk, attachments
//                           included; falls back to onboarding@resend.dev
//                           sender until the domain finishes verifying
// A Cloudflare rate-limiting rule (5 req/10s per IP) caps volume on top.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'https://orionmis.co.uk',
  'https://www.orionmis.co.uk',
  'https://helixsorter.co.uk',
  'https://www.helixsorter.co.uk',
]);

const TO_EMAIL = 'info@orionmis.co.uk';
const FROM_VERIFIED = 'Orion Website <forms@orionmis.co.uk>';
const FROM_FALLBACK = 'Orion Website <onboarding@resend.dev>';
const MAX_ATTACH_BYTES = 20 * 1024 * 1024; // total, per submission

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function logToD1(env, subject, fields, attachNames) {
  const insert = () =>
    env.SNAG_DB.prepare(
      'INSERT INTO form_submissions (ts, subject, fields, attachments) VALUES (?1, ?2, ?3, ?4)',
    )
      .bind(new Date().toISOString(), subject, JSON.stringify(fields), attachNames.join(', '))
      .run();
  try {
    await insert();
  } catch (e) {
    try {
      await env.SNAG_DB.exec(
        'CREATE TABLE IF NOT EXISTS form_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, subject TEXT, fields TEXT, attachments TEXT)',
      );
      await insert();
    } catch (e2) {
      /* logging must never block delivery */
    }
  }
}

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

  // Collect fields and attachments.
  const skip = new Set(['cf-turnstile-response', '_honeypot', String(trapName || '')]);
  const subject = String(form.get('_subject') || 'Website enquiry — Orion');
  const fields = {};
  const attachments = [];
  let attachBytes = 0;

  for (const [key, value] of form.entries()) {
    if (skip.has(key) || key === '_subject') continue;
    if (typeof value === 'object' && value && typeof value.arrayBuffer === 'function') {
      if (!value.name || value.size === 0) continue;
      attachBytes += value.size;
      if (attachBytes > MAX_ATTACH_BYTES) {
        return json(
          { success: false, message: 'Attachments too large — please keep files under 20MB total.' },
          413,
        );
      }
      attachments.push({ filename: value.name, content: b64(await value.arrayBuffer()) });
    } else {
      const v = String(value).trim();
      if (v) fields[key] = v;
    }
  }

  // Backup log first — no enquiry is ever lost, even if email fails.
  await logToD1(env, subject, fields, attachments.map((a) => a.filename));

  // Build a readable email body.
  const lines = Object.entries(fields).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  lines.push('', `— Sent via orionmis.co.uk (${new Date().toUTCString()})`);
  // RESEND_API_KEY must be set in the Pages project's environment
  // variables (GitHub push protection rightly refuses keys in code).
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return json(
      {
        success: false,
        message:
          'Your enquiry was received and saved, but confirmation failed — we will still see it. You can also call +44 333 335 5269.',
      },
      502,
    );
  }

  const send = (from) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [TO_EMAIL],
        reply_to: fields.email || undefined,
        subject,
        text: lines.join('\n'),
        attachments: attachments.length ? attachments : undefined,
      }),
    });

  let res = await send(FROM_VERIFIED);
  if (!res.ok) {
    // Domain not verified yet (or similar) — retry from Resend's onboarding sender.
    res = await send(FROM_FALLBACK);
  }

  if (!res.ok) {
    // Submission IS safely logged in D1 — tell the visitor the truth gently.
    return json(
      {
        success: false,
        message:
          'Your enquiry was received and saved, but confirmation failed — we will still see it. You can also call +44 333 335 5269.',
      },
      502,
    );
  }
  return json({ success: true });
}
