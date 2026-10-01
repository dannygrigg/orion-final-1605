// Orion Live — Overview (staff home screen): widgets over every live job.
// Layout (which widgets, size, order) and filters are saved per device.
import { STAGES, MILESTONES, EVENT_TYPES, ROLES, derive, customerLine, ownerNow } from './js/spine.js';

export function overview(root, DATA) {
const $ = s => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TODAY = DATA.today;
const dayN = d => Math.round(Date.parse(d + 'T12:00:00Z') / 864e5);
const daysFrom = (a, b = TODAY) => dayN(b) - dayN(a);
const short = d => { const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${+d.slice(8,10)} ${m[+d.slice(5,7)-1]}`; };
const k = v => v >= 1e6 ? '£' + (v / 1e6).toFixed(2) + 'm' : '£' + Math.round(v / 1000) + 'k';
root.innerHTML = `<div class="ov">
  <div class="obar" role="toolbar" aria-label="Filters">
    <span class="today" id="today"></span>
    <div class="seg" role="group" aria-label="Phase" id="phase"></div>
    <select id="owner" aria-label="Owner"></select>
    <input id="q" type="search" placeholder="Find job, customer, ref" aria-label="Find">
    <span class="spacer"></span>
    <button class="btn" id="custom" aria-expanded="false" type="button">Customise</button>
  </div>
  <div id="panel" class="panel" hidden></div>
  <div id="ogrid" class="ogrid"></div>
  <div id="drawerHost"></div></div>`;
const PHASES = [
  { id: 'sales', name: 'Winning', color: 'var(--ph-sales)', stages: [0, 1, 2] },
  { id: 'delivery', name: 'Delivering', color: 'var(--ph-delivery)', stages: [3, 4, 5, 6, 7] },
  { id: 'site', name: 'On site', color: 'var(--ph-site)', stages: [8, 9, 10] },
  { id: 'after', name: 'Aftercare', color: 'var(--ph-after)', stages: [11] },
];
const COLS = [
  { name: 'Enquiry + concept', stages: [0, 1] }, { name: 'Proposal', stages: [2] }, { name: 'Order + design', stages: [3, 4] },
  { name: 'Procure + build', stages: [5, 6, 7] }, { name: 'Delivery + site', stages: [8, 9, 10] }, { name: 'Aftercare', stages: [11] },
];
const phaseOf = st => PHASES.find(p => p.stages.includes(st)) || PHASES[0];

// ── build each job's record with the real engine ──
const jobs = DATA.projects.map((p, i) => {
  const events = p.events;
  const r = derive(events);
  const quotes = events.filter(e => e.type === 'quote_issued');
  const lastQuote = quotes[quotes.length - 1];
  const notes = events.filter(e => e.type === 'note').map(e => ({ date: e.date, text: e.data.text }));
  const last = r.log.length ? r.log[r.log.length - 1].date : null;
  return { id: i, pid: p.id, p, r, events, last, quiet: last ? daysFrom(last) : null, expiry: lastQuote?.data.valid_until || null, notes, owner: ownerNow(p, r.stage) };
});

// ── what needs attention, with a reason and a severity ──
function reasons(j) {
  const out = [];
  if (j.expiry && j.r.stage === 2) {
    const d = daysFrom(TODAY, j.expiry);
    if (d < 0) out.push({ sev: 'warn', text: `Quote expired ${short(j.expiry)}`, sort: d });
    else if (d <= 14) out.push({ sev: d <= 5 ? 'warn' : 'amber', text: `Quote expires ${short(j.expiry)} (${d} day${d === 1 ? '' : 's'})`, sort: d });
  }
  j.r.waiting.forEach(w => {
    const age = daysFrom(w.from);
    if (w.key === 'decision') { if (age >= 14) out.push({ sev: age >= 42 ? 'warn' : 'amber', text: `Quote out ${age} days, no decision`, sort: 40 - age }); return; }
    if (w.due && w.due < TODAY) out.push({ sev: 'warn', text: `Overdue from customer: ${w.text}`, sort: -50 });
    else if (age >= 14) out.push({ sev: 'amber', text: `Waiting ${age} days: ${w.text}`, sort: 30 - age });
  });
  if (j.quiet != null && j.quiet >= 21 && !out.some(o => o.text.startsWith('Quote out'))) out.push({ sev: j.quiet >= 45 ? 'warn' : 'amber', text: `No activity for ${j.quiet} days`, sort: 60 - j.quiet });
  return out;
}
const gaps = j => [!j.p.contact_email && 'customer email', !j.p.site && 'site', !j.owner || j.owner.fromLead ? 'stage owner' : null].filter(Boolean);

// ── state: filters + layout (per viewer) ──
const DEFAULT_LAYOUT = [
  ['kpis', 12], ['attention', 6], ['calendar', 6], ['board', 12], ['momentum', 8], ['value', 4],
  ['activity', 4], ['waiting', 4], ['owners', 4], ['gaps', 12],
];
const WIDGET_NAMES = { kpis: 'Headline numbers', attention: 'Needs attention', calendar: 'Next 8 weeks', board: 'Job board',
  momentum: 'Momentum (12 weeks)', value: 'Pipeline value by stage', activity: 'Latest activity', waiting: 'Waiting on customers',
  owners: 'Who owns what', gaps: 'Missing information' };
let state = { phase: 'all', owner: '', q: '', layout: DEFAULT_LAYOUT.map(([id, s]) => ({ id, size: s, on: true })) };
try { const s = JSON.parse(localStorage.getItem('ol-overview') || 'null'); if (s?.layout?.length) state = { ...state, ...s, layout: s.layout.filter(w => WIDGET_NAMES[w.id]) }; } catch (_) {}
const save = () => { try { localStorage.setItem('ol-overview', JSON.stringify(state)); } catch (_) {} };

const visible = () => jobs.filter(j =>
  (state.phase === 'all' || phaseOf(j.r.stage).id === state.phase) &&
  (!state.owner || j.owner.name === state.owner) &&
  (!state.q || `${j.p.ref} ${j.p.name} ${j.p.customer} ${j.p.site || ''}`.toLowerCase().includes(state.q.toLowerCase())));

// ── widgets ──
const W = {
  kpis(js) {
    const winning = js.filter(j => j.r.stage <= 2), delivering = js.filter(j => j.r.stage >= 3 && j.r.stage <= 10);
    const pipe = winning.reduce((a, j) => a + (j.r.value || 0), 0);
    const expiring = js.filter(j => j.r.stage === 2 && j.expiry && daysFrom(TODAY, j.expiry) <= 14).length;
    const waiting = js.reduce((a, j) => a + j.r.waiting.length, 0);
    const attention = js.filter(j => reasons(j).length).length;
    const unpriced = winning.filter(j => !j.r.value).length;
    const needsYou = js.reduce((a, j) => a + (j.p.held || 0) + (j.p.alerts || 0), 0) + (DATA.unfiled || 0);
    return `<div class="kpis">
      <div class="kpi"><div class="label">Live jobs</div><div class="v">${js.length}</div><div class="s">${winning.length} winning · ${delivering.length} delivering</div></div>
      <div class="kpi"><div class="label">Quoted pipeline</div><div class="v mono">${k(pipe)}</div><div class="s">latest quote, ${unpriced} job${unpriced === 1 ? '' : 's'} not priced yet</div></div>
      <div class="kpi ${expiring ? 'alert' : ''}"><div class="label">Quotes expiring</div><div class="v">${expiring}</div><div class="s">within 14 days</div></div>
      <div class="kpi ${attention ? 'amber' : ''}"><div class="label">Need attention</div><div class="v">${attention}</div><div class="s">jobs with a flag</div></div>
      <div class="kpi"><div class="label">Waiting on customers</div><div class="v">${waiting}</div><div class="s">open items</div></div>
      <div class="kpi ${needsYou ? 'amber' : ''}"><div class="label">Needs you</div><div class="v">${needsYou}</div><div class="s">emails to approve, alerts, mail to file</div></div>
    </div>`;
  },
  attention(js) {
    const items = js.map(j => { const rs = reasons(j).sort((a, b) => a.sort - b.sort); return { j, rs, sev: rs.some(r => r.sev === 'warn') ? 'warn' : 'amber', sort: rs[0]?.sort }; })
      .filter(x => x.rs.length).sort((a, b) => (a.sev === b.sev ? a.sort - b.sort : a.sev === 'warn' ? -1 : 1));
    return `<div class="wh"><h2>Needs attention</h2><small>${items.length} job${items.length === 1 ? '' : 's'}, most urgent first</small></div>
      ${items.length ? `<ul class="olist">${items.map(x => `<li><span class="dot ${x.sev}"></span><div><div class="t"><b>${esc(x.j.p.customer)}</b> · ${esc(x.rs[0].text)}</div><div class="sub">${x.rs.slice(1).map(r => esc(r.text) + ' · ').join('')}${esc(x.j.p.ref)} · ${esc(STAGES[x.j.r.stage])} · ${esc(x.j.owner.name)}</div></div><button class="linkish" data-job="${x.j.id}">Open</button></li>`).join('')}</ul>` : '<p class="empty">Nothing flagged. Quotes, waiting items and quiet jobs show here when they need you.</p>'}`;
  },
  calendar(js) {
    const weeks = 8, W0 = 120, Wd = 560, start = dayN(TODAY) - ((new Date(TODAY + 'T12:00:00Z').getUTCDay() + 6) % 7), span = weeks * 7;
    const X = d => W0 + (dayN(d) - start) / span * (Wd - W0 - 10);
    const marks = [];
    js.forEach(j => {
      if (j.expiry && j.r.stage === 2) marks.push({ j, d: j.expiry, kind: 'expiry', label: 'quote expires' });
      Object.entries(j.r.planned).forEach(([m, d]) => { if (!j.r.actual[m]) marks.push({ j, d, kind: 'mile', label: MILESTONES.find(x => x[0] === m)?.[1] }); });
      j.r.waiting.forEach(w => w.due && marks.push({ j, d: w.due, kind: 'due', label: 'customer due' }));
    });
    const inRange = marks.filter(m => dayN(m.d) >= start - 7 && dayN(m.d) <= start + span);
    const rows = [...new Set(inRange.map(m => m.j))];
    const H = 50 + Math.max(rows.length, 1) * 34;
    const tick = [...Array(weeks + 1)].map((_, i) => start + i * 7);
    const dstr = n => new Date(n * 864e5).toISOString().slice(0, 10);
    const color = kind => kind === 'expiry' ? 'var(--warn)' : kind === 'due' ? 'var(--accent)' : 'var(--steel)';
    const svg = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Dates in the next 8 weeks">
      ${tick.map(t => `<line x1="${X(dstr(t))}" x2="${X(dstr(t))}" y1="22" y2="${H - 6}" stroke="var(--line)" stroke-width="1"/><text x="${X(dstr(t))}" y="14" font-size="11" text-anchor="middle" fill="var(--muted)" font-family="var(--f-mono)">${short(dstr(t))}</text>`).join('')}
      <line x1="${X(TODAY)}" x2="${X(TODAY)}" y1="18" y2="${H - 6}" stroke="var(--accent)" stroke-width="2"/>
      <text x="${X(TODAY) + 4}" y="${H - 8}" font-size="11" fill="var(--amber)" font-family="var(--f-display)" font-weight="600">TODAY</text>
      ${rows.map((j, i) => { const y = 44 + i * 34; return `<text x="0" y="${y + 4}" font-size="12.5" fill="var(--ink)" font-family="var(--f-body)" font-weight="600">${esc(j.p.customer.slice(0, 20))}</text>
        <line x1="${W0}" x2="${Wd - 10}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="2 4"/>
        ${inRange.filter(m => m.j === j).map(m => `<g><path d="M${X(m.d)} ${y - 7} l7 7 l-7 7 l-7 -7z" fill="${color(m.kind)}"/><text x="${X(m.d) + 10}" y="${y + 4}" font-size="11.5" fill="var(--muted)" font-family="var(--f-body)">${esc(m.label)} ${short(m.d)}</text></g>`).join('')}`; }).join('')}
      ${rows.length ? '' : `<text x="${W0}" y="44" font-size="13" fill="var(--muted)">No dates in the next 8 weeks. Planned milestones appear here once orders are placed.</text>`}
    </svg>`;
    return `<div class="wh"><h2>Next 8 weeks</h2><small><span style="color:var(--warn)">◆</span> quote expiry · <span style="color:var(--steel)">◆</span> milestone · <span style="color:var(--amber)">◆</span> customer due</small></div><div class="cal">${svg}</div>`;
  },
  board(js) {
    return `<div class="wh"><h2>Job board</h2><small>by stage · red edge = urgent flag, amber = watch</small></div>
    <div class="board">${COLS.map(c => { const list = js.filter(j => c.stages.includes(j.r.stage)); const col = phaseOf(c.stages[0]).color;
      return `<div class="col"><h3 style="border-top-color:${col}">${c.name} <span class="mono">${list.length}${list.some(j => j.r.value) ? ' · ' + k(list.reduce((a, j) => a + (j.r.value || 0), 0)) : ''}</span></h3>
      ${list.map(j => { const rs = reasons(j); const hot = rs.some(r => r.sev === 'warn'), warm = !hot && rs.length;
        return `<button class="ocard ${hot ? 'hot' : warm ? 'warm' : ''}" data-job="${j.id}"><span class="ref">${esc(j.p.ref)}</span><span class="nm">${esc(j.p.customer)}</span><span class="muted" style="font-size:13px">${esc(j.p.name)}</span>
          <span class="row"><span>${esc(STAGES[j.r.stage])}</span><span class="mono">${j.r.value ? k(j.r.value) : 'not priced'}</span></span>
          <span class="row"><span>${esc(j.owner.name)}</span><span>${j.quiet != null ? (j.quiet === 0 ? 'today' : j.quiet + 'd ago') : ''}</span></span>
          ${rs.length ? `<span class="flags">${rs.slice(0, 2).map(r => `<span class="pill ${r.sev}">${esc(r.text.length > 34 ? r.text.slice(0, 32) + '…' : r.text)}</span>`).join('')}</span>` : ''}</button>`; }).join('') || '<p class="empty" style="font-size:13px">None</p>'}</div>`; }).join('')}</div>`;
  },
  momentum(js) {
    const weeks = 12, end = dayN(TODAY), w = 300, h = 22;
    return `<div class="wh"><h2>Momentum</h2><small>events per week, last 12 weeks · last activity</small></div>
    ${js.slice().sort((a, b) => (a.quiet ?? 999) - (b.quiet ?? 999)).map(j => {
      const counts = [...Array(weeks)].map((_, i) => j.events.filter(e => { const d = end - dayN(e.date); return d >= (weeks - 1 - i) * 7 && d < (weeks - i) * 7; }).length);
      const max = Math.max(3, ...counts), bw = w / weeks;
      return `<div class="mo"><button class="linkish" style="text-align:left;color:var(--ink);text-decoration:none" data-job="${j.id}"><b>${esc(j.p.customer)}</b> <span class="muted mono" style="font-size:11.5px">${esc(j.p.ref)}</span></button>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Activity for ${esc(j.p.customer)}"><line x1="0" x2="${w}" y1="${h - 0.5}" y2="${h - 0.5}" stroke="var(--line)"/>${counts.map((c, i) => c ? `<rect x="${i * bw + 2}" y="${h - 1 - (c / max) * (h - 3)}" width="${bw - 4}" height="${(c / max) * (h - 3)}" fill="${phaseOf(j.r.stage).color}" rx="1"/>` : '').join('')}</svg>
        <span class="mono ${j.quiet >= 21 ? '' : 'muted'}" style="text-align:right;font-size:12.5px;${j.quiet >= 21 ? 'color:var(--warn)' : ''}">${j.quiet != null ? j.quiet + 'd' : '–'}</span></div>`; }).join('')}`;
  },
  value(js) {
    const by = STAGES.map((s, i) => ({ s, v: js.filter(j => j.r.stage === i).reduce((a, j) => a + (j.r.value || 0), 0), n: js.filter(j => j.r.stage === i).length })).filter(x => x.n);
    const max = Math.max(1, ...by.map(x => x.v));
    return `<div class="wh"><h2>Pipeline value</h2><small>latest quote per job</small></div>
    <div class="bars">${by.map(x => `<div class="barrow"><span>${esc(x.s)} <span class="muted">(${x.n})</span></span><span class="track"><i style="width:${x.v / max * 100}%;background:${phaseOf(STAGES.indexOf(x.s)).color}"></i></span><span class="mono" style="text-align:right">${x.v ? k(x.v) : 'not priced'}</span></div>`).join('')}</div>`;
  },
  activity(js) {
    const ev = js.flatMap(j => j.events.map(e => ({ j, e }))).sort((a, b) => b.e.date.localeCompare(a.e.date)).slice(0, 10);
    return `<div class="wh"><h2>Latest activity</h2><small>all jobs</small></div>
    <ul class="olist">${ev.map(({ j, e }) => `<li><span class="dot ${e.type === 'note' ? '' : 'info'}"></span><div><div class="t">${esc(EVENT_TYPES[e.type]?.label || e.type)} · <b>${esc(j.p.customer)}</b></div><div class="sub">${esc(e.type === 'note' ? e.data.text.slice(0, 90) + (e.data.text.length > 90 ? '…' : '') : customerLine(e))}</div></div><span class="mono muted" style="font-size:12px">${short(e.date)}</span></li>`).join('')}</ul>`;
  },
  waiting(js) {
    const items = js.flatMap(j => j.r.waiting.map(w => ({ j, w, age: daysFrom(w.from) }))).sort((a, b) => b.age - a.age);
    return `<div class="wh"><h2>Waiting on customers</h2><small>${items.length} open</small></div>
    ${items.length ? `<ul class="olist">${items.map(({ j, w, age }) => `<li><span class="dot ${w.due && w.due < TODAY ? 'warn' : age >= 14 ? 'amber' : ''}"></span><div><div class="t"><b>${esc(j.p.customer)}</b> · ${esc(w.text)}</div><div class="sub">${age} day${age === 1 ? '' : 's'} so far${w.due ? ' · due ' + short(w.due) : ''}</div></div><button class="linkish" data-job="${j.id}">Open</button></li>`).join('')}</ul>` : '<p class="empty">Nothing outstanding.</p>'}`;
  },
  owners(js) {
    const people = {};
    js.forEach(j => { const n = j.owner.name || 'Unassigned'; (people[n] ||= []).push(j); });
    return `<div class="wh"><h2>Who owns what</h2><small>owner of each job's current stage</small></div>
    <ul class="olist">${Object.entries(people).sort((a, b) => b[1].length - a[1].length).map(([n, list]) => `<li><span class="dot info"></span><div><div class="t"><b>${esc(n)}</b> · ${list.length} job${list.length === 1 ? '' : 's'}</div><div class="sub">${list.map(j => esc(j.p.customer)).join(', ')}</div></div><span></span></li>`).join('')}</ul>
    <p class="empty" style="margin-top:8px;font-size:13px">${js.filter(j => j.owner.fromLead).length} of ${js.length} jobs fall back to the lead because the stage has no owner.</p>`;
  },
  gaps(js) {
    const rows = js.map(j => ({ j, g: gaps(j) })).filter(x => x.g.length);
    return `<div class="wh"><h2>Missing information</h2><small>fill these in as you go; each gap stops something working</small></div>
    ${rows.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${rows.map(({ j, g }) => `<button class="ocard" style="width:auto;flex:1 1 220px" data-job="${j.id}"><span class="ref">${esc(j.p.ref)}</span><span class="nm">${esc(j.p.customer)}</span><span class="flags">${g.map(x => `<span class="pill">${x}</span>`).join('')}</span></button>`).join('')}</div>
    <p class="empty" style="margin-top:8px;font-size:13px">No customer email: no emails, no capture by address. No stage owner: alerts go to the lead.</p>` : '<p class="empty">Every job has its key details.</p>'}`;
  },
};

// ── render ──
function render() {
  $('#today').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#phase').innerHTML = [['all', 'All'], ...PHASES.map(p => [p.id, p.name])].map(([id, n]) => `<button data-phase="${id}" aria-pressed="${state.phase === id}">${n}</button>`).join('');
  const names = [...new Set(jobs.map(j => j.owner.name).filter(Boolean))];
  $('#owner').innerHTML = `<option value="">Everyone</option>${names.map(n => `<option ${state.owner === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}`;
  const js = visible();
  $('#ogrid').innerHTML = state.layout.filter(w => w.on).map(w => `<section class="w s${w.size}" aria-label="${esc(WIDGET_NAMES[w.id])}">${W[w.id](js)}</section>`).join('')
    || '<p class="empty">All widgets are hidden. Use Customise to show some.</p>';
  if (!$('#panel').hidden) renderPanel();
  save();
}
function renderPanel() {
  $('#panel').innerHTML = `<div class="wh"><h2>Customise this page</h2><small>saved on this device</small></div><div class="tbl"><table><tbody>
    ${state.layout.map((w, i) => `<tr><td><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-on="${i}" ${w.on ? 'checked' : ''}> ${esc(WIDGET_NAMES[w.id])}</label></td>
      <td><div class="seg">${[[3, 'S'], [4, 'M'], [6, 'Half'], [8, 'L'], [12, 'Full']].map(([s, l]) => `<button data-size="${i}:${s}" aria-pressed="${w.size === s}">${l}</button>`).join('')}</div></td>
      <td style="white-space:nowrap"><button class="btn small" data-move="${i}:-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button> <button class="btn small" data-move="${i}:1" ${i < state.layout.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button></td></tr>`).join('')}
  </tbody></table></div><p style="margin:10px 0 0"><button class="btn" id="reset">Reset layout</button></p>`;
}
function drawer(j) {
  const r = j.r;
  $('#drawerHost').innerHTML = `<div class="scrim" id="scrim"></div><aside class="drawer" role="dialog" aria-label="${esc(j.p.customer)}">
    <div class="hd"><div><div class="label">${esc(j.p.ref)}</div><h2>${esc(j.p.customer)}</h2><div class="muted">${esc(j.p.name)}${j.p.site ? ' · ' + esc(j.p.site) : ''}</div></div><button class="btn" id="close">Close</button></div>
    <div><div class="ostages">${STAGES.map((s, i) => `<i class="${i < r.stage ? 'done' : i === r.stage ? 'cur' : ''}" title="${s}"></i>`).join('')}</div><div style="margin-top:6px"><b>${esc(STAGES[r.stage])}</b> <span class="muted">· stage ${r.stage + 1} of 12</span></div></div>
    ${reasons(j).length ? `<div class="box" style="background:var(--accent-soft)">${reasons(j).map(x => `<div>${esc(x.text)}</div>`).join('')}</div>` : ''}
    <dl class="kv">
      <dt>Value</dt><dd class="mono">${r.value ? '£' + r.value.toLocaleString('en-GB') : 'not priced'}</dd>
      <dt>Owner now</dt><dd>${esc(j.owner.name)} <span class="muted">(${esc(ROLES.find(x => x[0] === j.owner.role)?.[1])}${j.owner.fromLead ? ', lead' : ''})</span></dd>
      <dt>Customer</dt><dd>${esc(j.p.contact_name || '–')}${j.p.contact_email ? '<br><span class="mono" style="font-size:13px">' + esc(j.p.contact_email) + '</span>' : ' <span class="pill">no email</span>'}</dd>
      <dt>Next</dt><dd>${r.next ? esc(r.next.n) + ', ' + short(r.next.date) : j.expiry ? 'Quote valid to ' + short(j.expiry) : '–'}</dd>
      <dt>Last activity</dt><dd>${j.last ? short(j.last) + ` (${j.quiet} days ago)` : '–'}</dd>
    </dl>
    ${r.waiting.length ? `<div><div class="label" style="margin-bottom:4px">Waiting on customer</div>${r.waiting.map(w => `<div class="box" style="margin-bottom:4px">${esc(w.text)}</div>`).join('')}</div>` : ''}
    ${j.notes.length ? `<div><div class="label" style="margin-bottom:4px">Internal notes</div>${j.notes.slice().reverse().map(n => `<div class="box" style="margin-bottom:6px"><span class="mono muted" style="font-size:12px">${short(n.date)}</span><br>${esc(n.text)}</div>`).join('')}</div>` : ''}
    <div><div class="label" style="margin-bottom:4px">Documents</div>${r.docs.slice().reverse().map(d => `<div style="font-size:14px;${d.superseded ? 'opacity:.55;text-decoration:line-through' : ''}"><span class="mono">${esc(d.ref)}</span> Rev ${esc(d.rev)} · ${esc(d.title)}</div>`).join('') || '<p class="empty">None</p>'}</div>
    <div class="acts"><a class="btn primary" href="#/p/${j.pid}" data-close>Log event</a><a class="btn" href="#/p/${j.pid}" data-close>Open job</a><a class="btn" href="/live-6c93deb1/cust#${j.pid}" target="_blank" rel="noopener">Preview customer page</a></div>
  </aside>`;
  const close = () => { $('#drawerHost').innerHTML = ''; };
  $('#close').addEventListener('click', close); $('#scrim').addEventListener('click', close);
  document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
  $('#close').focus();
}

root.addEventListener('click', e => {
  const t = e.target.closest('[data-job],[data-phase],[data-size],[data-move],#custom,#reset,[data-close]');
  if (!t) return;
  if (t.hasAttribute('data-close')) { $('#drawerHost').innerHTML = ''; return; }
  if (t.dataset.job != null) return drawer(jobs[+t.dataset.job]);
  if (t.dataset.phase) { state.phase = t.dataset.phase; return render(); }
  if (t.dataset.size) { const [i, s] = t.dataset.size.split(':').map(Number); state.layout[i].size = s; return render(); }
  if (t.dataset.move) { const [i, d] = t.dataset.move.split(':').map(Number); const L = state.layout; [L[i], L[i + d]] = [L[i + d], L[i]]; return render(); }
  if (t.id === 'custom') { const p = $('#panel'); p.hidden = !p.hidden; t.setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) renderPanel(); return; }
  if (t.id === 'reset') { state.layout = DEFAULT_LAYOUT.map(([id, s]) => ({ id, size: s, on: true })); return render(); }
});
root.addEventListener('change', e => {
  if (e.target.dataset.on != null) { state.layout[+e.target.dataset.on].on = e.target.checked; render(); }
  if (e.target.id === 'owner') { state.owner = e.target.value; render(); }
});
$('#q').addEventListener('input', e => { state.q = e.target.value; render(); });
$('#q').value = state.q;
render();
}
