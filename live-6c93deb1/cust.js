// Customer project page: /track-180021fb/<project code>. PIN once per device, then the live view.
// Staff preview: /live-6c93deb1/cust#<project id> (uses the staff sign-in instead of the PIN).
import { STAGES, fmtDate } from '/track-180021fb/a/spine.js';
import { drawSystem, animate, sectionsOf, stateAt, percentAt, moment, LABEL, PCT, SECT_COLOR, SYSTEM_TYPES } from '/track-180021fb/a/system.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PREVIEW = location.pathname.startsWith('/live-6c93deb1/');
const token = location.pathname.split('/').filter(Boolean)[1] || '';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const short = d => fmtDate(d).split(' ').slice(0, 2).join(' ');
// events that move a job on: shown in bold in the updates
const BIG = new Set(['enquiry_received', 'quote_issued', 'order_received', 'drawing_approved', 'build_complete', 'test_passed', 'delivered', 'sat_signed', 'handover_signed']);
let stopAnim = () => {};

async function load() {
  const r = await fetch(PREVIEW ? `/live-6c93deb1/api/projects/${location.hash.slice(1)}/customer` : '/track-180021fb/api/' + token);
  if (r.status === 401) return PREVIEW ? location.reload() : pin();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { $('#app').innerHTML = `<div class="card" style="margin-top:40px"><p>${esc(j.error || 'This page is not available.')}</p></div>`; return; }
  show(j);
}

function pin(err) {
  $('#app').innerHTML = `<form class="card pinbox" id="pf"><div class="logo">ORION <span>MIS</span></div><h3 style="margin-top:12px">Your project page</h3>
    <label for="pin" style="font-size:14px;color:var(--muted)">Enter the PIN Orion MIS sent you</label>
    <input id="pin" type="password" inputmode="numeric" autocomplete="one-time-code" required>
    <button class="btn" style="width:100%;padding:9px">Open</button>${err ? `<div class="err">${esc(err)}</div>` : ''}</form>`;
  $('#pf').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await fetch('/track-180021fb/api/' + token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: $('#pin').value }) });
    if (r.ok) load(); else pin((await r.json().catch(() => ({}))).error || 'That did not work');
  });
}

function show(v) {
  document.title = `${v.name} · Orion MIS`;
  const stage = Math.max(0, v.stage), sys = v.system || { type: 'generic' };
  const noun = SYSTEM_TYPES[sys.type]?.noun || 'system';
  const drawing = drawSystem(sys, stage);
  const [head, sub] = moment(stage, { noun, first: v.first, d: v.planned || {} });
  const openSnags = (v.snags || []).filter(s => !s.closed);
  const state = openSnags.length ? 'r' : v.waiting.length ? 'a' : 'g';
  const n = v.waiting.length;
  const words = { g: ['On track', 'Everything is moving to plan.'], a: ['Waiting on you', `${n} item${n > 1 ? 's' : ''} below keep${n > 1 ? '' : 's'} your dates on track.`], r: ['We are fixing something', 'A snag is open. We will update you here when it is closed.'] }[state];
  const live = v.actual?.handover, goLive = v.planned?.handover;
  const count = live ? `<div class="label" style="color:var(--cr-muted)">Live since</div><div class="n" style="font-size:30px">${fmtDate(live)}</div><div class="u">${v.warranty ? 'warranty to ' + fmtDate(v.warranty.to) : ''}</div>`
    : goLive ? `<div class="label" style="color:var(--cr-muted)">Go-live</div><div class="n">${Math.max(0, days(TODAY, goLive))}</div><div class="u">days to go · ${fmtDate(goLive)}</div>`
    : v.next ? `<div class="label" style="color:var(--cr-muted)">Next</div><div class="n" style="font-size:26px">${short(v.next.date)}</div><div class="u">${esc(v.next.n)}</div>`
    : `<div class="label" style="color:var(--cr-muted)">Dates</div><div class="n" style="font-size:24px">At order</div><div class="u">your programme is set when you place the order</div>`;
  const secs = sectionsOf(sys);
  const pct = percentAt(stage, sys);

  $('#app').innerHTML = `
  ${PREVIEW ? `<div class="preview">Preview: this is exactly what ${esc(v.customer)} sees on their project page.</div>` : ''}
  <header class="site"><div class="logo">ORION <span>MIS</span></div><div class="who">Your project page · ${esc(v.customer)}</div></header>
  <div class="title"><div class="label">${esc(v.ref)}${v.site ? ' · ' + esc(v.site) : ''}</div><h1>${esc(v.name)}</h1></div>
  <section class="cr" aria-label="Your ${noun} now">
    <div class="cr-main">
      <div class="moment"><div class="eyebrow">Stage ${stage + 1} of 12 · ${STAGES[stage]}</div><h2>${esc(head)}</h2><p>${esc(sub)}</p></div>
      <div class="render">${drawing.svg}</div>
      <div class="legend">${drawing.legend.map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('')}</div>
    </div>
    <aside class="side">
      <div class="andon"><div class="stack" aria-hidden="true"><div class="lamp r ${state === 'r' ? 'on' : ''}"></div><div class="lamp a ${state === 'a' ? 'on blink' : ''}"></div><div class="lamp g ${state === 'g' ? 'on' : ''}"></div><div class="pole"></div><div class="base"></div></div>
        <div><div class="label" style="color:var(--cr-muted)">Job status</div><div class="st">${words[0]}</div><div class="ss">${words[1]}</div></div></div>
      <div class="count">${count}</div>
      <div><div class="label" style="color:var(--cr-muted)">Progress</div>
        <div class="seg">${STAGES.map((s, i) => `<i class="${i < stage ? 'done' : i === stage ? 'cur' : ''}" title="${s}"></i>`).join('')}</div>
        <div class="pct"><span>${STAGES[stage]}</span><span><b>${pct}%</b> complete</span></div></div>
    </aside>
  </section>
  <div class="cols">
    <div class="stackc">
      ${n ? `<div class="card you"><h3>We're waiting on you</h3><ul class="plain">${v.waiting.map(w => `<li><span>${esc(w.text)}</span><span class="mono" style="font-size:13px">${w.due ? (w.due < TODAY ? 'overdue · ' : 'by ') + short(w.due) : ''}</span></li>`).join('')}</ul>
        <p style="margin:8px 0 0;font-size:14px;color:var(--muted)">Reply to any of our emails, or contact ${esc(v.contact || 'us')}, and we will mark it done.</p></div>` : ''}
      ${openSnags.length ? `<div class="card"><h3>Open snags</h3><ul class="plain docs">${openSnags.map(s => `<li><span>${esc(s.text)}</span><span class="mono" style="font-size:13px;color:var(--muted)">${short(s.raised)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="card"><h3>Your ${noun}, section by section</h3><ul class="plain sect">${secs.map((s, i) => { const st = stateAt(stage, s, i, secs.length);
        return `<li><span>${esc(s.name)}</span><span class="bar"><i style="width:${PCT[st]}%;background:${SECT_COLOR[st]}"></i></span><span class="st">${LABEL[st]}</span></li>`; }).join('')}</ul></div>
      <div class="card"><h3>Updates</h3>${v.timeline.length ? `<ul class="plain tl">${v.timeline.slice(0, 20).map(t => `<li class="${BIG.has(t.type) ? 'big' : ''}"><span class="d">${short(t.date)}</span><span class="t">${esc(t.text)}</span></li>`).join('')}</ul>` : '<p style="color:var(--muted);margin:0">Updates appear here as your job moves on.</p>'}</div>
    </div>
    <div class="stackc">
      <div class="card"><h3>From the workshop and site</h3><div class="photos"><div style="grid-column:1/-1;aspect-ratio:auto;padding:18px">Photos from our workshop and your site appear here once your ${noun} is in build.</div></div></div>
      <div class="card"><h3>Your team at Orion</h3><ul class="plain team">${(v.team || []).map(t => `<li class="${t.now ? 'now' : ''}"><span class="av">${esc(t.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</span><span><b>${esc(t.name)}</b><br><span style="font-size:13.5px;color:var(--muted)">${esc(t.roles.join(', '))}${t.now ? ' · looking after you now' : ''}</span></span></li>`).join('') || '<li>Orion MIS</li>'}</ul></div>
      <div class="card"><h3>Documents</h3>${v.docs.length ? `<ul class="plain docs">${v.docs.slice().reverse().map(d => `<li class="${d.superseded ? 'old' : ''}"><span>${esc(d.title)}${d.link && !d.superseded ? ` · <a href="${esc(d.link)}" target="_blank" rel="noopener">open</a>` : ''}</span><span class="mono" style="font-size:13px;color:var(--muted)">${esc(d.ref)} Rev ${esc(d.rev)}</span></li>`).join('')}</ul>` : '<p style="color:var(--muted);margin:0">Documents we issue appear here.</p>'}</div>
    </div>
  </div>
  <p class="foot">This page updates as your job moves on. Questions: reply to any of our emails, or contact ${esc(v.contact || 'your Orion contact')}.</p>`;
  stopAnim();
  stopAnim = animate($('.render svg'), drawing.flow);
}
load();
