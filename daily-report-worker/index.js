// ─────────────────────────────────────────────────────────────────────────
// APC Phase 1 snag report — scheduled email Worker (separate from the Pages
// project because Pages Functions cannot run cron triggers).
//
// Every morning it fetches the WhatsApp-formatted report text from the snag
// app's API and emails it via Resend, so the body can be copied straight
// into the site WhatsApp group. The email also carries a wa.me link that
// opens WhatsApp with the text prefilled.
//
// Deploy (from this folder):   npx wrangler deploy
// Secrets (once):              npx wrangler secret put SNAG_TOKEN
//                              npx wrangler secret put RESEND_API_KEY
// Optional vars: EMAIL_TO (default danny.grigg@orionmis.co.uk),
//                EMAIL_FROM (default onboarding@resend.dev — fine while the
//                only recipient is the Resend account owner; verify the
//                orionmis.co.uk domain in Resend to add other recipients).
// ─────────────────────────────────────────────────────────────────────────

const REPORT_URL = 'https://orionmis.co.uk/apc-p1-28f2a2ab/api/report?format=wa';

async function sendReport(env) {
  const res = await fetch(REPORT_URL, { headers: { 'X-Auth': (env.SNAG_TOKEN || '').trim() } });
  if (!res.ok) throw new Error(`Report fetch failed: ${res.status} ${await res.text()}`);
  const text = await res.text();

  const waLink = 'https://wa.me/?text=' + encodeURIComponent(text);
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  const body =
    `${text}\n\n` +
    `— — —\n` +
    `Copy the text above into the site WhatsApp group, or tap to prefill:\n${waLink}\n\n` +
    `Live board: https://orionmis.co.uk/apc-p1-28f2a2ab/`;

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [env.EMAIL_TO || 'danny.grigg@orionmis.co.uk'],
      subject: `APC Phase 1 snag report — ${dateStr}`,
      text: body,
    }),
  });
  if (!send.ok) throw new Error(`Resend failed: ${send.status} ${await send.text()}`);
  return send.json();
}

export default {
  // Cron fires at 06:00 UTC = 07:00 UK during British Summer Time
  // (06:00 UK after the late-October clock change — adjust in wrangler.jsonc
  // if a hard 7am matters in winter).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReport(env));
  },

  // Manual test: GET the worker URL with ?key=<SNAG_TOKEN> to trigger one send.
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = (url.searchParams.get('key') || '').trim();
    const expected = (env.SNAG_TOKEN || '').trim();
    if (!expected || key !== expected) {
      return new Response(expected ? 'Not authorised' : 'SNAG_TOKEN secret not set', { status: 401 });
    }
    try {
      const r = await sendReport(env);
      return new Response('Sent: ' + JSON.stringify(r), { status: 200 });
    } catch (e) {
      return new Response('Failed: ' + e.message, { status: 500 });
    }
  },
};
