# /share — customer document packs, PIN-gated

Why: HTML attachments get stripped or quarantined by most mail gateways. Packs
(interactive HTML + PDF + XLSX) live here behind a PIN and go out as a link.

Each pack is a folder under `share/` and an entry in `functions/_lib/share-docs.js`.
The gate is `functions/share/[[route]].js`. `_headers` marks `/share/*` noindex, no-store.
Nothing under `share/` is reachable without an entry in the register.

## Publish a pack

1. Make the folder: `share/<slug>/` (lower-case letters, digits, hyphens).
2. Put `index.html` in it (served inline when the PIN is right) plus any
   downloads, e.g. `plan.pdf`, `tracker.xlsx`. Keep served filenames short;
   the download name the customer sees is set in the register.
3. Pick an 8-digit PIN and hash it:

       python -c "import hashlib;print(hashlib.sha256(('12345678'+'orion-share-v1').encode()).hexdigest())"

4. Add the entry to `functions/_lib/share-docs.js`: title, ref, customer,
   pinHash, expires (or null), files.
5. Commit and push. Live about a minute later at
   `https://orionmis.co.uk/share/<slug>/`.
6. Email the link. Send the PIN by WhatsApp or text, never in the same email.

## Reissue (Rev B, C …)

Overwrite the files in the folder, update `ref` in the register, push.
The link and PIN stay the same, so the customer's bookmark keeps working.

## Rotate or retire

- Rotate a PIN: replace `pinHash`. Every device is logged out of that pack.
- Retire a pack: delete its register entry, or set `expires: 'YYYY-MM-DD'`.

## Behaviour

- Cookie per pack, 30 days, HttpOnly. `/share/<slug>/logout` clears it.
- Wrong PINs are rate-limited per IP and per pack through `SNAG_DB`
  (`functions/_lib/pin-guard.js`), the same limiter as the APC snag app.
- No PIN is stored anywhere; the register holds a salted SHA-256 only.

## Current packs

| slug | document | customer |
|---|---|---|
| apc-sorter1-cap | ORI-CAN-CAP-001 Sorter 1 Corrective Action Plan | APC Overnight Ltd |
