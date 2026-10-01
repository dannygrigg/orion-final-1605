// Customer project page: /p/<token>. PIN once per device, then the live view.
import { STAGES, fmtDate } from '/track-180021fb/a/spine.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const token = location.pathname.split('/').filter(Boolean)[1] || '';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
// the milestone that completes each stage, shown as its date on the tracker
const STAGE_MILESTONE = { 4: 'design', 5: 'materials', 6: 'build', 7: 'test', 8: 'delivery', 9: 'sat', 10: 'handover' };

async function load() {
  const r = await fetch('/track-180021fb/api/' + token);
  if (r.status === 401) return pin();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { $('#main').innerHTML = `<div class="card"><p class="empty">${esc(j.error || 'This page is not available.')}</p></div>`; return; }
  show(j);
}

function pin(err) {
  $('#main').innerHTML = `<div class="card login" style="margin-top:10vh"><h3>Your project page</h3>
    <form id="pf" class="grid"><div class="field wide"><label for="pin">Enter the PIN Orion MIS sent you</label><input id="pin" type="password" inputmode="numeric" autocomplete="one-time-code" required></div>
    <div class="field wide"><button class="btn primary">Open</button></div>${err ? `<div class="field wide"><div class="msg err">${esc(err)}</div></div>` : ''}</form></div>`;
  $('#pf').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await fetch('/track-180021fb/api/' + token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: $('#pin').value }) });
    if (r.ok) load(); else pin((await r.json().catch(() => ({}))).error || 'That did not work');
  });
}

function show(v) {
  document.title = `${v.name} · Orion MIS`;
  const ms = Object.fromEntries(v.milestones.map(m => [m.k, m]));
  $('#main').innerHTML = `
  <div class="hero"><div class="label">Orion MIS · your project</div><h1>${esc(v.name)}</h1><p>${esc(v.ref)} · ${esc(v.customer)}${v.site ? ', ' + esc(v.site) : ''}</p></div>
  <div class="card"><div class="label">Now</div><h2 style="font-size:26px;margin:2px 0 4px">${v.stage >= 0 ? STAGES[v.stage] : 'Getting started'}</h2>
    <p style="margin:0" class="muted">${v.next ? `Next: <b style="color:var(--ink)">${esc(v.next.n)}</b>, ${fmtDate(v.next.date)}` : v.stage < 3 ? 'Dates are set when the order is placed.' : 'All planned milestones are complete.'}
    ${v.percent != null && v.stage === 6 ? ` · Build ${v.percent}% complete` : ''}</p></div>
  ${v.waiting.length ? `<div class="youbox"><h2>We're waiting on you</h2><ul class="list">${v.waiting.map(w => `<li><span>${esc(w.text)}</span><span>${w.due && w.due < today ? '<span class="pill warn">overdue</span> ' : ''}<span class="mono">${w.due ? 'by ' + fmtDate(w.due) : ''}</span></span></li>`).join('')}</ul>
    <p class="empty" style="margin-top:8px">Reply to any of our emails, or contact ${esc(v.lead || 'your Orion contact')}, and we will mark it done.</p></div>` : ''}
  <div class="card"><h3>Your job, stage by stage</h3>
    ${STAGES.map((s, i) => { const m = ms[STAGE_MILESTONE[i]]; const cls = i < v.stage ? 'done' : i === v.stage ? 'cur' : '';
      return `<div class="trk ${cls}"><span class="dot"></span><div class="nm">${s}</div><div class="dt">${m?.actual ? 'done ' + fmtDate(m.actual) : m?.planned ? 'planned ' + fmtDate(m.planned) : ''}</div></div>`; }).join('')}
  </div>
  ${v.timeline.length ? `<div class="card"><h3>Updates</h3><ul class="list">${v.timeline.slice(0, 15).map(t => `<li><span>${esc(t.text)}</span><span class="mono muted">${fmtDate(t.date)}</span></li>`).join('')}</ul></div>` : ''}
  ${v.docs.length ? `<div class="card"><h3>Documents</h3><ul class="list">${v.docs.slice().reverse().map(d => `<li class="${d.superseded ? 'sup' : ''}"><span>${esc(d.title)}${d.link && !d.superseded ? ` · <a href="${esc(d.link)}" target="_blank" rel="noopener">open</a>` : ''}</span><span class="mono">${esc(d.ref)} Rev ${esc(d.rev)}</span></li>`).join('')}</ul></div>` : ''}
  ${v.snags.length ? `<div class="card"><h3>Snags</h3><ul class="list">${v.snags.map(s => `<li><span>${esc(s.text)}</span><span class="pill ${s.closed ? 'good' : 'warn'}">${s.closed ? 'closed' : 'open'}</span></li>`).join('')}</ul></div>` : ''}
  ${v.warranty ? `<div class="card"><h3>Warranty</h3><p style="margin:0">${v.warranty.months} months, to <b>${fmtDate(v.warranty.to)}</b>.</p></div>` : ''}
  <p class="foot">Orion MIS · ${esc(v.lead || '')} · This page updates as your job progresses.</p>`;
}
load();
