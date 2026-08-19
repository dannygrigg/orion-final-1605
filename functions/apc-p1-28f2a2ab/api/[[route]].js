// ─────────────────────────────────────────────────────────────────────────
// APC Phase 1 snag-list API — Cloudflare Pages Function backed by D1.
//
// Requires a D1 binding named SNAG_DB on this Pages project:
//   Cloudflare dash → Workers & Pages → orion-final-1605 → Settings → Bindings
//   → Add → D1 database → variable name SNAG_DB.
//
// Shared PIN: set env var SNAG_PIN in the same Settings screen to override
// the default below (changing it logs every device out).
//
// No hard deletes anywhere — every change is a row in snag_events.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_PIN = '576689';
const TOKEN_SALT = 'orion-apc-snag-v1';

const STATUSES = ['open', 'progress', 'done'];
const PRIORITIES = ['P1', 'P2', 'P3'];

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const pinOf = env => (env.SNAG_PIN || DEFAULT_PIN).trim();
const tokenOf = env => sha256hex(pinOf(env) + TOKEN_SALT);

async function ensureSchema(db) {
  if (globalThis.__snagSchemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS snags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      area TEXT NOT NULL,
      priority TEXT NOT NULL,
      raised_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS snag_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snag_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      actor TEXT,
      at TEXT NOT NULL
    )`),
  ]);
  globalThis.__snagSchemaReady = true;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

// London calendar date (YYYY-MM-DD) for an ISO timestamp — report maths
// must follow UK site time, not UTC.
const londonDay = iso =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));

export async function onRequest(context) {
  const { request, env, params } = context;
  const route = Array.isArray(params.route) ? params.route : [];
  const path = route.join('/');
  const method = request.method.toUpperCase();

  if (!env.SNAG_DB) {
    return json({ error: 'D1 binding SNAG_DB is not configured on this Pages project (Settings → Bindings).' }, 500);
  }
  const db = env.SNAG_DB;

  // ── auth ──
  if (method === 'POST' && path === 'login') {
    const body = await request.json().catch(() => ({}));
    if (String(body.pin || '').trim() === pinOf(env)) {
      return json({ token: await tokenOf(env) });
    }
    return json({ error: 'Wrong PIN' }, 401);
  }

  if (request.headers.get('X-Auth') !== (await tokenOf(env))) {
    return json({ error: 'Not authorised' }, 401);
  }

  await ensureSchema(db);
  const now = new Date().toISOString();

  // ── list ──
  if (method === 'GET' && path === 'snags') {
    const { results: snags } = await db.prepare('SELECT * FROM snags ORDER BY id DESC').all();
    const { results: events } = await db
      .prepare('SELECT * FROM snag_events ORDER BY id ASC')
      .all();
    return json({ snags, events });
  }

  // ── create ──
  if (method === 'POST' && path === 'snags') {
    const b = await request.json().catch(() => ({}));
    const description = String(b.description || '').trim().slice(0, 1000);
    const area = String(b.area || '').trim().slice(0, 100);
    const priority = PRIORITIES.includes(b.priority) ? b.priority : 'P3';
    const raisedBy = String(b.raised_by || '').trim().slice(0, 60);
    if (!description || !area || !raisedBy) {
      return json({ error: 'Description, area and your name are all required.' }, 400);
    }
    const ins = await db
      .prepare('INSERT INTO snags (description, area, priority, raised_by, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(description, area, priority, raisedBy, 'open', now, now)
      .run();
    const id = ins.meta.last_row_id;
    await db
      .prepare('INSERT INTO snag_events (snag_id, action, detail, actor, at) VALUES (?,?,?,?,?)')
      .bind(id, 'raised', description, raisedBy, now)
      .run();
    return json({ id });
  }

  // ── status change (snags/:id/status) ──
  const m = path.match(/^snags\/(\d+)\/status$/);
  if (method === 'POST' && m) {
    const id = Number(m[1]);
    const b = await request.json().catch(() => ({}));
    const status = String(b.status || '');
    const note = String(b.note || '').trim().slice(0, 500);
    const actor = String(b.actor || '').trim().slice(0, 60);
    if (!STATUSES.includes(status)) return json({ error: 'Bad status' }, 400);
    if (!actor) return json({ error: 'Name required' }, 400);

    const snag = await db.prepare('SELECT * FROM snags WHERE id = ?').bind(id).first();
    if (!snag) return json({ error: 'Snag not found' }, 404);

    await db.batch([
      db.prepare('UPDATE snags SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id),
      db.prepare('INSERT INTO snag_events (snag_id, action, detail, actor, at) VALUES (?,?,?,?,?)')
        .bind(id, `status:${snag.status}→${status}`, note || null, actor, now),
    ]);
    return json({ ok: true });
  }

  // ── note only (snags/:id/note) ──
  const n = path.match(/^snags\/(\d+)\/note$/);
  if (method === 'POST' && n) {
    const id = Number(n[1]);
    const b = await request.json().catch(() => ({}));
    const note = String(b.note || '').trim().slice(0, 500);
    const actor = String(b.actor || '').trim().slice(0, 60);
    if (!note || !actor) return json({ error: 'Note and name required' }, 400);
    const snag = await db.prepare('SELECT id FROM snags WHERE id = ?').bind(id).first();
    if (!snag) return json({ error: 'Snag not found' }, 404);
    await db
      .prepare('INSERT INTO snag_events (snag_id, action, detail, actor, at) VALUES (?,?,?,?,?)')
      .bind(id, 'note', note, actor, new Date().toISOString())
      .run();
    return json({ ok: true });
  }

  // ── daily report (JSON for the app; ?format=wa for plain WhatsApp-ready text) ──
  if (method === 'GET' && path === 'report') {
    const { results: snags } = await db.prepare('SELECT * FROM snags ORDER BY id ASC').all();
    const { results: doneEvents } = await db
      .prepare("SELECT * FROM snag_events WHERE action LIKE 'status:%→done'")
      .all();
    const today = londonDay(now);
    const threeDaysAgo = new Date(Date.now() - 3 * 864e5).toISOString();

    const open = snags.filter(s => s.status !== 'done');
    const newToday = snags.filter(s => londonDay(s.created_at) === today);
    const closedTodayIds = new Set(doneEvents.filter(e => londonDay(e.at) === today).map(e => e.snag_id));
    const closedToday = snags.filter(s => s.status === 'done' && closedTodayIds.has(s.id));
    const stale = open.filter(s => s.created_at <= threeDaysAgo);
    const staleIds = new Set(stale.map(s => s.id));

    const byArea = {};
    for (const s of open) (byArea[s.area] = byArea[s.area] || []).push(s);

    const dateStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', weekday: 'short', day: '2-digit', month: '2-digit',
    }).format(new Date(now));
    let wa = `*APC Phase 1 — Snag Report (${dateStr})*\n`;
    wa += `Outstanding: ${open.length} (${open.filter(s => s.status === 'progress').length} in progress)\n`;
    wa += `New today: ${newToday.length} | Closed today: ${closedToday.length}\n`;
    if (stale.length) wa += `⚠ ${stale.length} open 3+ days\n`;
    for (const [area, items] of Object.entries(byArea)) {
      wa += `\n*${area}* (${items.length})\n`;
      for (const s of items) {
        wa += `• [${s.priority}] #${s.id} ${s.description}${s.status === 'progress' ? ' (in progress)' : ''}${staleIds.has(s.id) ? ' ⚠' : ''}\n`;
      }
    }
    if (closedToday.length) {
      wa += `\n*Closed today*\n`;
      for (const s of closedToday) wa += `✓ #${s.id} ${s.description}\n`;
    }
    if (!snags.length) wa += `\nNo snags raised yet.`;

    const url = new URL(request.url);
    if (url.searchParams.get('format') === 'wa') {
      return new Response(wa, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    return json({
      generated_at: now,
      today,
      outstanding: open.length,
      in_progress: open.filter(s => s.status === 'progress').length,
      new_today: newToday.length,
      closed_today: closedToday.length,
      stale_count: stale.length,
      stale_ids: [...staleIds],
      by_area: byArea,
      closed_today_items: closedToday,
      wa_text: wa,
    });
  }

  return json({ error: 'Not found' }, 404);
}
