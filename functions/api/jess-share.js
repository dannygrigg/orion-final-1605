// ─────────────────────────────────────────────────────────────────────────
// /api/jess-share — saves a snapshot of a design from the private fence-screen
// designer (/jess-f-f6e9bf06/) so a WhatsApp link reopens exactly that screen.
//
//   POST {state, img?}  -> {id}      state = the page's settings object,
//                                     img = her uploaded picture (data URL)
//   GET  ?id=<id>       -> {state, img, created}
//
// Stored in the site's D1 database (SNAG_DB binding) in its own table,
// jess_designs. Same-site posts only; state capped at 20 KB, picture at 900 KB.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set(['https://orionmis.co.uk', 'https://www.orionmis.co.uk']);
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function table(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS jess_designs (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, state TEXT NOT NULL, img TEXT)`).run();
}

function newId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  if (!(ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.orion-final-1605\.pages\.dev$/.test(origin)))
    return json({ error: 'Forbidden' }, 403);
  if (!env.SNAG_DB) return json({ error: 'Saving is not set up.' }, 503);
  const raw = await request.text();
  if (raw.length > 1_000_000) return json({ error: 'Design too large to share.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const state = JSON.stringify(body.state || {});
  if (state.length > 20000) return json({ error: 'Bad request' }, 400);
  const img = typeof body.img === 'string' && /^data:image\/(jpeg|png);base64,/.test(body.img) && body.img.length < 900000 ? body.img : null;
  await table(env.SNAG_DB);
  const id = newId();
  await env.SNAG_DB.prepare('INSERT INTO jess_designs (id, created_at, state, img) VALUES (?,?,?,?)')
    .bind(id, new Date().toISOString(), state, img).run();
  return json({ id });
}

export async function onRequestGet({ request, env }) {
  if (!env.SNAG_DB) return json({ error: 'Saving is not set up.' }, 503);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-z0-9]{8}$/.test(id)) return json({ error: 'Not found' }, 404);
  await table(env.SNAG_DB);
  const row = await env.SNAG_DB.prepare('SELECT state, img, created_at FROM jess_designs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Not found' }, 404);
  return json({ state: JSON.parse(row.state), img: row.img, created: row.created_at });
}
