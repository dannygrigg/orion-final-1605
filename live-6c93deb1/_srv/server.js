// ─────────────────────────────────────────────────────────────────────────
// Orion Live — server code (imported by the two Pages Functions:
//   functions/live-6c93deb1/[[route]].js   staff app + staff API
//   functions/track-180021fb/[[route]].js  customer pages + customer API)
// This file is never served to browsers (the staff function returns 404 for /_srv/).
//
// THIS REPO IS PUBLIC. No PINs, keys or customer data in code.
// Settings on the Pages project (Settings → Variables and secrets, as Secrets):
//   LIVE_PIN        staff PIN, 6+ digits (required — staff login is off without it)
//   RESEND_API_KEY  optional; without it customer emails wait in the outbox
//   LIVE_MAIL_FROM  optional, e.g. "Orion MIS Projects <projects@orionmis.co.uk>"
// Database: reuses the snag app's D1 binding SNAG_DB, tables prefixed ol_.
// ─────────────────────────────────────────────────────────────────────────
import { derive, rules, EVENT_TYPES, MILESTONES, ROLES, ownerNow, parseOwners } from '../js/spine.js';

export const STAFF_BASE = '/live-6c93deb1';
export const TRACK_BASE = '/track-180021fb';
const SALT = 'orion-live-v1';
const MAX_FAILS = 8, FAIL_WINDOW_MIN = 15;

export async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const baseHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...baseHeaders, ...extra } });
export const bad = (msg, status = 400) => json({ error: msg }, status);
export const withHeaders = (res) => { const r = new Response(res.body, res); Object.entries(baseHeaders).forEach(([k, v]) => r.headers.set(k, v)); return r; };

export const londonDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const nowIso = () => new Date().toISOString();

export function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export const setCookie = (name, value, path, days = 30) =>
  `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
function randomHex(bytes = 12) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── schema (created on first use, like the snag app) ──
export async function ensureSchema(db) {
  if (globalThis.__olSchema) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ol_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, name TEXT NOT NULL, customer TEXT NOT NULL,
      site TEXT, lead TEXT, lead_email TEXT, contact_name TEXT, contact_email TEXT, cc_emails TEXT,
      token TEXT NOT NULL UNIQUE, pin_hash TEXT, auto_send INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, created_by TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ol_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}', by TEXT, source TEXT NOT NULL DEFAULT 'staff', created_at TEXT NOT NULL)`),
    db.prepare('CREATE INDEX IF NOT EXISTS ol_events_project ON ol_events(project_id, date, id)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS ol_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, event_id INTEGER, channel TEXT NOT NULL,
      to_addr TEXT, subject TEXT NOT NULL, body TEXT NOT NULL, why TEXT, status TEXT NOT NULL,
      created_at TEXT NOT NULL, sent_at TEXT, sent_by TEXT, error TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ol_fails (ip TEXT NOT NULL, scope TEXT NOT NULL, at TEXT NOT NULL)`),
  ]);
  try { await db.prepare('ALTER TABLE ol_projects ADD COLUMN owners TEXT').run(); } catch (_) { /* already there */ }
  globalThis.__olSchema = true;
}

// ── PIN attempts: lock an IP out after MAX_FAILS wrong PINs in FAIL_WINDOW_MIN ──
const ipOf = request => request.headers.get('CF-Connecting-IP') || 'local';
const windowStart = () => new Date(Date.now() - FAIL_WINDOW_MIN * 60000).toISOString();
export async function lockedOut(db, request, scope) {
  const r = await db.prepare('SELECT COUNT(*) n FROM ol_fails WHERE ip = ? AND scope = ? AND at > ?').bind(ipOf(request), scope, windowStart()).first();
  return r.n >= MAX_FAILS;
}
export async function recordFail(db, request, scope) {
  await db.batch([
    db.prepare('INSERT INTO ol_fails (ip, scope, at) VALUES (?,?,?)').bind(ipOf(request), scope, nowIso()),
    db.prepare('DELETE FROM ol_fails WHERE at < ?').bind(new Date(Date.now() - 86400000).toISOString()),
  ]);
}

// ── staff auth ──
export const staffToken = env => sha256hex((env.LIVE_PIN || '').trim() + SALT + 'staff');
export async function staffUser(request, env) {
  const access = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (access) return access;
  if (!env.LIVE_PIN) return null;
  if (cookie(request, 'ol_staff') === await staffToken(env)) return (request.headers.get('X-Orion-User') || 'staff').slice(0, 60);
  return null;
}
export const pinHash = (pin, token) => sha256hex(String(pin).trim() + token + SALT);
export const customerToken = p => sha256hex(p.pin_hash + p.token + SALT);
export const customerCookie = token => 'ol_c_' + token.slice(0, 12);

// ── data ──
const parseEvent = row => ({ ...row, data: JSON.parse(row.data || '{}') });
export const loadProject = (db, id) => db.prepare('SELECT * FROM ol_projects WHERE id = ?').bind(id).first();
export async function loadEvents(db, projectId) {
  const { results } = await db.prepare('SELECT * FROM ol_events WHERE project_id = ? ORDER BY date, id').bind(projectId).all();
  return results.map(parseEvent);
}

function validateEvent(type, date, data, record, events) {
  const T = EVENT_TYPES[type];
  if (!T) return `Unknown event type: ${type}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Date must be YYYY-MM-DD';
  for (const [k, label, kind, req] of T.fields) {
    const v = data[k];
    const empty = v == null || v === '' || v === false;
    if (req && empty) return `${label} is required`;
    if (empty) continue;
    if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${label}: use a date`;
    if ((kind === 'money' || kind === 'number') && !isFinite(+v)) return `${label}: must be a number`;
    if (kind === 'milestone' && !MILESTONES.some(([m]) => m === v)) return `${label}: unknown milestone`;
    if (kind === 'waiting' && !record.waiting.some(w => w.id === v)) return `${label}: no such open item`;
    if (kind === 'snag' && !record.snags.some(s => s.id === v && !s.closed)) return `${label}: no such open snag`;
    if (kind === 'event' && !events.some(e => e.id === +v)) return `${label}: no such event`;
  }
  if (type === 'milestone_planned' && record.planned[data.milestone] && record.planned[data.milestone] !== data.date && !data.reason)
    return 'Give a reason when moving a date that is already planned (the customer is told)';
  return null;
}

// Log one event, run the rules, queue the outputs.
export async function logEvent(env, origin, project, { type, date, data, by, source = 'staff' }) {
  const db = env.SNAG_DB;
  const events = await loadEvents(db, project.id);
  const before = derive(events);
  const err = validateEvent(type, date, data, before, events);
  if (err) return { error: err };
  const clean = {};
  for (const [k, , kind] of EVENT_TYPES[type].fields) {
    if (data[k] == null || data[k] === '') continue;
    clean[k] = kind === 'check' ? !!data[k] : (kind === 'money' || kind === 'number') ? +data[k] : String(data[k]).trim();
  }
  const event = parseEvent(await db.prepare('INSERT INTO ol_events (project_id, type, date, data, by, source, created_at) VALUES (?,?,?,?,?,?,?) RETURNING *')
    .bind(project.id, type, date, JSON.stringify(clean), by || null, source, nowIso()).first());
  const after = derive([...events, event]);
  const outputs = rules(project, event, before, after);
  for (const o of outputs) {
    const to = o.channel === 'email' ? project.contact_email : project.lead_email;
    const row = await db.prepare('INSERT INTO ol_outbox (project_id, event_id, channel, to_addr, subject, body, why, status, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *')
      .bind(project.id, event.id, o.channel, to || null, o.subject, o.body, o.why, o.channel === 'email' ? 'held' : 'open', nowIso()).first();
    if (o.channel === 'email' && project.auto_send && env.RESEND_API_KEY && to) await sendOutbox(env, origin, row, project, 'auto');
  }
  return { event, outputs };
}

export async function sendOutbox(env, origin, row, project, by) {
  const db = env.SNAG_DB;
  if (!env.RESEND_API_KEY) return { error: 'Email sending is not set up yet (RESEND_API_KEY missing)' };
  if (!row.to_addr) return { error: 'No customer email address on this project' };
  const link = project.pin_hash ? `\n\nYour project page: ${origin}${TRACK_BASE}/${project.token}` : '';
  const cc = (project.cc_emails || '').split(',').map(s => s.trim()).filter(Boolean);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.LIVE_MAIL_FROM || 'Orion MIS Projects <onboarding@resend.dev>',
      to: [row.to_addr], cc: cc.length ? cc : undefined, reply_to: project.lead_email || undefined,
      subject: row.subject, text: row.body + link,
    }),
  });
  if (!r.ok) {
    const msg = (await r.text()).slice(0, 300);
    await db.prepare("UPDATE ol_outbox SET status='failed', error=? WHERE id=?").bind(msg, row.id).run();
    return { error: 'Resend refused it: ' + msg };
  }
  await db.prepare("UPDATE ol_outbox SET status='sent', sent_at=?, sent_by=?, error=NULL WHERE id=?").bind(nowIso(), by || null, row.id).run();
  return { ok: true };
}

export function customerView(p, r) {
  return {
    ref: p.ref, name: p.name, customer: p.customer, site: p.site, lead: p.lead,
    contact: ownerNow(p, r.stage).name || p.lead,
    stage: r.stage, next: r.next,
    milestones: MILESTONES.map(([k, n]) => ({ k, n, planned: r.planned[k] || null, actual: r.actual[k] || null })),
    moves: r.moves, waiting: r.waiting.map(({ id, text, due }) => ({ id, text, due })),
    docs: r.docs, signoffs: r.signoffs, snags: r.snags, faults: r.faults,
    percent: r.percent, warranty: r.warranty, timeline: r.timeline.slice().reverse(),
  };
}

// ── staff API ──
const EDITABLE = ['name', 'customer', 'site', 'lead', 'lead_email', 'contact_name', 'contact_email', 'cc_emails'];
export async function staffApi(request, env, user, parts, origin) {
  const db = env.SNAG_DB, method = request.method.toUpperCase();
  const body = method === 'GET' ? {} : await request.json().catch(() => ({}));
  const [a, id, sub] = parts;

  if (a === 'projects' && !id && method === 'GET') {
    const [{ results: projects }, { results: events }, { results: held }] = await Promise.all([
      db.prepare('SELECT * FROM ol_projects ORDER BY ref').all(),
      db.prepare('SELECT * FROM ol_events ORDER BY date, id').all(),
      db.prepare("SELECT project_id, channel, COUNT(*) n FROM ol_outbox WHERE status IN ('held','open','failed') GROUP BY project_id, channel").all(),
    ]);
    const today = londonDay(), by = {};
    events.forEach(e => (by[e.project_id] ||= []).push(parseEvent(e)));
    return json({
      today, projects: projects.map(p => {
        const r = derive(by[p.id] || []);
        const n = ch => held.filter(h => h.project_id === p.id && h.channel === ch).reduce((x, h) => x + h.n, 0);
        return { id: p.id, ref: p.ref, name: p.name, customer: p.customer, lead: p.lead, stage: r.stage, next: r.next, value: r.value,
          owner: ownerNow(p, r.stage), owners: parseOwners(p),
          waiting: r.waiting.length, overdue: r.waiting.filter(w => w.due && w.due < today).length,
          last: r.log.length ? r.log[r.log.length - 1].date : null, page: !!p.pin_hash, held: n('email'), alerts: n('alert') };
      }),
    });
  }
  if (a === 'projects' && !id && method === 'POST') {
    for (const k of ['ref', 'name', 'customer']) if (!String(body[k] || '').trim()) return bad(`${k} is required`);
    if (await db.prepare('SELECT id FROM ol_projects WHERE ref = ?').bind(body.ref.trim()).first()) return bad(`Project ${body.ref} already exists`);
    const row = await db.prepare(`INSERT INTO ol_projects (ref, name, customer, site, lead, lead_email, contact_name, contact_email, cc_emails, token, created_at, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`).bind(body.ref.trim(), body.name.trim(), body.customer.trim(), body.site || null, body.lead || null,
      body.lead_email || null, body.contact_name || null, body.contact_email || null, body.cc_emails || null, randomHex(), nowIso(), user).first();
    return json({ id: row.id });
  }
  if (a === 'projects' && id) {
    const p = await loadProject(db, id);
    if (!p) return bad('No such project', 404);
    if (sub === 'customer' && method === 'GET') return json(customerView(p, derive(await loadEvents(db, p.id))));
    // Queue an email to the customer with the address of their page (held for approval like any other).
    if (sub === 'share' && method === 'POST') {
      if (!p.pin_hash) return bad('Switch the customer page on (set a PIN) first');
      if (!p.contact_email) return bad('Add the customer contact email in Details first');
      const first = (p.contact_name || '').split(' ')[0] || 'Hello';
      const row = await db.prepare('INSERT INTO ol_outbox (project_id, event_id, channel, to_addr, subject, body, why, status, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id')
        .bind(p.id, null, 'email', p.contact_email, `[${p.ref}] Your project page`,
          `${first},

You can follow ${p.name} on your own project page:
${origin}${TRACK_BASE}/${p.token}

It shows the stage your job is at, the dates we are working to, anything we need from you, and every document we issue. We will send the PIN separately.

${p.lead || 'Orion MIS'}
Orion MIS · ${p.ref}`,
          'Customer page shared', 'held', nowIso()).first();
      return json({ id: row.id });
    }
    if (sub === 'events' && method === 'POST') {
      const r = await logEvent(env, origin, p, { type: body.type, date: body.date, data: body.data || {}, by: user, source: body.source === 'import' ? 'import' : 'staff' });
      return r.error ? bad(r.error) : json({ event: r.event, outputs: r.outputs.length });
    }
    if (!sub && method === 'GET') {
      const events = await loadEvents(db, p.id);
      const { results: outbox } = await db.prepare('SELECT * FROM ol_outbox WHERE project_id = ? ORDER BY id DESC').bind(p.id).all();
      const { pin_hash, ...project } = p;
      return json({ project: { ...project, page: !!pin_hash, track: `${TRACK_BASE}/${p.token}` }, events, record: derive(events), outbox, mail: !!env.RESEND_API_KEY });
    }
    if (!sub && method === 'PATCH') {
      const sets = [], vals = [];
      for (const k of EDITABLE) if (k in body) { sets.push(`${k} = ?`); vals.push(String(body[k] ?? '').trim() || null); }
      if ('owners' in body) {
        const o = {};
        for (const [k] of ROLES) { const v = String(body.owners?.[k] ?? '').trim(); if (v) o[k] = v.slice(0, 60); }
        sets.push('owners = ?'); vals.push(JSON.stringify(o));
      }
      if ('auto_send' in body) { sets.push('auto_send = ?'); vals.push(body.auto_send ? 1 : 0); }
      if ('pin' in body) {
        if (body.pin === null || body.pin === '') sets.push('pin_hash = NULL');
        else { if (!/^\d{4,8}$/.test(String(body.pin))) return bad('PIN must be 4 to 8 digits'); sets.push('pin_hash = ?'); vals.push(await pinHash(body.pin, p.token)); }
      }
      if (!sets.length) return bad('Nothing to change');
      await db.prepare(`UPDATE ol_projects SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, p.id).run();
      return json({ ok: true });
    }
  }
  // Import a job's history from a file kept off the public repo.
  // { project: {ref, name, customer, ...}, events: [{type, date, data}] } — rules do not run, no emails.
  if (a === 'import' && method === 'POST') {
    const pj = body.project || {}, list = Array.isArray(body.events) ? body.events : [];
    for (const k of ['ref', 'name', 'customer']) if (!String(pj[k] || '').trim()) return bad(`project.${k} is required`);
    let p = await db.prepare('SELECT * FROM ol_projects WHERE ref = ?').bind(pj.ref.trim()).first();
    if (p) {
      const prior = await db.prepare("SELECT COUNT(*) n FROM ol_events WHERE project_id = ? AND source = 'import'").bind(p.id).first();
      if (prior.n) return bad(`${p.ref} has already been imported (${prior.n} events). Log new events on the project page instead.`);
    } else {
      const row = await db.prepare(`INSERT INTO ol_projects (ref, name, customer, site, lead, lead_email, contact_name, contact_email, cc_emails, token, created_at, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`).bind(pj.ref.trim(), pj.name.trim(), pj.customer.trim(), pj.site || null, pj.lead || null,
        pj.lead_email || null, pj.contact_name || null, pj.contact_email || null, pj.cc_emails || null, randomHex(), nowIso(), user).first();
      p = await loadProject(db, row.id);
    }
    const events = await loadEvents(db, p.id);
    const sorted = list.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    let added = 0;
    for (const e of sorted) {
      const err = validateEvent(e.type, e.date, e.data || {}, derive(events), events);
      if (err) return json({ error: `Event ${added + 1} (${e.type} ${e.date}): ${err}`, id: p.id, added }, 400);
      const ev = parseEvent(await db.prepare('INSERT INTO ol_events (project_id, type, date, data, by, source, created_at) VALUES (?,?,?,?,?,?,?) RETURNING *')
        .bind(p.id, e.type, e.date, JSON.stringify(e.data || {}), e.by || user, 'import', nowIso()).first());
      events.push(ev); added++;
    }
    return json({ id: p.id, ref: p.ref, added });
  }
  if (a === 'outbox' && !id && method === 'GET') {
    const { results } = await db.prepare(`SELECT o.*, p.ref FROM ol_outbox o JOIN ol_projects p ON p.id = o.project_id
      WHERE o.status IN ('held','open','failed') ORDER BY o.id DESC`).all();
    return json({ items: results, mail: !!env.RESEND_API_KEY });
  }
  if (a === 'outbox' && id && method === 'POST') {
    const row = await db.prepare('SELECT * FROM ol_outbox WHERE id = ?').bind(id).first();
    if (!row) return bad('No such item', 404);
    if (body.action === 'cancel' || body.action === 'done') {
      await db.prepare('UPDATE ol_outbox SET status = ?, sent_by = ?, sent_at = ? WHERE id = ?').bind(body.action === 'cancel' ? 'cancelled' : 'done', user, nowIso(), row.id).run();
      return json({ ok: true });
    }
    if (body.action !== 'send') return bad('Unknown action');
    if (row.channel !== 'email' || !['held', 'failed'].includes(row.status)) return bad('Only held emails can be sent');
    if (body.subject || body.body) {
      await db.prepare('UPDATE ol_outbox SET subject = ?, body = ? WHERE id = ?').bind(body.subject || row.subject, body.body || row.body, row.id).run();
      row.subject = body.subject || row.subject; row.body = body.body || row.body;
    }
    const r = await sendOutbox(env, origin, row, await loadProject(db, row.project_id), user);
    return r.error ? bad(r.error, 502) : json({ ok: true });
  }
  return bad('Not found', 404);
}

// Staff sign-in page, served by the function before anything else is sent.
export const STAFF_LOGIN_PAGE = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Orion Live</title>
<style>:root{--bg:#eef0f2;--panel:#fff;--ink:#15191e;--muted:#5b6570;--line:#d5dade;--accent:#e8a200;--warn:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#101418;--panel:#171c21;--ink:#e7ebef;--muted:#9aa5b0;--line:#2b333b;--accent:#f2b52a;--warn:#f0877f;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:0 16px}
.c{max-width:360px;margin:14vh auto 0;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:20px}
h1{font:700 24px "Arial Narrow",Arial,sans-serif;margin:0 0 14px}label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--ink);font:inherit}
button{margin-top:14px;width:100%;padding:9px;border:0;border-radius:4px;background:var(--accent);color:#3d2a00;font-weight:700;font-size:15px;cursor:pointer}
.e{color:var(--warn);font-size:14px;margin-top:10px;min-height:1em}</style></head><body>
<form class="c" id="f"><h1>Orion Live</h1><label for="n">Your name</label><input id="n" required autocomplete="name">
<label for="p">Staff PIN</label><input id="p" type="password" inputmode="numeric" required autocomplete="current-password">
<button>Sign in</button><div class="e" id="e"></div></form>
<script>try{n.value=localStorage.getItem('ol_name')||''}catch(_){}
f.onsubmit=async ev=>{ev.preventDefault();try{localStorage.setItem('ol_name',n.value.trim())}catch(_){}
const r=await fetch('${STAFF_BASE}/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:p.value})});
if(r.ok)location.reload();else e.textContent=(await r.json().catch(()=>({}))).error||'Sign-in failed'}</script></body></html>`;
