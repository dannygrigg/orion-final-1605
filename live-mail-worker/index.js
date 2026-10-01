// ─────────────────────────────────────────────────────────────────────────
// Orion Live — capture mailbox (Cloudflare Email Worker).
//
// Cloudflare Email Routing delivers every message sent to *@projects.orionmis.co.uk
// here. Each one is parsed and filed against its job in the Orion Live
// database (job address, then ref in subject, then customer address);
// anything that can't be matched waits under "Mail to file" in the staff app.
// Nothing is forwarded or replied to.
//
// Deploy (from this folder):  npm install && npx wrangler deploy
// Then: Cloudflare dash → orionmis.co.uk → Email → Email Routing → subdomain
// projects.orionmis.co.uk → catch-all → Send to Worker → orion-live-mail.
// ─────────────────────────────────────────────────────────────────────────
import PostalMime from 'postal-mime';
import { ensureSchema, captureMail } from '../live-6c93deb1/_srv/server.js';

export default {
  async email(message, env) {
    if (!env.SNAG_DB) throw new Error('D1 binding SNAG_DB missing');
    const raw = await new Response(message.raw).arrayBuffer();
    const mail = await PostalMime.parse(raw);
    await ensureSchema(env.SNAG_DB);
    const r = await captureMail(env, { envelopeTo: message.to, envelopeFrom: message.from, mail });
    console.log('captured', JSON.stringify({ to: message.to, subject: mail.subject, ...r }));
  },
};
