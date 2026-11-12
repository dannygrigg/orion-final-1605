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
};
