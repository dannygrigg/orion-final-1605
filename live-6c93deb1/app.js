// Orion Live — staff app. Hash routes:
//   #/            register of all projects
//   #/p/<id>      one project: record, log an event, outbox, settings
//   #/outbox      everything waiting for a person, all projects
//   #/new         create a project
import { STAGES, MILESTONES, EVENT_TYPES, fmtDate, gbp } from './js/spine.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const userName = () => { try { return localStorage.getItem('ol_name') || ''; } catch { return ''; } };

async function api(path, opts = {}) {
  const r = await fetch('/live-6c93deb1/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Orion-User': userName() || 'staff', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { location.reload(); throw new Error('signin'); }
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

// ── shell ──
let outboxCount = 0;
function nav(active) {
  $('#nav').innerHTML = [['#/', 'Register', 'reg'], ['#/outbox', `Outbox${outboxCount ? `<span class="badge">${outboxCount}</span>` : ''}`, 'out'], ['#/new', 'New project', 'new']]
    .map(([h, l, k]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${l}</a>`).join('');
  $('#who').textContent = userName() ? `Signed in as ${userName()}` : '';
}
function stageStrip(stage) {
  return `<div class="stages">${STAGES.map((s, i) => `<div class="stg ${i < stage ? 'done' : i === stage ? 'cur' : ''}"><span class="n">${i + 1}</span>${s}</div>`).join('')}</div>`;
}
const stagePill = s => s < 0 ? '<span class="pill">no events</span>' : `<span class="pill ${s >= 10 ? 'good' : 'steel'}">${s + 1} · ${STAGES[s]}</span>`;

// ── register ──
async function register() {
  nav('reg');
  const { projects } = await api('/projects');
  const t = today();
  $('#main').innerHTML = `
  <div class="card"><h3>Live projects <small>${projects.length} · stage, dates and waiting items are worked out from each project's events</small></h3>
  ${projects.length ? `<div class="tbl"><table><thead><tr><th>Ref</th><th>Project</th><th>Customer</th><th>Stage</th><th>Next milestone</th><th>Waiting on customer</th><th>Needs you</th><th>Last event</th><th>Customer page</th></tr></thead><tbody>
  ${projects.map(p => `<tr class="link" data-id="${p.id}">
    <td class="mono">${esc(p.ref)}</td><td>${esc(p.name)}</td><td>${esc(p.customer)}</td><td>${stagePill(p.stage)}</td>
    <td>${p.next ? `${esc(p.next.n)}<br><span class="mono ${p.next.date < t ? '' : 'muted'}">${fmtDate(p.next.date)}</span> ${p.next.date < t ? '<span class="pill warn">late</span>' : ''}` : '<span class="muted">–</span>'}</td>
    <td>${p.waiting ? `${p.waiting}${p.overdue ? ` <span class="pill warn">${p.overdue} overdue</span>` : ''}` : '<span class="muted">0</span>'}</td>
    <td>${p.held ? `<span class="pill amber">${p.held} email${p.held > 1 ? 's' : ''}</span> ` : ''}${p.alerts ? `<span class="pill warn">${p.alerts} alert${p.alerts > 1 ? 's' : ''}</span>` : ''}${!p.held && !p.alerts ? '<span class="muted">–</span>' : ''}</td>
    <td class="mono">${p.last ? fmtDate(p.last) : '–'}</td><td>${p.page ? '<span class="pill good">on</span>' : '<span class="muted">off</span>'}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">No projects yet. <a href="#/new">Create the first one.</a></p>'}</div>`;
  document.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => { location.hash = '#/p/' + tr.dataset.id; }));
}

// ── project ──
let current = null;
async function project(id, flash) {
  nav('');
  current = await api('/projects/' + id);
  const { project: p, record: r, events, outbox, mail } = current;
  const t = today();
  const voided = new Set(events.filter(e => e.type === 'void').map(e => +e.data.event));
  const held = outbox.filter(o => ['held', 'failed', 'open'].includes(o.status));
  const done = outbox.filter(o => !['held', 'failed', 'open'].includes(o.status));
  const groups = {};
  Object.entries(EVENT_TYPES).forEach(([k, T]) => (groups[T.group] ||= []).push([k, T]));

  $('#main').innerHTML = `
  ${flash ? `<div class="msg ${flash.err ? 'err' : 'ok'}">${esc(flash.text)}</div>` : ''}
  <div class="card">
    <div class="head">
      <div><div class="label">Project</div><div class="v mono">${esc(p.ref)}</div></div>
      <div><div class="label">Name</div><div class="v">${esc(p.name)}</div></div>
      <div><div class="label">Customer</div><div class="v">${esc(p.customer)}${p.site ? `, ${esc(p.site)}` : ''}<br><span class="muted" style="font-weight:400">${esc(p.contact_name || 'no contact set')}${p.contact_email ? ' · ' + esc(p.contact_email) : ''}</span></div></div>
      <div><div class="label">Orion lead</div><div class="v">${esc(p.lead || '–')}</div></div>
      <div><div class="label">Value</div><div class="v mono">${r.value ? gbp(r.value) : '–'}</div></div>
    </div>
  </div>
  <div class="card">${stageStrip(r.stage)}</div>
  <div class="cols">
    <div class="stack">
      <div class="card"><h3>Log an event <small>the record, the customer page and any emails follow from it</small></h3>
        <form id="ef" class="grid">
          <div class="field"><label for="et">What happened</label><select id="et" required><option value="">Choose…</option>
            ${Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([k, T]) => `<option value="${k}">${esc(T.label)}</option>`).join('')}</optgroup>`).join('')}
          </select></div>
          <div class="field"><label for="ed">Date it happened</label><input id="ed" type="date" value="${t}" required></div>
          <div id="efields" class="field wide" style="display:contents"></div>
          <div class="field wide"><button class="btn primary" id="esave">Log event</button></div>
          <div class="field wide" id="emsg"></div>
        </form>
      </div>
      <div class="card"><h3>Programme</h3>
        <div class="tbl"><table><thead><tr><th>Milestone</th><th class="num">Planned</th><th class="num">Actual</th><th></th></tr></thead><tbody>
        ${MILESTONES.map(([k, n]) => { const pl = r.planned[k], ac = r.actual[k];
          return `<tr><td>${n}</td><td class="num">${pl ? fmtDate(pl) : '–'}</td><td class="num">${ac ? fmtDate(ac) : '–'}</td><td>${ac ? '<span class="pill good">done</span>' : pl && pl < t ? '<span class="pill warn">late</span>' : ''}</td></tr>`; }).join('')}
        </tbody></table></div>
        ${r.moves.length ? `<p class="empty" style="margin-top:8px">${r.moves.length} date change${r.moves.length > 1 ? 's' : ''}: ${r.moves.map(m => `${esc(MILESTONES.find(x => x[0] === m.milestone)?.[1])} ${fmtDate(m.from)} → ${fmtDate(m.to)}${m.reason ? ` (${esc(m.reason)})` : ''}`).join('; ')}</p>` : ''}
      </div>
      <div class="card"><h3>Waiting on customer <small>${r.waiting.length} open</small></h3>
        ${r.waiting.length ? `<ul class="list">${r.waiting.map(w => `<li><span>${esc(w.text)}</span><span>${w.due && w.due < t ? '<span class="pill warn">overdue</span> ' : ''}<span class="mono">${w.due ? 'due ' + fmtDate(w.due) : ''}</span></span></li>`).join('')}</ul>` : '<p class="empty">Nothing outstanding.</p>'}
      </div>
      <div class="card"><h3>Documents <small>${r.docs.filter(d => !d.superseded).length} current</small></h3>
        ${r.docs.length ? `<ul class="list">${r.docs.slice().reverse().map(d => `<li class="${d.superseded ? 'sup' : ''}"><span><span class="mono">${esc(d.ref)}</span> ${esc(d.title)}${d.link ? ` · <a href="${esc(d.link)}" target="_blank" rel="noopener">open</a>` : ''}</span><span class="mono">Rev ${esc(d.rev)} · ${fmtDate(d.date)}</span></li>`).join('')}</ul>` : '<p class="empty">None yet.</p>'}
      </div>
      ${r.signoffs.length || r.snags.length || r.faults.length || r.warranty ? `<div class="card"><h3>Sign-offs, snags, aftercare</h3><ul class="list">
        ${r.signoffs.map(s => `<li><span>${esc(s.what)} · ${esc(s.by)}</span><span class="mono">${fmtDate(s.date)}</span></li>`).join('')}
        ${r.snags.map(s => `<li><span>Snag: ${esc(s.text)}</span><span class="pill ${s.closed ? 'good' : 'warn'}">${s.closed ? 'closed ' + fmtDate(s.closed) : 'open'}</span></li>`).join('')}
        ${r.warranty ? `<li><span>Warranty ${r.warranty.months} months</span><span class="mono">to ${fmtDate(r.warranty.to)}</span></li>` : ''}
        ${r.faults.map(f => `<li><span>Fault: ${esc(f.text)}</span><span class="mono">${fmtDate(f.date)}</span></li>`).join('')}
      </ul></div>` : ''}
    </div>
    <div class="stack">
      <div class="card"><h3>Needs you <small>${held.length}</small></h3>
        ${!mail ? '<p class="empty" style="margin-bottom:8px">Email sending is not set up yet, so emails wait here. You can still read and correct them.</p>' : ''}
        ${held.length ? held.map(mailCard).join('') : '<p class="empty">Nothing waiting.</p>'}
        ${done.length ? `<details style="margin-top:10px"><summary>${done.length} sent, cancelled or done</summary><div class="stack" style="margin-top:8px">${done.map(mailCard).join('')}</div></details>` : ''}
      </div>
      <div class="card"><h3>Customer page</h3>
        ${p.page ? `<p style="margin:0 0 8px">On. Address: <a href="${p.track}" target="_blank" rel="noopener" class="mono">orionmis.co.uk${p.track}</a></p>` : '<p class="empty" style="margin-bottom:8px">Off. Set a PIN to switch it on, then send the customer the address and PIN.</p>'}
        <form id="pinf" class="grid"><div class="field"><label for="pin">${p.page ? 'New PIN' : 'PIN'} (4–8 digits)</label><input id="pin" type="text" inputmode="numeric" pattern="\\d{4,8}" required></div>
          <div class="field"><button class="btn">${p.page ? 'Change PIN' : 'Switch page on'}</button></div></form>
        ${p.page ? '<p style="margin:8px 0 0"><button class="btn small" id="pinoff">Switch page off</button></p>' : ''}
        <label class="check" style="margin-top:12px"><input type="checkbox" id="auto" ${p.auto_send ? 'checked' : ''}> Send customer emails straight away (off = each email waits here for approval)</label>
      </div>
      <div class="card"><h3>Details</h3>
        <form id="df" class="grid">
          ${[['name', 'Project name'], ['customer', 'Customer'], ['site', 'Site'], ['lead', 'Orion lead'], ['lead_email', 'Lead email'], ['contact_name', 'Customer contact'], ['contact_email', 'Contact email'], ['cc_emails', 'CC (comma separated)']]
            .map(([k, l]) => `<div class="field"><label for="d_${k}">${l}</label><input id="d_${k}" type="text" value="${esc(p[k] || '')}"></div>`).join('')}
          <div class="field wide"><button class="btn">Save details</button></div>
        </form>
      </div>
    </div>
  </div>
  <div class="card log"><h3>Event log <small>every input, oldest first; nothing is ever edited</small></h3>
    <div class="tbl"><table><thead><tr><th class="num">#</th><th>Date</th><th>Event</th><th>Details</th><th>By</th><th>Source</th></tr></thead><tbody>
    ${events.map(e => { const v = voided.has(e.id); const T = EVENT_TYPES[e.type];
      return `<tr><td class="num">${e.id}</td><td class="mono ${v ? 'void' : ''}">${fmtDate(e.date)}</td><td class="${v ? 'void' : ''}">${esc(T?.label || e.type)}</td><td class="${v ? 'void' : ''}">${esc(details(e))}</td><td>${esc(e.by || '')}</td><td>${esc(e.source)}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;

  // event form: fields follow the chosen type
  $('#et').addEventListener('change', () => renderFields($('#et').value, r, events));
  $('#ef').addEventListener('submit', async e => {
    e.preventDefault();
    const type = $('#et').value; const T = EVENT_TYPES[type]; const data = {};
    T.fields.forEach(([k, , kind]) => { const el = document.getElementById('f_' + k); if (el) data[k] = kind === 'check' ? el.checked : el.value; });
    $('#esave').disabled = true;
    try {
      const res = await api(`/projects/${p.id}/events`, { method: 'POST', body: { type, date: $('#ed').value, data } });
      await refreshCount();
      project(p.id, { text: `Logged: ${T.label}.${res.outputs ? ` ${res.outputs} output${res.outputs > 1 ? 's' : ''} queued under "Needs you".` : ''}` });
    } catch (err) { if (err.message !== 'signin') { $('#esave').disabled = false; $('#emsg').innerHTML = `<div class="msg err">${esc(err.message)}</div>`; } }
  });
  // outbox actions
  document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.id, action = b.dataset.act;
    const body = { action };
    if (action === 'send') { body.subject = document.getElementById('s_' + id)?.value; body.body = document.getElementById('b_' + id)?.value; }
    b.disabled = true;
    try { await api('/outbox/' + id, { method: 'POST', body }); await refreshCount(); project(p.id, { text: action === 'send' ? 'Email sent.' : 'Done.' }); }
    catch (err) { if (err.message !== 'signin') project(p.id, { text: err.message, err: true }); }
  }));
  $('#pinf').addEventListener('submit', async e => { e.preventDefault(); await patch(p.id, { pin: $('#pin').value }, 'Customer page PIN set. Send the customer the address and the PIN separately.'); });
  $('#pinoff')?.addEventListener('click', () => patch(p.id, { pin: null }, 'Customer page switched off.'));
  $('#auto').addEventListener('change', e => patch(p.id, { auto_send: e.target.checked }, e.target.checked ? 'Customer emails will now send straight away.' : 'Customer emails will wait for approval.'));
  $('#df').addEventListener('submit', async e => {
    e.preventDefault(); const b = {};
    ['name', 'customer', 'site', 'lead', 'lead_email', 'contact_name', 'contact_email', 'cc_emails'].forEach(k => { b[k] = document.getElementById('d_' + k).value; });
    await patch(p.id, b, 'Details saved.');
  });
}
async function patch(id, body, okText) {
  try { await api('/projects/' + id, { method: 'PATCH', body }); project(id, { text: okText }); }
  catch (err) { if (err.message !== 'signin') project(id, { text: err.message, err: true }); }
}
function details(e) {
  const d = e.data || {};
  if (e.type === 'void') return `Cancels #${d.event}: ${d.reason}`;
  return Object.entries(d).map(([k, v]) => k === 'value' ? gbp(v) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : v === true ? 'yes' : v).join(' · ');
}
function mailCard(o) {
  const editable = o.channel === 'email' && ['held', 'failed'].includes(o.status);
  const cls = o.channel === 'alert' ? 'alert' : o.status === 'sent' ? 'sent' : '';
  return `<div class="mail ${cls}">
    <div class="meta"><span>${o.channel === 'email' ? `Email to ${esc(o.to_addr || 'no address set')}` : 'Alert to Orion lead'}${o.ref ? ` · <b>${esc(o.ref)}</b>` : ''}</span><span>${o.status}${o.sent_at ? ' ' + fmtDate(o.sent_at.slice(0, 10)) : ''}</span></div>
    ${editable ? `<input type="text" id="s_${o.id}" value="${esc(o.subject)}" aria-label="Subject"><textarea id="b_${o.id}" rows="8" aria-label="Email text">${esc(o.body)}</textarea>`
      : `<b>${esc(o.subject)}</b><pre>${esc(o.body)}</pre>`}
    ${o.error ? `<div class="msg err">${esc(o.error)}</div>` : ''}
    <div class="meta"><span>Rule: ${esc(o.why || '')}</span></div>
    ${editable ? `<div class="acts"><button class="btn primary small" data-act="send" data-id="${o.id}">Send</button><button class="btn small" data-act="cancel" data-id="${o.id}">Don't send</button></div>` : ''}
    ${o.channel === 'alert' && o.status === 'open' ? `<div class="acts"><button class="btn small" data-act="done" data-id="${o.id}">Mark done</button></div>` : ''}
  </div>`;
}
function renderFields(type, r, events) {
  const box = $('#efields'); const T = EVENT_TYPES[type];
  if (!T) { box.innerHTML = ''; return; }
  const voided = new Set(events.filter(e => e.type === 'void').map(e => +e.data.event));
  box.innerHTML = T.fields.map(([k, label, kind, req]) => {
    const id = 'f_' + k, rq = req ? 'required' : '';
    let input;
    switch (kind) {
      case 'longtext': input = `<textarea id="${id}" ${rq}></textarea>`; break;
      case 'date': input = `<input id="${id}" type="date" ${rq}>`; break;
      case 'money': case 'number': input = `<input id="${id}" type="number" step="any" ${rq}>`; break;
      case 'check': return `<div class="field wide"><label class="check"><input id="${id}" type="checkbox"> ${esc(label)}</label></div>`;
      case 'milestone': input = `<select id="${id}" ${rq}><option value="">Choose…</option>${MILESTONES.map(([m, n]) => `<option value="${m}">${n}${r.planned[m] ? ` (now ${fmtDate(r.planned[m])})` : ''}</option>`).join('')}</select>`; break;
      case 'waiting': input = `<select id="${id}" ${rq}><option value="">Choose…</option>${r.waiting.map(w => `<option value="${w.id}">${esc(w.text)}</option>`).join('')}</select>`; break;
      case 'snag': input = `<select id="${id}" ${rq}><option value="">Choose…</option>${r.snags.filter(s => !s.closed).map(s => `<option value="${s.id}">${esc(s.text)}</option>`).join('')}</select>`; break;
      case 'event': input = `<select id="${id}" ${rq}><option value="">Choose…</option>${events.filter(e => e.type !== 'void' && !voided.has(e.id)).slice().reverse().map(e => `<option value="${e.id}">#${e.id} ${fmtDate(e.date)} ${esc(EVENT_TYPES[e.type]?.label || e.type)}</option>`).join('')}</select>`; break;
      default: input = `<input id="${id}" type="text" ${rq}>`;
    }
    return `<div class="field ${kind === 'longtext' ? 'wide' : ''}"><label for="${id}">${esc(label)}${req ? '' : ' (optional)'}</label>${input}</div>`;
  }).join('') + (T.customer ? '<div class="field wide"><span class="muted" style="font-size:13px">The customer will see this on their page.</span></div>' : '<div class="field wide"><span class="muted" style="font-size:13px">Internal only. The customer will not see this.</span></div>');
}

// ── outbox (all projects) ──
async function outbox() {
  nav('out');
  const { items, mail } = await api('/outbox');
  $('#main').innerHTML = `<div class="card"><h3>Outbox <small>held emails, open alerts and failures across all projects</small></h3>
    ${!mail ? '<p class="empty" style="margin-bottom:8px">Email sending is not set up yet (needs the Resend key).</p>' : ''}
    ${items.length ? `<div class="stack">${items.map(o => `<div><a href="#/p/${o.project_id}" class="mono">${esc(o.ref)}</a>${mailCard({ ...o, ref: '' })}</div>`).join('')}</div>` : '<p class="empty">Nothing waiting.</p>'}
    <p class="empty" style="margin-top:10px">Open the project to send or edit an email.</p></div>`;
  document.querySelectorAll('[data-act]').forEach(b => b.closest('.acts')?.remove());
}

// ── new project ──
function newProject() {
  nav('new');
  $('#main').innerHTML = `<div class="card"><h3>New project</h3>
    <form id="nf" class="grid">
      ${[['ref', 'Project ref (e.g. PRO-GAZ-001)', 1], ['name', 'Project name', 1], ['customer', 'Customer', 1], ['site', 'Site'], ['lead', 'Orion lead', 0, userName()], ['lead_email', 'Lead email'], ['contact_name', 'Customer contact'], ['contact_email', 'Contact email']]
        .map(([k, l, req, v]) => `<div class="field"><label for="n_${k}">${l}</label><input id="n_${k}" type="text" ${req ? 'required' : ''} value="${esc(v || '')}"></div>`).join('')}
      <div class="field wide"><button class="btn primary">Create project</button></div>
      <div class="field wide" id="nmsg"></div>
    </form></div>`;
  $('#nf').addEventListener('submit', async e => {
    e.preventDefault(); const b = {};
    ['ref', 'name', 'customer', 'site', 'lead', 'lead_email', 'contact_name', 'contact_email'].forEach(k => { b[k] = document.getElementById('n_' + k).value; });
    try { const { id } = await api('/projects', { method: 'POST', body: b }); location.hash = '#/p/' + id; }
    catch (err) { if (err.message !== 'signin') $('#nmsg').innerHTML = `<div class="msg err">${esc(err.message)}</div>`; }
  });
}

async function refreshCount() {
  try { const { items } = await api('/outbox'); outboxCount = items.length; } catch {}
}
async function route() {
  const h = location.hash || '#/';
  try {
    await refreshCount();
    if (h.startsWith('#/p/')) await project(h.slice(4));
    else if (h === '#/outbox') await outbox();
    else if (h === '#/new') newProject();
    else await register();
  } catch (err) {
    if (err.message !== 'signin') $('#main').innerHTML = `<div class="msg err">${esc(err.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);
route();
