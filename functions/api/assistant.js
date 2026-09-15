// ─────────────────────────────────────────────────────────────────────────
// POST /api/assistant — Ask Orion chat proxy for courier-builder.html.
//
// The browser never sees an API key: this function holds ANTHROPIC_API_KEY
// as a Pages secret and forwards the visitor's chat to the Claude API with
// a server-controlled system prompt (Orion knowledge base + commercial
// rules) and a server-defined add_components tool. The client sends only
// its message history and a layout snapshot — model, system prompt and
// tools cannot be overridden from the page.
//
// Layers, in order (mirrors /api/submit):
//   1. Origin allow-list — non-browser or off-site posts are refused
//   2. Payload caps      — max 20 messages, 2,000 chars each, 30 components
//   3. Server prompt     — KB + layout context assembled here, not client-side
// Add a Cloudflare rate-limiting rule on /api/assistant* like /api/submit*.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'https://orionmis.co.uk',
  'https://www.orionmis.co.uk',
  'https://helixsorter.co.uk',
  'https://www.helixsorter.co.uk',
]);

const COMPONENT_TYPES = [
  'belt', 'driven', 'gravity', 'bend', 'merge', 'mergeL',
  'scan', 'helix', 'chute', 'kickout', 'lift', 'controlsBasic', 'controlsAdv',
];

const KNOWLEDGE_BASE = `
ORION MIS — KNOWLEDGE BASE

Company: Orion MIS is a UK warehouse automation OEM. We design, build and
install complete automation systems — conveyors, the Helix modular parcel
sorter, robotics, vision and the Helios warehouse operating system — from one
UK facility in Chichester, West Sussex. Contact: info@orionmis.co.uk ·
+44 333 335 5269 · book a call at https://orionmis.co.uk/call

Helix parcel sorter: modular sortation using steerable pivot-wheel divert
modules. Sorts parcels on a 200 mm gap (the key throughput advantage), scales
in 200 mm cassette modules, live installations run 4,000–20,000 parcels per
hour. Handles bags, boxes, polybags, mixed sizes and awkward freight. Adding
sort destinations later means extending the divert run — not rebuilding.
Customers typically start with 16–24 destinations and expand. Cassette
modules swap in under 15 minutes with no specialist tools; recommended spares
are included in proposals. 24-month parts-and-labour warranty on the core
product.

Software: Orion WCS is included with every Helix system as standard —
dashboards, routing logic, alarming. Integrates with existing WMS/TMS via
REST API, MQTT or flat-file drop, confirmed at the Functional Design
Specification stage. Helios is the wider warehouse operating system.

Delivery: smaller conveyor packages on site in 6–10 weeks; full Helix
sortation systems typically 12–25 weeks order-to-live, with on-site install
usually under 4 weeks. No building extensions or planning permission needed.
Orion surveys and integrates with existing conveyors, scanners and controls
rather than ripping out working kit.

Commercial: every system can be bought outright or paid monthly through
finance (subject to specification and lender approval); entry systems
typically from ~£4,000/month on a 60-month term. Standards: ISO 9001:2015,
Avetta verified, EcoVadis rated; systems designed to UKCA/CE with conformity
to ISO 12100, ISO 13849, EN 619, BS 7671.

Sectors: courier and parcel centres, postal operators, 3PLs, fulfilment and
e-commerce, food & beverage manufacturing. Factory visits welcome — bring a
real parcel profile and run it on a live Helix.

Useful links: products https://orionmis.co.uk/products.html · sorter
comparison guide https://orionmis.co.uk/parcel-sorter-comparison · cost guide
https://orionmis.co.uk/warehouse-automation-cost-uk · send a sketch
https://orionmis.co.uk/sketch.html
`.trim();

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function systemPrompt(layout) {
  return [
    'You are "Ask Orion", the assistant inside the Courier Sortation Builder on orionmis.co.uk — a canvas where visitors from courier and parcel logistics operations lay out conveyor and sortation systems and see a live indicative budget.',
    'Answer from the knowledge base below. Help the visitor with their layout: the current design, throughput, footprint, what Helix could do for their operation, and sensible next components. When they ask you to add something to the layout, call the add_components tool.',
    'Available component type codes: belt = Belt conveyor; driven = Driven roller conveyor; gravity = Gravity roller conveyor; bend = Bend (60°); merge = Right merge (30°); mergeL = Left merge (30°); scan = Scan tunnel; helix = Helix sorter module; chute = Dispatch chute; kickout = Kickout / reject lane; lift = Lift; controlsBasic = Controls / WCS — Basic; controlsAdv = Controls / WCS — Advanced.',
    'COMMERCIAL RULES — strict: the only figures you may state are the indicative budget total, delivery and lease illustrations present in the layout context, and the public "from ~£4,000/month" entry point. All pricing is indicative and subject to site survey. Never discuss margins, discounts, internal cost rates or cost build-up. For firm pricing, invite them to send the layout to Orion (the "Send this layout to Orion" button) or book a call at https://orionmis.co.uk/call.',
    'Style: concise UK English, plain engineering language, factual claims only, no hype. Keep answers short — this is a small chat panel. Treat the visitor as a prospective customer: be helpful first; suggest contacting Orion when the conversation reaches sizing, pricing detail or a site visit.',
    '',
    KNOWLEDGE_BASE,
    '',
    'CURRENT LAYOUT (live from the visitor’s canvas):',
    JSON.stringify(layout || {}),
  ].join('\n');
}

const ADD_COMPONENTS_TOOL = {
  name: 'add_components',
  description:
    "Add conveyor / sortation components to the visitor's canvas. Positions are optional offsets in mm from the current viewport centre; omit x/y to auto-place.",
  input_schema: {
    type: 'object',
    properties: {
      components: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: COMPONENT_TYPES },
            x: { type: 'number', description: 'Optional mm offset right of viewport centre.' },
            y: { type: 'number', description: 'Optional mm offset below viewport centre.' },
            rotation: { type: 'number', description: 'Degrees clockwise, 0 = long axis pointing right.' },
            length: { type: 'number', description: 'Length in mm; omit for the library default.' },
            width: { type: 'number', description: 'Width in mm; omit for the library default.' },
            qty: { type: 'number', description: 'Quantity, default 1.' },
            name: { type: 'string', description: 'Optional friendly name override.' },
          },
          required: ['type'],
        },
      },
    },
    required: ['components'],
  },
};

// Keep only shapes the page actually sends; drop anything else a caller
// could inject (system turns, images, oversized text).
function sanitiseMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw.slice(-20)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content.slice(0, 2000) });
      continue;
    }
    if (!Array.isArray(m.content)) return null;
    const blocks = [];
    for (const b of m.content.slice(0, 8)) {
      if (b?.type === 'text') blocks.push({ type: 'text', text: String(b.text || '').slice(0, 2000) });
      else if (b?.type === 'tool_use' && b.name === 'add_components')
        blocks.push({ type: 'tool_use', id: String(b.id || ''), name: 'add_components', input: b.input || {} });
      else if (b?.type === 'tool_result')
        blocks.push({ type: 'tool_result', tool_use_id: String(b.tool_use_id || ''), content: String(b.content || '').slice(0, 500) });
      else return null;
    }
    out.push({ role: m.role, content: blocks });
  }
  return out.length ? out : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get('Origin') || '';
  const originOk =
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/[a-z0-9-]+\.orion-final-1605\.pages\.dev$/.test(origin);
  if (!originOk) return json({ error: { message: 'Forbidden' } }, 403);

  if (!env.ANTHROPIC_API_KEY)
    return json({ error: { message: 'Assistant not configured yet — please use the "Send this layout to Orion" button instead.' } }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: { message: 'Bad request' } }, 400);
  }

  const messages = sanitiseMessages(body.messages);
  if (!messages) return json({ error: { message: 'Bad request' } }, 400);

  const layout = body.layout && typeof body.layout === 'object' ? body.layout : {};
  if (Array.isArray(layout.components)) layout.components = layout.components.slice(0, 30);
  const layoutStr = JSON.stringify(layout);
  if (layoutStr.length > 20000) return json({ error: { message: 'Layout too large' } }, 400);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: systemPrompt(layout),
      tools: [ADD_COMPONENTS_TOOL],
      messages,
    }),
  });

  if (!upstream.ok) {
    // Never forward upstream auth detail to the browser
    const status = upstream.status === 429 ? 429 : 502;
    return json({ error: { message: status === 429 ? 'The assistant is busy — try again in a moment.' : 'Assistant temporarily unavailable.' } }, status);
  }

  const data = await upstream.json();
  // Forward only what the page needs: the content blocks
  return json({ content: data.content || [] });
}
