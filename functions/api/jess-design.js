// ─────────────────────────────────────────────────────────────────────────
// POST /api/jess-design — "Describe a design" for the private fence-screen
// designer at /jess-f-f6e9bf06/. Turns a short description into a black and
// white stencil SVG that the page then makes cuttable (bridges, webs).
//
// The browser never sees an API key: ANTHROPIC_API_KEY is a Pages secret.
// The client sends only {desc, w, h}; model, prompt and limits are fixed here.
//   1. Origin allow-list  — off-site and non-browser posts are refused
//   2. Payload caps       — description 600 chars, canvas size clamped
//   3. Streamed reply     — text only; the page extracts and sanitises the
//                           <svg> and only ever draws it as an image
// Add a Cloudflare rate-limiting rule on /api/jess-design like /api/submit*.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set(['https://orionmis.co.uk', 'https://www.orionmis.co.uk']);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function prompt(desc, w, h) {
  return `Draw a stencil design for a laser-cut steel garden screen as a single SVG.
Subject: ${desc}
Rules:
- Output ONLY the SVG, starting <svg and ending </svg>, with viewBox="0 0 ${w} ${h}" and width="${w}" height="${h}". No commentary.
- Pure black (#000) filled shapes on a white (#fff) background rect. Black is cut out of the metal; white stays as metal.
- Bold, flat, filled silhouettes only: no outlines, no strokes thinner than 12 units, no gradients, no text, no photos, no filters.
- Keep white gaps between black shapes at least 10 units wide. Avoid tiny details under 15 units.
- Fill the whole canvas edge to edge with a balanced composition; black should cover roughly 35-55% of the area.
- Organic, elegant, in the style of decorative laser-cut garden screens (like tree branch or sea-life screen panels).
- Use at most about 80 path/shape elements and keep path data compact (integers only).`;
}

// Kept for reference; sanitising now happens in the page after streaming.
function cleanSvg(text) {
  const m = String(text || '').match(/<svg[\s\S]*<\/svg>/i);
  if (!m) return null;
  return m[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
}

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = request.headers.get('Origin') || '';
  if (!(ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.orion-final-1605\.pages\.dev$/.test(origin)))
    return json({ error: 'Forbidden' }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'Drawing from a description is not switched on yet. Upload a picture instead.' }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const desc = String(body.desc || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (desc.length < 3) return json({ error: 'Describe the design in a few words.' }, 400);
  const w = 1000;
  const h = Math.max(200, Math.min(3000, Math.round(Number(body.h) || 400)));

  // Stream: a full SVG can take over 100 s, past Cloudflare's proxy timeout,
  // so text deltas are forwarded as they arrive. The page sanitises the SVG.
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 12000,
      stream: true,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt(desc, w, h) }],
    }),
  });
  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? 'Busy, try again in a minute.' : 'The drawing service is unavailable right now.' }, status);
  }

  const { readable, writable } = new TransformStream();
  const pump = (async () => {
    const out = writable.getWriter();
    const enc = new TextEncoder();
    const reader = upstream.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          let ev;
          try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') await out.write(enc.encode(ev.delta.text));
          // Keep the connection busy while the model thinks (spaces are ignored by the page)
          else if (ev.type === 'ping' || ev.type === 'content_block_start' || (ev.type === 'content_block_delta' && ev.delta && ev.delta.type !== 'text_delta')) await out.write(enc.encode(' '));
          else if (ev.type === 'error') await out.write(enc.encode('\n[[ERROR]]'));
        }
      }
    } catch (e) {
      await out.write(enc.encode('\n[[ERROR]]')).catch(() => {});
    }
    await out.close().catch(() => {});
  })();
  if (waitUntil) waitUntil(pump);
  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
