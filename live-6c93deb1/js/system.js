// ─────────────────────────────────────────────────────────────────────────
// Orion Live — drawings of the customer's system for their project page.
//
// A project's `system` setting picks a drawing type and its sizes, e.g.
//   { type: 'sorter', infeeds: 2, outputs: 3, slices: 5, spine: '28.9 m', scan: true, fence: true }
// Each section of the drawing lights up by stage:
//   plan (dashed blueprint) → design → parts → built → test (amber glow) → live (green).
// Shared by the customer page and the staff preview. Plain ES module.
// ─────────────────────────────────────────────────────────────────────────

export const SYSTEM_TYPES = {
  sorter: { label: 'Sorter (Helix)', noun: 'sorter', fields: [['infeeds', 'Infeed lines', 1, 4, 2], ['outputs', 'Sort outputs', 1, 8, 3], ['slices', 'Slices per output', 1, 10, 5]] },
  conveyor: { label: 'Conveyor run', noun: 'conveyor', fields: [['bends', 'Bends', 0, 4, 2]] },
  guarding: { label: 'Guarding / barriers', noun: 'guarding', fields: [['bays', 'Runs or assemblies', 1, 16, 11]] },
  stillage: { label: 'Stillages / fabrications', noun: 'stillages', fields: [['units', 'Units shown', 1, 6, 3]] },
  generic: { label: 'General (no drawing)', noun: 'system', fields: [] },
};

export const LABEL = { plan: 'On the drawing', design: 'Being engineered', parts: 'Parts arriving', built: 'Built', test: 'Being tested', live: 'Complete' };
export const PCT = { plan: 5, design: 20, parts: 40, built: 75, test: 90, live: 100 };
const COLOR = { plan: '#5aa9e6', design: '#5aa9e6', parts: '#4e6274', built: '#9fb3c4', test: '#ffb323', live: '#38d47a' };
export const SECT_COLOR = { plan: 'var(--steel)', design: 'var(--steel)', parts: '#8b9aa8', built: '#6f8496', test: 'var(--accent)', live: 'var(--good)' };

const clampInt = (v, lo, hi, d) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export function normaliseSystem(sys) {
  const s = sys && typeof sys === 'object' ? sys : {};
  const type = SYSTEM_TYPES[s.type] ? s.type : 'generic';
  const out = { type };
  SYSTEM_TYPES[type].fields.forEach(([k, , lo, hi, d]) => { out[k] = clampInt(s[k], lo, hi, d); });
  if (type === 'sorter') { out.scan = s.scan !== false; out.fence = !!s.fence; out.spine = String(s.spine || '').slice(0, 20); }
  if (type === 'conveyor' || type === 'guarding' || type === 'stillage') out.label = String(s.label || '').slice(0, 40);
  return out;
}

// Sections of each drawing, and which ones are "main" (built first, tested in the factory)
export function sectionsOf(sys) {
  const s = normaliseSystem(sys);
  if (s.type === 'sorter') return [
    { id: 'infeed', name: `Infeed line${s.infeeds > 1 ? 's' : ''} (${s.infeeds})` },
    { id: 'spine', name: `Sortation spine${s.spine ? ', ' + s.spine : ''}` },
    ...(s.scan ? [{ id: 'scan', name: 'Scanning and tracking', main: true }] : []),
    ...Array.from({ length: s.outputs }, (_, i) => ({ id: 'out' + i, name: `Helix output ${i + 1} (${s.slices} slices)`, main: true })),
    { id: 'end', name: 'Overflow and no-read run-out' },
    { id: 'panel', name: 'Control panel and software', main: true },
    ...(s.fence ? [{ id: 'fence', name: 'Safety fencing' }] : []),
  ];
  if (s.type === 'conveyor') return [{ id: 'run', name: s.label || 'Conveyor run', main: true }, { id: 'bends', name: `Bends (${s.bends})` }, { id: 'panel', name: 'Controls and drives', main: true }];
  if (s.type === 'guarding') return [{ id: 'runs', name: `${s.label || 'Barrier assemblies'} (${s.bays})`, main: true }, { id: 'fix', name: 'Fixings and location guides' }];
  if (s.type === 'stillage') return [{ id: 'frames', name: s.label || 'Stillage frames', main: true }, { id: 'lift', name: 'Lifting points and certification' }];
  return [{ id: 'design', name: 'Design', main: true }, { id: 'make', name: 'Manufacture and supply' }, { id: 'install', name: 'Installation and handover' }];
}

// State of one section at a stage (0–11, see STAGES in spine.js)
export function stateAt(stage, section, index, count) {
  if (stage <= 2) return 'plan';
  if (stage <= 4) return 'design';
  if (stage === 5) return 'parts';
  if (stage === 6) return section.main && index < Math.ceil(count / 2) ? 'built' : 'parts';
  if (stage === 7) return section.main ? 'test' : 'built';
  if (stage === 8) return 'built';
  if (stage === 9) return 'test';
  return 'live';
}
export function percentAt(stage, sys) {
  if (stage < 0) return 0;
  if (stage >= 10) return 100;
  const secs = sectionsOf(sys);
  return Math.round(secs.reduce((a, s, i) => a + PCT[stateAt(stage, s, i, secs.length)], 0) / secs.length);
}

// ── drawing ──
const txt = (x, y, t, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" font-size="${o.s || 12}" fill="${o.c || '#e9eef2'}" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif" font-weight="${o.w || 600}" letter-spacing="${o.ls || 0}">${t}</text>`;
function look(st) {
  const c = COLOR[st];
  if (st === 'plan') return `fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 4" opacity=".75"`;
  if (st === 'design') return `fill="${c}" fill-opacity=".08" stroke="${c}" stroke-width="1.5"`;
  if (st === 'parts') return `fill="${c}" fill-opacity=".55" stroke="#6b8194" stroke-width="1" stroke-dasharray="3 3"`;
  return `fill="${c}" fill-opacity=".88" stroke="${c}" stroke-width="1.5" ${st === 'test' || st === 'live' ? 'filter="url(#olglow)"' : ''}`;
}
// A conveyor drawn as a belt with two edges: blueprint = dashed outline, later stages = filled belt.
function tube(d, st, w = 20) {
  const c = COLOR[st], inner = '#0c1218';
  if (st === 'plan' || st === 'design') return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" opacity=".85"/><path d="${d}" fill="none" stroke="${inner}" stroke-width="${w - 3}" stroke-linejoin="round"/>${st === 'plan' ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 9" opacity=".6"/>` : ''}`;
  if (st === 'parts') return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" opacity=".6"/><path d="${d}" fill="none" stroke="#6b8194" stroke-width="1" stroke-dasharray="3 4"/>`;
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" opacity=".9" ${st === 'test' || st === 'live' ? 'filter="url(#olglow)"' : ''}/><path d="${d}" fill="none" stroke="#0c1218" stroke-width="1" stroke-opacity=".35" stroke-dasharray="1 6"/>`;
}
const strokeLook = st => `stroke="${COLOR[st]}" opacity="${st === 'plan' ? .4 : st === 'design' ? .5 : .85}" ${st === 'plan' ? 'stroke-dasharray="6 5"' : ''}`;
const DEFS = `<defs><filter id="olglow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

// Returns { svg, flow } — flow describes parcel paths for the animation (sorters and conveyors only)
export function drawSystem(sys, stage) {
  const s = normaliseSystem(sys), secs = sectionsOf(s);
  const st = id => { const i = secs.findIndex(x => x.id === id); return i < 0 ? 'plan' : stateAt(stage, secs[i], i, secs.length); };
  const on = id => ['test', 'live'].includes(st(id));
  let body = '', flow = null;

  if (s.type === 'sorter') {
    const y = 210, h = 22, x0 = 70, x1 = 880;
    const inX = Array.from({ length: s.infeeds }, (_, i) => x0 + i * 70);
    const gapX = inX[inX.length - 1] + 60;
    const scanX = gapX + 100;
    const firstOut = (s.scan ? scanX + 70 : gapX + 110), lastOut = x1 - 140;
    const outX = Array.from({ length: s.outputs }, (_, i) => s.outputs === 1 ? (firstOut + lastOut) / 2 : firstOut + i * (lastOut - firstOut) / (s.outputs - 1));
    const ow = Math.min(80, 14 * s.slices + 10);
    if (s.fence) body += `<g><rect x="22" y="18" width="956" height="292" rx="6" fill="none" stroke="${COLOR[st('fence')]}" stroke-dasharray="7 6" stroke-width="1.5" opacity=".75"/>${txt(36, 38, 'SAFETY FENCING', { a: 'start', s: 11.5, c: '#8b9aa8', w: 500, ls: '.08em' })}</g>`;
    body += `<g>${inX.map((x, i) => `<rect x="${x}" y="${y + h}" width="22" height="78" ${look(st('infeed'))}/><circle cx="${x + 11}" cy="${y + h + 62}" r="5" fill="${on('infeed') ? (i % 2 ? '#ff5a4d' : '#38d47a') : '#2a3a48'}"/>`).join('')}
      ${txt((inX[0] + inX[inX.length - 1] + 22) / 2, y + h + 96, s.infeeds > 1 ? `INFEEDS 1–${s.infeeds}` : 'INFEED')}</g>`;
    body += `<g><rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" rx="2" ${look(st('spine'))}/>
      ${[0, 1, 2].map(i => `<rect x="${gapX + i * 26}" y="${y}" width="22" height="${h}" fill="#6b4fa3" fill-opacity="${st('spine') === 'plan' ? .15 : .55}"/>`).join('')}
      ${txt(gapX + 37, y + h + 20, 'GAPPERS', { s: 11.5, c: '#8b9aa8', w: 500 })}${txt((x0 + x1) / 2 + 100, y + h + 44, 'SORTATION SPINE' + (s.spine ? ' ' + s.spine : ''))}</g>`;
    if (s.scan) body += `<g><rect x="${scanX}" y="${y - 20}" width="46" height="${h + 40}" rx="3" ${look(st('scan'))} fill-opacity=".25"/><line class="ol-beam" x1="${scanX + 23}" y1="${y - 16}" x2="${scanX + 23}" y2="${y + h + 16}" stroke="#38d47a" stroke-width="2" opacity="0"/>${txt(scanX + 23, y - 28, 'SCAN')}</g>`;
    body += outX.map((x, i) => { const S = st('out' + i); return `<g>
      ${tube(`M${x + ow * .3} ${y - 2} L${x + ow * .78} ${y - 70} L${x + ow * .78} ${y - 128}`, S, 18)}
      <rect x="${x}" y="${y - 3}" width="${ow}" height="${h + 6}" rx="2" ${look(S)}/>
      ${Array.from({ length: s.slices - 1 }, (_, k) => `<line x1="${x + (k + 1) * ow / s.slices}" y1="${y}" x2="${x + (k + 1) * ow / s.slices}" y2="${y + h}" stroke="#0c1218" stroke-opacity=".5"/>`).join('')}
      <rect x="${x + ow * .78 - 24}" y="${y - 160}" width="48" height="26" rx="3" fill="none" stroke="#5c6d7d" stroke-dasharray="3 3"/>
      ${txt(x + ow * .78, y - 143, 'BAY ' + (i + 1), { s: 11.5, c: '#8b9aa8', w: 500 })}${txt(x + ow / 2, y + h + 20, 'OUTPUT ' + (i + 1))}</g>`; }).join('');
    body += `<g>${tube(`M${x1} ${y + h / 2} q44 0 44 44 v40`, st('end'), 20)}${txt(x1 + 44, y + h + 86, 'OVERFLOW')}</g>`;
    const px = (x0 + x1) / 2 - 52;
    body += `<g><rect x="${px}" y="${y + h + 60}" width="104" height="34" rx="3" ${look(st('panel'))}/>${[0, 1, 2].map(i => `<circle cx="${px + 18 + i * 14}" cy="${y + h + 77}" r="3.5" fill="${on('panel') ? ['#38d47a', '#ffb323', '#38d47a'][i] : '#2a3a48'}"/>`).join('')}${txt(px + 72, y + h + 82, 'PANEL', { s: 11.5 })}</g>`;
    if (stage >= 9) flow = { kind: 'sorter', y: y + h / 2, inX: inX.map(x => x + 11), inTop: y + h + 74, outX: outX.map(x => x + ow * .3), outRise: ow * .48, endX: x1 + 20, scanX: s.scan ? scanX + 23 : null };
  } else if (s.type === 'conveyor') {
    const y = 200, bends = s.bends;
    const pts = [[70, y]]; let x = 70, yy = y, dir = 1;
    const seg = 760 / (bends + 1);
    for (let b = 0; b < bends; b++) { x += seg; pts.push([x, yy]); yy += dir * 70; dir *= -1; pts.push([x, yy]); }
    pts.push([830, yy]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    body += tube(d, st('run'), 22);
    body += pts.slice(1, -1).filter((_, i) => i % 2 === 0).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="16" ${look(st('bends'))}/>`).join('');
    body += `<rect x="806" y="${yy - 30}" width="50" height="60" rx="4" ${look(st('panel'))}/>${txt(831, yy + 50, 'DRIVE + CONTROLS', { s: 11.5 })}`;
    body += txt(450, 300, (s.label || 'CONVEYOR RUN').toUpperCase());
    if (stage >= 9) flow = { kind: 'path', pts };
  } else if (s.type === 'guarding') {
    const n = s.bays, w = 860 / n;
    for (let i = 0; i < n; i++) {
      const x = 70 + i * w;
      body += `<rect x="${x + 6}" y="120" width="${w - 12}" height="100" rx="4" fill="none" stroke="#3a4b5b" stroke-dasharray="4 4"/>`;
      body += `<rect x="${x}" y="228" width="${w - 4}" height="12" rx="2" ${look(st('runs'))}/>`;
      body += `<rect x="${x - 2}" y="222" width="6" height="24" rx="1" ${look(st('fix'))}/>`;
    }
    body += txt(500, 110, 'CAGE LOCATIONS', { s: 11.5, c: '#8b9aa8', w: 500 }) + txt(500, 275, (s.label || 'BARRIER ASSEMBLIES').toUpperCase());
  } else if (s.type === 'stillage') {
    const n = s.units, w = 760 / n;
    for (let i = 0; i < n; i++) {
      const x = 120 + i * w, W = w - 40;
      body += `<g><rect x="${x}" y="190" width="${W}" height="16" rx="2" ${look(st('frames'))}/>
        <rect x="${x}" y="120" width="8" height="70" ${look(st('frames'))}/><rect x="${x + W - 8}" y="120" width="8" height="70" ${look(st('frames'))}/>
        <rect x="${x + 10}" y="206" width="14" height="22" ${look(st('frames'))}/><rect x="${x + W - 24}" y="206" width="14" height="22" ${look(st('frames'))}/>
        ${[x + 4, x + W - 4].map(cx => `<circle cx="${cx}" cy="112" r="8" fill="none" stroke="${COLOR[st('lift')]}" stroke-width="3" ${st('lift') === 'plan' ? 'stroke-dasharray="3 3"' : ''}/>`).join('')}</g>`;
    }
    body += txt(500, 270, (s.label || 'STILLAGES').toUpperCase());
  } else {
    const steps = secs.map((x, i) => ({ x: 170 + i * 330, id: x.id, n: x.name }));
    body += `<line x1="170" y1="160" x2="830" y2="160" stroke="#2a3a48" stroke-width="4"/>`;
    body += steps.map(p => `<circle cx="${p.x}" cy="160" r="34" ${look(st(p.id))}/>${txt(p.x, 220, p.n.toUpperCase(), { s: 12 })}`).join('');
  }
  const svg = `<svg viewBox="0 0 1000 330" role="img" aria-label="Drawing of your ${SYSTEM_TYPES[s.type].noun}">${DEFS}${body}<g class="ol-parcels"></g>
    ${stage === 8 ? `<g transform="translate(40 52)"><rect width="110" height="38" rx="4" fill="#24303b" stroke="#5c6d7d"/><rect x="110" y="10" width="34" height="28" rx="3" fill="#24303b" stroke="#5c6d7d"/><circle cx="26" cy="42" r="7" fill="#0c1218" stroke="#8b9aa8"/><circle cx="122" cy="42" r="7" fill="#0c1218" stroke="#8b9aa8"/>${txt(55, 24, 'ON ITS WAY', { s: 11 })}</g>` : ''}</svg>`;
  return { svg, flow, legend: ['plan', 'parts', 'built', 'test', 'live'].map(k => ({ k, label: LABEL[k], color: COLOR[k] })) };
}

// Animate parcels inside a rendered drawing. Returns a stop function.
export function animate(svgEl, flow) {
  const g = svgEl?.querySelector('.ol-parcels');
  if (!g || !flow) return () => {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beam = svgEl.querySelector('.ol-beam');
  const box = (x, y) => `<rect x="${x - 6}" y="${y - 4.5}" width="12" height="9" rx="1.5" fill="#d9a066" stroke="#7a5230" stroke-width=".6"/>`;
  if (reduce) { g.innerHTML = flow.kind === 'sorter' ? [0.2, 0.45, 0.7].map(f => box(flow.inX[0] + f * (flow.endX - flow.inX[0]), flow.y)).join('') : ''; return () => {}; }
  let raf, t0 = performance.now(), last = 0; const list = [];
  const step = now => {
    const dt = Math.min(50, now - (last || now)); last = now; const v = dt * .16;
    if (now - t0 > 520) {
      t0 = now;
      if (flow.kind === 'sorter') { const lane = Math.floor(Math.random() * flow.inX.length); list.push({ x: flow.inX[lane], y: flow.inTop, ph: 'in', out: Math.random() < .12 ? -1 : Math.floor(Math.random() * flow.outX.length) }); }
      else list.push({ seg: 0, t: 0 });
    }
    for (const p of list) {
      if (flow.kind === 'sorter') {
        if (p.ph === 'in') { p.y -= v; if (p.y <= flow.y) { p.y = flow.y; p.ph = 'spine'; } }
        else if (p.ph === 'spine') { p.x += v; if (p.out >= 0 && p.x >= flow.outX[p.out]) p.ph = 'div'; if (p.x >= flow.endX) p.ph = 'end'; }
        else if (p.ph === 'div') { p.x += v * .55; p.y -= v; if (p.y < 70) p.done = true; }
        else { p.y += v; if (p.y > 300) p.done = true; }
      } else {
        const a = flow.pts[p.seg], b = flow.pts[p.seg + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        p.t += v / len; if (p.t >= 1) { p.seg++; p.t = 0; if (p.seg >= flow.pts.length - 1) p.done = true; }
        const A = flow.pts[p.seg] || b, B = flow.pts[p.seg + 1] || b; p.x = A[0] + (B[0] - A[0]) * p.t; p.y = A[1] + (B[1] - A[1]) * p.t;
      }
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].done) list.splice(i, 1);
    g.innerHTML = list.map(p => box(p.x, p.y)).join('');
    if (beam && flow.scanX) beam.setAttribute('opacity', list.some(p => p.ph === 'spine' && Math.abs(p.x - flow.scanX) < 10) ? '1' : '0');
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// What the customer reads at each stage. `d` = planned dates, `noun` = sorter / conveyor / …
export function moment(stage, { noun = 'system', first = '', d = {} } = {}) {
  const f = x => { if (!x) return ''; const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${+x.slice(8, 10)} ${m[+x.slice(5, 7) - 1]} ${x.slice(0, 4)}`; };
  const thanks = first ? `Thank you, ${first}.` : 'Thank you.';
  return [
    ['We have your enquiry', `${thanks} We are working through your requirements.`],
    [`Your ${noun} is taking shape`, 'We are working on the concept and the data behind it.'],
    ['Your proposal is ready', 'It is in your documents below.'],
    [`Order confirmed. ${thanks}`, d.handover ? `Your programme has started. Go-live is planned for ${f(d.handover)}.` : 'Your programme has started. Key dates are below as we confirm them.'],
    [`Your ${noun} is being engineered`, 'Drawings are being prepared. You approve them before anything is made.'],
    ['Parts are arriving at our workshop', d.materials ? `Everything is due in by ${f(d.materials)}.` : 'Long-lead items were ordered first.'],
    [`Your ${noun} is being built`, 'It is being assembled and bench tested in our workshop.'],
    [`Congratulations: your ${noun} is being tested`, 'It is running in our workshop. Every part is being proved before it leaves us.'],
    [`Your ${noun} is on its way`, d.delivery ? `Delivery is planned for ${f(d.delivery)}.` : 'Tested and packed for delivery.'],
    ['We are installing on your site', 'Installation and commissioning are under way.'],
    ["You're live. Congratulations.", 'Signed off and handed over. Your warranty has started.'],
    ['Running', 'We are here if you need us. Report anything from this page or reply to any of our emails.'],
  ][Math.max(0, Math.min(11, stage))];
}
