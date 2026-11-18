// ─────────────────────────────────────────────────────────────────────────
// Customer document share — the register of what is behind /share/<slug>/.
//
// Not a route — exports no onRequest handler, so Pages never serves it.
//
// Why this exists: HTML attachments get stripped or quarantined by most mail
// gateways, so customer packs (interactive HTML + PDF + XLSX) are hosted here
// behind a per-document PIN and sent as a link instead.
//
// To publish a new pack:
//   1. Put the files in  share/<slug>/  — index.html is served inline, every
//      other file is served as a download under the name given below.
//   2. Add an entry here. pinHash = SHA-256 of (PIN + PIN_SALT), lower-case hex.
//      Generate one with:  python -c "import hashlib;print(hashlib.sha256(('12345678'+'orion-share-v1').encode()).hexdigest())"
//      Only the hash is committed; the PIN itself goes to the customer by phone
//      or WhatsApp, never in the same email as the link.
//   3. git push. The link is https://orionmis.co.uk/share/<slug>/
//
// Rotating a PIN = replacing pinHash (logs every device out of that document).
// Retiring a pack = deleting its entry (the files can stay; they are
// unreachable without an entry) or setting  expires  to a past date.
// ─────────────────────────────────────────────────────────────────────────

export const PIN_SALT = 'orion-share-v1';

export const DOCS = {
  'apc-sorter1-cap': {
    title: 'Sorter 1 Corrective Action Plan',
    ref: 'ORI-CAN-CAP-001 · Rev A',
    customer: 'APC Overnight Ltd',
    pinHash: '2d16a037304af4dbce55cde344e1698787604d3de57de9eea8b7c1eb60193d0d',
    expires: null,                      // 'YYYY-MM-DD' or null
    files: {
      // served path  → { name shown on download, type }
      'plan.pdf':     { name: 'ORI-CAN-CAP-001 Rev A - APC Cannock Sorter 1 Corrective Action Plan.pdf', type: 'application/pdf' },
      'tracker.xlsx': { name: 'ORI-CAN-CAP-001 Rev A - APC Cannock Sorter 1 Corrective Action Plan (tracker).xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    },
  },
  'apc-cannock-phase2': {
    title: 'Cannock Phase 2 · Costs and Programme',
    ref: 'Mars Line · Earth Line · upgrades',
    customer: 'APC Overnight Ltd',
    pinHash: '2d16a037304af4dbce55cde344e1698787604d3de57de9eea8b7c1eb60193d0d',   // same PIN as apc-sorter1-cap (Danny, 17 Nov 2026)
    expires: null,
    files: {
      'document.pdf': { name: 'Orion - APC Cannock Phase 2 - Costs and Programme.pdf', type: 'application/pdf' },
      'f/assets-apc-logo-2026.svg': { name: 'assets-apc-logo-2026.svg', type: 'image/svg+xml' },
      'f/assets-helix-loop-poster.jpg': { name: 'assets-helix-loop-poster.jpg', type: 'image/jpeg' },
      'f/assets-jupiter-hall.jpg': { name: 'assets-jupiter-hall.jpg', type: 'image/jpeg' },
      'f/assets-jupiter-live-overview.jpg': { name: 'assets-jupiter-live-overview.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-3-lanes.jpg': { name: 'renders-gallery-jup2-3-lanes.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-4-loop.jpg': { name: 'renders-gallery-jup2-4-loop.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-plan-aerial.jpg': { name: 'renders-gallery-jup2-plan-aerial.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-plan-overview.jpg': { name: 'renders-gallery-jup2-plan-overview.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-3-sortpoints.jpg': { name: 'renders-gallery-line2-3-sortpoints.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-4-scan.jpg': { name: 'renders-gallery-line2-4-scan.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-plan-aerial.jpg': { name: 'renders-gallery-line2-plan-aerial.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-plan-overview.jpg': { name: 'renders-gallery-line2-plan-overview.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-tunnel-front.jpg': { name: 'renders-tunnel-tunnel-front.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-tunnel-hero.jpg': { name: 'renders-tunnel-tunnel-hero.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-tunnel-side.jpg': { name: 'renders-tunnel-tunnel-side.jpg', type: 'image/jpeg' },
      'presentation.pptx': { name: 'Orion - APC Cannock Phase 2 - Costs and Programme.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    },
  },
  'apc-cannock-phase2-v2': {
    title: 'Cannock Phase 2 · v2 (working)',
    neutral: true,                      // PIN screen shows no Orion branding
    ref: 'Mars Line · Earth Line · upgrades',
    customer: 'APC Overnight Ltd',
    pinHash: '2d16a037304af4dbce55cde344e1698787604d3de57de9eea8b7c1eb60193d0d',   // same PIN as apc-cannock-phase2 / apc-sorter1-cap
    expires: null,
    files: {
      'document.pdf': { name: 'APC Cannock Phase 2 - v2.pdf', type: 'application/pdf' },
      'f/assets-apc-logo-2026.svg': { name: 'assets-apc-logo-2026.svg', type: 'image/svg+xml' },
      'f/assets-helix-loop-poster.jpg': { name: 'assets-helix-loop-poster.jpg', type: 'image/jpeg' },
      'f/assets-jupiter-hall.jpg': { name: 'assets-jupiter-hall.jpg', type: 'image/jpeg' },
      'f/assets-jupiter-live-overview.jpg': { name: 'assets-jupiter-live-overview.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-3-lanes.jpg': { name: 'renders-gallery-jup2-3-lanes.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-4-loop.jpg': { name: 'renders-gallery-jup2-4-loop.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-plan-aerial.jpg': { name: 'renders-gallery-jup2-plan-aerial.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-plan-overview.jpg': { name: 'renders-gallery-jup2-plan-overview.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-3-sortpoints.jpg': { name: 'renders-gallery-line2-3-sortpoints.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-4-scan.jpg': { name: 'renders-gallery-line2-4-scan.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-plan-aerial.jpg': { name: 'renders-gallery-line2-plan-aerial.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-plan-overview.jpg': { name: 'renders-gallery-line2-plan-overview.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-v2-tunnel-front.jpg': { name: 'renders-tunnel-v2-tunnel-front.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-v2-tunnel-hero.jpg': { name: 'renders-tunnel-v2-tunnel-hero.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-v2-tunnel-side.jpg': { name: 'renders-tunnel-v2-tunnel-side.jpg', type: 'image/jpeg' },
      'presentation.pptx': { name: 'APC Cannock Phase 2 - v2.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    },
  },
  'apc-cannock-phase2-as-sent': {
    title: 'Cannock Phase 2 · as sent 17 Nov 2026',
    ref: 'Original issue · for continuity',
    customer: 'APC Overnight Ltd',
    pinHash: '2d16a037304af4dbce55cde344e1698787604d3de57de9eea8b7c1eb60193d0d',   // same PIN
    expires: null,
    files: {
      'document.pdf': { name: 'Orion - APC Cannock Phase 2 - Costs and Programme.pdf', type: 'application/pdf' },
      'f/assets-apc-logo-2026.svg': { name: 'assets-apc-logo-2026.svg', type: 'image/svg+xml' },
      'f/assets-helix-jupiter-banks.jpg': { name: 'assets-helix-jupiter-banks.jpg', type: 'image/jpeg' },
      'f/assets-helix-module.jpg': { name: 'assets-helix-module.jpg', type: 'image/jpeg' },
      'f/assets-helix-wheels.jpg': { name: 'assets-helix-wheels.jpg', type: 'image/jpeg' },
      'f/assets-jupiter-hall.jpg': { name: 'assets-jupiter-hall.jpg', type: 'image/jpeg' },
      'f/assets-jupiter-live-overview.jpg': { name: 'assets-jupiter-live-overview.jpg', type: 'image/jpeg' },
      'f/assets-orion-logo-white.png': { name: 'assets-orion-logo-white.png', type: 'image/png' },
      'f/renders-gallery-jup2-3-lanes.jpg': { name: 'renders-gallery-jup2-3-lanes.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-360-thumb.jpg': { name: 'renders-gallery-jup2-360-thumb.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-4-loop.jpg': { name: 'renders-gallery-jup2-4-loop.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-plan-aerial.jpg': { name: 'renders-gallery-jup2-plan-aerial.jpg', type: 'image/jpeg' },
      'f/renders-gallery-jup2-plan-overview.jpg': { name: 'renders-gallery-jup2-plan-overview.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-3-sortpoints.jpg': { name: 'renders-gallery-line2-3-sortpoints.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-360-thumb.jpg': { name: 'renders-gallery-line2-360-thumb.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-4-scan.jpg': { name: 'renders-gallery-line2-4-scan.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-plan-aerial.jpg': { name: 'renders-gallery-line2-plan-aerial.jpg', type: 'image/jpeg' },
      'f/renders-gallery-line2-plan-overview.jpg': { name: 'renders-gallery-line2-plan-overview.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-tunnel-front.jpg': { name: 'renders-tunnel-tunnel-front.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-tunnel-hero.jpg': { name: 'renders-tunnel-tunnel-hero.jpg', type: 'image/jpeg' },
      'f/renders-tunnel-tunnel-side.jpg': { name: 'renders-tunnel-tunnel-side.jpg', type: 'image/jpeg' },
    },
  },
};
