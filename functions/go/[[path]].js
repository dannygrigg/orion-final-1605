// ─────────────────────────────────────────────────────────────────────────
// /go/<slug> — counted campaign short links.
// Logs every hit to D1 (campaign_clicks table in the existing SNAG_DB
// binding — marketing table, kept separate from snag tables by name),
// then 302s to the destination. Runs before _redirects, whose /go/ rules
// remain as a safety net if this function ever errors.
// /go/stats?k=<key> returns per-slug counts as JSON.
// ─────────────────────────────────────────────────────────────────────────

const DEST = {
  'li-why': '/explainer-why-orion.html',
  'li-roi': '/warehouse-automation-roi.html',
  'li-cost': '/warehouse-automation-cost-uk',
  'li-install': '/warehouse-automation-installation-time',
  'li-call': 'https://calendly.com/danny-grigg-orionmis/30min',
};

const STATS_KEY = 'orion-clicks-9f3a71'; // low-sensitivity: exposes counts only

async function log(env, slug, request) {
  const row = [
    slug,
    new Date().toISOString(),
    (request.cf && request.cf.country) || '',
    (request.headers.get('User-Agent') || '').slice(0, 160),
    (request.headers.get('Referer') || '').slice(0, 160),
  ];
  const insert = () =>
    env.SNAG_DB.prepare(
      'INSERT INTO campaign_clicks (slug, ts, country, ua, referer) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(...row)
      .run();
  try {
    await insert();
  } catch (e) {
    // First hit: create the table, then retry once.
    try {
      await env.SNAG_DB.exec(
        'CREATE TABLE IF NOT EXISTS campaign_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, ts TEXT, country TEXT, ua TEXT, referer TEXT)',
      );
      await insert();
    } catch (e2) {
      /* never block the redirect on logging */
    }
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = Array.isArray(params.path) ? params.path.join('/') : params.path || '';

  if (slug === 'stats') {
    const url = new URL(request.url);
    if (url.searchParams.get('k') !== STATS_KEY) {
      return new Response('Not found', { status: 404 });
    }
    try {
      const totals = await env.SNAG_DB.prepare(
        'SELECT slug, COUNT(*) AS clicks, MIN(ts) AS first, MAX(ts) AS last FROM campaign_clicks GROUP BY slug ORDER BY clicks DESC',
      ).all();
      const recent = await env.SNAG_DB.prepare(
        'SELECT slug, ts, country, referer FROM campaign_clicks ORDER BY id DESC LIMIT 50',
      ).all();
      return new Response(JSON.stringify({ totals: totals.results, recent: recent.results }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ totals: [], recent: [], note: 'no clicks logged yet' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const dest = DEST[slug];
  if (!dest) return Response.redirect(new URL('/', request.url).toString(), 302);
  context.waitUntil(log(env, slug, request));
  const target = dest.startsWith('http') ? dest : new URL(dest, request.url).toString();
  return Response.redirect(target, 302);
}
