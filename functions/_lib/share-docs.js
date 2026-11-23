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
  'apc-cannock-phase2-v3': {
    title: 'APC Business Plan · v3 (working)',
    neutral: true,                      // PIN screen shows no Orion branding
    ref: 'FY27 forecast · FY28–FY30 business plan',
    customer: 'APC Overnight Ltd',
    pinHash: '2d16a037304af4dbce55cde344e1698787604d3de57de9eea8b7c1eb60193d0d',   // same PIN as apc-cannock-phase2 / apc-sorter1-cap
    expires: null,
    files: {
      'document.pdf': { name: 'APC Business Plan FY28-FY30 - v3.pdf', type: 'application/pdf' },
      'f/assets-apc-logo-2026.svg': { name: 'assets-apc-logo-2026.svg', type: 'image/svg+xml' },
      'f/assets-jupiter-live-overview.jpg': { name: 'assets-jupiter-live-overview.jpg', type: 'image/jpeg' },
      'f/assets-v3-ai-ops.jpg': { name: 'assets-v3-ai-ops.jpg', type: 'image/jpeg' },
      'f/assets-v3-cage-new.jpg': { name: 'assets-v3-cage-new.jpg', type: 'image/jpeg' },
      'f/assets-v3-cage-old.jpg': { name: 'assets-v3-cage-old.jpg', type: 'image/jpeg' },
      'f/assets-v3-central-hub.jpg': { name: 'assets-v3-central-hub.jpg', type: 'image/jpeg' },
      'f/assets-v3-competitors.jpg': { name: 'assets-v3-competitors.jpg', type: 'image/jpeg' },
      'f/assets-v3-consign-split.jpg': { name: 'assets-v3-consign-split.jpg', type: 'image/jpeg' },
      'f/assets-v3-customers.jpg': { name: 'assets-v3-customers.jpg', type: 'image/jpeg' },
      'f/assets-v3-driver-bag.jpg': { name: 'assets-v3-driver-bag.jpg', type: 'image/jpeg' },
      'f/assets-v3-driver-handover.jpg': { name: 'assets-v3-driver-handover.jpg', type: 'image/jpeg' },
      'f/assets-v3-driver-van.jpg': { name: 'assets-v3-driver-van.jpg', type: 'image/jpeg' },
      'f/assets-v3-hub-map.jpg': { name: 'assets-v3-hub-map.jpg', type: 'image/jpeg' },
      'f/assets-v3-market-map.jpg': { name: 'assets-v3-market-map.jpg', type: 'image/jpeg' },
      'f/assets-v3-market-size.jpg': { name: 'assets-v3-market-size.jpg', type: 'image/jpeg' },
      'f/assets-v3-new-world.jpg': { name: 'assets-v3-new-world.jpg', type: 'image/jpeg' },
      'f/assets-v3-nsc-sign.jpg': { name: 'assets-v3-nsc-sign.jpg', type: 'image/jpeg' },
      'f/assets-v3-old-world.jpg': { name: 'assets-v3-old-world.jpg', type: 'image/jpeg' },
      'f/assets-v3-pipeline.jpg': { name: 'assets-v3-pipeline.jpg', type: 'image/jpeg' },
      'f/assets-v3-price-trend.jpg': { name: 'assets-v3-price-trend.jpg', type: 'image/jpeg' },
      'f/assets-v3-sme-trends.jpg': { name: 'assets-v3-sme-trends.jpg', type: 'image/jpeg' },
      'f/assets-v3-trailers.jpg': { name: 'assets-v3-trailers.jpg', type: 'image/jpeg' },
      'f/assets-v3-van-depot.jpg': { name: 'assets-v3-van-depot.jpg', type: 'image/jpeg' },
      'f/assets-v3-van-fleet.jpg': { name: 'assets-v3-van-fleet.jpg', type: 'image/jpeg' },
      'f/assets-v3-van-front.jpg': { name: 'assets-v3-van-front.jpg', type: 'image/jpeg' },
      'f/assets-v3-van-rear.jpg': { name: 'assets-v3-van-rear.jpg', type: 'image/jpeg' },
      'f/assets-v3-van-road.jpg': { name: 'assets-v3-van-road.jpg', type: 'image/jpeg' },
      'f/assets-v3-van-ws.jpg': { name: 'assets-v3-van-ws.jpg', type: 'image/jpeg' },
      'f/assets-v3-what-changes.jpg': { name: 'assets-v3-what-changes.jpg', type: 'image/jpeg' },
      'presentation.pptx': { name: 'APC Business Plan FY28-FY30 - v3.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    },
  },
  'apc-regional-hubs': {
    title: 'APC Regional Hub Proposals',
    neutral: true,                      // PIN screen shows no Orion branding
    ref: 'Regional hubs · new central sortation hub',
    customer: 'APC Overnight Ltd',
    pinHash: '2d16a037304af4dbce55cde344e1698787604d3de57de9eea8b7c1eb60193d0d',   // same PIN as apc-cannock-phase2 / apc-sorter1-cap
    expires: null,
    files: {
      'document.pdf': { name: 'APC Regional Hub Proposals.pdf', type: 'application/pdf' },
      'f/assets-apc-logo-2026.svg': { name: 'assets-apc-logo-2026.svg', type: 'image/svg+xml' },
      'f/assets-hubs-cannock-layout.jpg': { name: 'assets-hubs-cannock-layout.jpg', type: 'image/jpeg' },
      'f/assets-hubs-map-cannock.png': { name: 'assets-hubs-map-cannock.png', type: 'image/png' },
      'f/assets-hubs-map-full.png': { name: 'assets-hubs-map-full.png', type: 'image/png' },
      'f/assets-hubs-map-london.png': { name: 'assets-hubs-map-london.png', type: 'image/png' },
      'f/assets-hubs-map-north.png': { name: 'assets-hubs-map-north.png', type: 'image/png' },
      'f/assets-hubs-orion-logo-white.png': { name: 'assets-hubs-orion-logo-white.png', type: 'image/png' },
      'f/assets-hubs-twin-twin-poster.jpg': { name: 'assets-hubs-twin-twin-poster.jpg', type: 'image/jpeg' },
      'f/twin.html': { name: 'APC Central Hub - Orion digital twin.html', type: 'text/html; charset=utf-8', inline: true },
      'presentation.pptx': { name: 'APC Regional Hub Proposals.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    },
  },
};
