// Orion Live — staff app. Hash routes:
//   #/            register of all projects
//   #/p/<id>      one project: record, log an event, outbox, settings
//   #/outbox      everything waiting for a person, all projects
//   #/new         create a project
import { STAGES, MILESTONES, EVENT_TYPES, ROLES, stageRole, ownerNow, parseOwners, parsePerson, fmtDate, gbp } from './js/spine.js';
import { overview } from './overview.js';
import { SYSTEM_TYPES, normaliseSystem } from './js/system.js';
const ROLE_NAME = Object.fromEntries(ROLES);
let lastPin = null;

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
  $('#nav').innerHTML = [['#/', 'Overview', 'ov'], ['#/register', 'Register', 'reg'], ['#/outbox', `Outbox${outboxCount ? `<span class="badge">${outboxCount}</span>` : ''}`, 'out'], ['#/new', 'New project', 'new'], ['#/mail', 'Mail to file', 'mail'], ['#/import', 'Import', 'imp']]
    .map(([h, l, k]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${l}</a>`).join('');
  $('#who').textContent = userName() ? `Signed in as ${userName()}` : '';
}
function stageStrip(stage) {
  return `<div class="stages">${STAGES.map((s, i) => `<div class="stg ${i < stage ? 'done' : i === stage ? 'cur' : ''}"><span class="n">${i + 1}</span>${s}</div>`).join('')}</div>`;
}
const stagePill = s => s < 0 ? '<span class="pill">no events</span>' : `<span class="pill ${s >= 11 ? 'good' : 'steel'}">${s + 1} · ${STAGES[s]}</span>`;

// ── register ──
async function register() {
  nav('reg');
  const { projects } = await api('/projects');
  const t = today();
  $('#main').innerHTML = `
  <div class="card"><h3>Live projects <small>${projects.length} · stage, dates and waiting items are worked out from each project's events</small></h3>
  ${projects.length ? `<div class="tbl"><table><thead><tr><th>Ref</th><th>Project</th><th>Customer</th><th>Stage</th><th>Owner now</th><th>Next milestone</th><th>Waiting on customer</th><th>Needs you</th><th>Last event</th><th>Customer page</th></tr></thead><tbody>
  ${projects.map(p => `<tr class="link" data-id="${p.id}">
    <td class="mono">${esc(p.ref)}</td><td>${esc(p.name)}</td><td>${esc(p.customer)}</td><td>${stagePill(p.stage)}</td>
    <td>${p.owner?.name ? esc(p.owner.name) : '<span class="muted">–</span>'}<br><span class="muted" style="font-size:12.5px">${ROLE_NAME[p.owner?.role] || ''}${p.owner?.fromLead ? ' (lead)' : ''}</span></td>
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
  const [cur, tm, pl] = await Promise.all([api('/projects/' + id), api('/team').catch(() => ({ people: [] })), api('/projects').catch(() => ({ projects: [] }))]);
  allProjects = pl.projects || [];
  current = cur; const team = tm.people || [];
  const { project: p, record: r, events, outbox, mail, mails = [], captureLive } = current;
  let sys; try { sys = normaliseSystem(JSON.parse(p.system || 'null')); } catch { sys = normaliseSystem(null); }
  const t = today();
  const voided = new Set(events.filter(e => e.type === 'void').map(e => +e.data.event));
  const held = outbox.filter(o => ['held', 'failed', 'open'].includes(o.status));
  const done = outbox.filter(o => !['held', 'failed', 'open'].includes(o.status));
  const groups = {};
  Object.entries(EVENT_TYPES).filter(([, T]) => T.manual !== false).forEach(([k, T]) => (groups[T.group] ||= []).push([k, T]));

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
      <div class="card"><h3>Emails <small>${mails.length} captured</small></h3>
        <div id="maildrop" tabindex="0" role="button" aria-label="Add emails to this job" style="border:2px dashed var(--line);border-radius:6px;padding:14px;text-align:center;margin:0 0 10px;cursor:pointer">
          <b>Drag emails here</b> <span class="muted">(.eml or .msg, several at once)</span><br><span class="muted" style="font-size:13px">or click to choose files. Duplicates are skipped.</span>
          <input type="file" id="mailfile" accept=".eml,.msg,message/rfc822,application/vnd.ms-outlook" multiple hidden>
          <div id="mailmsg" style="margin-top:6px;font-size:14px"></div></div>
        <p style="margin:0 0 8px;font-size:13px" class="muted">Once the capture mailbox is on: copy <span class="mono">${esc(p.capture)}</span> into emails about this job and they file themselves. <button class="btn small" id="cap-copy" type="button">Copy address</button></p>
        ${!captureLive ? '<p class="empty" style="margin-bottom:8px;font-size:13px">The capture mailbox is not switched on yet; emails sent to this address will bounce until it is.</p>' : ''}
        ${mails.length ? `<div class="stack" style="gap:6px">${mails.map(m => mailItem(m, true)).join('')}</div>` : '<p class="empty">None yet.</p>'}
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
      <div class="card"><h3>Customer page <small>${p.page ? 'on' : 'off'}</small></h3>
        <p style="margin:0 0 10px"><a class="btn small" href="/live-6c93deb1/cust#${p.id}" target="_blank" rel="noopener">Preview what the customer sees</a></p>
        ${p.page ? `<p style="margin:0 0 8px">Address: <span class="mono">${esc(location.host + p.track)}</span></p>
          <div class="label" style="margin:10px 0 6px">Send the address</div>
          <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn small" id="sh-copy" type="button">Copy message</button>
            <a class="btn small" href="https://wa.me/?text=${encodeURIComponent(shareMsg(p))}" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn small" href="mailto:${encodeURIComponent(p.contact_email || '')}?subject=${encodeURIComponent(`[${p.ref}] Your project page`)}&body=${encodeURIComponent(shareMsg(p))}">Your email</a>
            <button class="btn small" id="sh-mail" type="button">Email from Orion Live</button>
          </div>
          <p class="empty" style="margin-top:6px;font-size:13px">Send the PIN in a separate message.</p>` : '<p class="empty" style="margin-bottom:8px">Off. Set a PIN to switch it on.</p>'}
        ${lastPin ? `<div class="msg ok" style="margin-top:10px">PIN <b class="mono">${esc(lastPin)}</b> set. Send it separately, now; it is not shown again.
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn small" id="pin-copy" type="button">Copy PIN message</button>
          <a class="btn small" href="https://wa.me/?text=${encodeURIComponent(pinMsg(p, lastPin))}" target="_blank" rel="noopener">WhatsApp the PIN</a></div></div>` : ''}
        <form id="pinf" class="grid" style="margin-top:12px"><div class="field"><label for="pin">${p.page ? 'New PIN' : 'PIN'} (4–8 digits)</label><input id="pin" type="text" inputmode="numeric" pattern="\d{4,8}" required></div>
          <div class="field"><button class="btn">${p.page ? 'Change PIN' : 'Switch page on'}</button></div></form>
        ${p.page ? '<p style="margin:8px 0 0"><button class="btn small" id="pinoff">Switch page off</button></p>' : ''}
        <label class="check" style="margin-top:12px"><input type="checkbox" id="auto" ${p.auto_send ? 'checked' : ''}> Send customer emails straight away (off = each email waits here for approval)</label>
      </div>
      <div class="card"><h3>Customer page drawing <small>${esc(SYSTEM_TYPES[sys.type].label)}</small></h3>
        <form id="sf" class="grid">
          <div class="field"><label for="s_type">Drawing</label><select id="s_type">${Object.entries(SYSTEM_TYPES).map(([k, T]) => `<option value="${k}" ${sys.type === k ? 'selected' : ''}>${esc(T.label)}</option>`).join('')}</select></div>
          ${SYSTEM_TYPES[sys.type].fields.map(([k, l, lo, hi]) => `<div class="field"><label for="s_${k}">${l}</label><input id="s_${k}" type="number" min="${lo}" max="${hi}" value="${sys[k]}"></div>`).join('')}
          ${sys.type === 'sorter' ? `<div class="field"><label for="s_spine">Spine length (label)</label><input id="s_spine" type="text" value="${esc(sys.spine || '')}" placeholder="e.g. 28.9 m"></div>
            <div class="field wide"><label class="check"><input type="checkbox" id="s_scan" ${sys.scan ? 'checked' : ''}> Scanning</label> <label class="check"><input type="checkbox" id="s_fence" ${sys.fence ? 'checked' : ''}> Safety fencing</label></div>` : ''}
          ${['conveyor', 'guarding', 'stillage'].includes(sys.type) ? `<div class="field"><label for="s_label">Label</label><input id="s_label" type="text" value="${esc(sys.label || '')}"></div>` : ''}
          <div class="field wide"><button class="btn">Save drawing</button> <a class="btn" href="/live-6c93deb1/cust#${p.id}" target="_blank" rel="noopener">Preview</a></div>
        </form>
      </div>
      <div class="card"><h3>Owners <small>now: <b>${esc(ownerNow(p, r.stage).name || '–')}</b>${ownerNow(p, r.stage).email ? ` <span class="mono">${esc(ownerNow(p, r.stage).email)}</span>` : ''} · ${ROLE_NAME[stageRole(r.stage)]}</small></h3>
        <form id="of" class="grid">
          ${ROLES.map(([k, l]) => `<div class="field"><label for="o_${k}">${l}${stageRole(r.stage) === k ? ' · current stage' : ''}</label><input id="o_${k}" type="text" list="team" value="${esc(parseOwners(p)[k] || '')}" placeholder="Name or email (blank = ${esc(p.lead || 'lead')})"></div>`).join('')}
          <div class="field wide"><button class="btn">Save owners</button></div>
        </form>
        <datalist id="team">${team.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <p class="empty" style="margin-top:6px;font-size:13px">Type a name, an email, or <span class="mono">Name &lt;email&gt;</span>. Anyone entered once is suggested on every job. With an email, alerts for the current stage go to that person. Blank = the Orion lead covers it.</p>
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
  lastPin = null;
  $('#pinf').addEventListener('submit', async e => { e.preventDefault(); const pin = $('#pin').value; lastPin = pin; await patch(p.id, { pin }, 'Customer page PIN set. Send the address and the PIN as separate messages.'); });
  const copy = async (text, btn) => { try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { prompt('Copy this:', text); } };
  $('#cap-copy')?.addEventListener('click', e => copy(p.capture, e.target));
  // drag-and-drop emails onto the job
  const drop = $('#maildrop'), pick = $('#mailfile');
  const addFiles = async files => {
    files = [...files].filter(f => /\.(eml|msg)$/i.test(f.name) || /rfc822|ms-outlook/.test(f.type));
    if (!files.length) { $('#mailmsg').innerHTML = '<span class="pill warn">Only .eml or .msg files</span> In Outlook: open the email, File → Save as, then drag the saved file here.'; return; }
    $('#mailmsg').textContent = `Reading ${files.length} email${files.length > 1 ? 's' : ''}…`;
    try {
      const messages = []; const failed = [];
      for (const f of files) { try { messages.push(await parseEmailFile(f)); } catch (err) { failed.push(f.name); } }
      const r = messages.length ? await api(`/projects/${p.id}/mail`, { method: 'POST', body: { messages } }) : { added: 0, skipped: 0 };
      project(p.id, { text: `Emails: ${r.added} added${r.skipped ? `, ${r.skipped} already on file` : ''}${failed.length ? `. Could not read: ${failed.join(', ')}` : ''}.`, err: !r.added && failed.length > 0 });
    } catch (err) { if (err.message !== 'signin') $('#mailmsg').innerHTML = `<span class="pill warn">${esc(err.message)}</span>`; }
  };
  drop.addEventListener('click', e => { if (e.target === drop || e.target.closest('b,span,br')) pick.click(); });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.click(); } });
  pick.addEventListener('change', () => addFiles(pick.files));
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; drop.style.background = 'var(--accent-soft)'; }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.style.borderColor = ''; drop.style.background = ''; }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  // move / unfile a captured email
  document.querySelectorAll('[data-mailmove]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.mailmove, to = document.getElementById('mm_' + id).value;
    if (!to) return;
    try { await api('/mail/' + id, { method: 'POST', body: to === 'unfile' ? { action: 'unfile' } : { project_id: +to } }); project(p.id, { text: to === 'unfile' ? 'Email unfiled. It is now under Mail to file.' : 'Email moved.' }); }
    catch (err) { if (err.message !== 'signin') project(p.id, { text: err.message, err: true }); }
  }));
  $('#sh-copy')?.addEventListener('click', e => copy(shareMsg(p), e.target));
  $('#pin-copy')?.addEventListener('click', e => copy(pinMsg(p, $('#pin-copy').closest('.msg').querySelector('b').textContent), e.target));
  $('#sh-mail')?.addEventListener('click', async () => {
    try { await api(`/projects/${p.id}/share`, { method: 'POST' }); await refreshCount(); project(p.id, { text: 'Email queued under "Needs you". Check it and press Send.' }); }
    catch (err) { if (err.message !== 'signin') project(p.id, { text: err.message, err: true }); }
  });
  $('#s_type').addEventListener('change', e => patch(p.id, { system: { ...sys, type: e.target.value } }, 'Drawing type changed. Set its sizes below.'));
  $('#sf').addEventListener('submit', async e => {
    e.preventDefault(); const next = { type: sys.type };
    SYSTEM_TYPES[sys.type].fields.forEach(([k]) => { next[k] = +document.getElementById('s_' + k).value; });
    if (sys.type === 'sorter') { next.spine = $('#s_spine').value; next.scan = $('#s_scan').checked; next.fence = $('#s_fence').checked; }
    if ($('#s_label')) next.label = $('#s_label').value;
    await patch(p.id, { system: next }, 'Drawing saved. Use Preview to see it as the customer will.');
  });
  $('#of').addEventListener('submit', async e => {
    e.preventDefault(); const owners = {};
    ROLES.forEach(([k]) => { owners[k] = document.getElementById('o_' + k).value; });
    await patch(p.id, { owners }, 'Owners saved.');
  });
  $('#pinoff')?.addEventListener('click', () => patch(p.id, { pin: null }, 'Customer page switched off.'));
  $('#auto').addEventListener('change', e => patch(p.id, { auto_send: e.target.checked }, e.target.checked ? 'Customer emails will now send straight away.' : 'Customer emails will wait for approval.'));
  $('#df').addEventListener('submit', async e => {
    e.preventDefault(); const b = {};
    ['name', 'customer', 'site', 'lead', 'lead_email', 'contact_name', 'contact_email', 'cc_emails'].forEach(k => { b[k] = document.getElementById('d_' + k).value; });
    await patch(p.id, b, 'Details saved.');
  });
}
let allProjects = [];
const currentProjectId = () => current?.project?.id;
// Read a dragged .eml (MIME) or .msg (Outlook) file into the fields the server stores.
async function parseEmailFile(f) {
  const buf = await f.arrayBuffer();
  const strip = h => String(h || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+\n/g, '\n');
  if (/\.msg$/i.test(f.name) || f.type === 'application/vnd.ms-outlook') {
    const mod = await import('https://cdn.jsdelivr.net/npm/@kenjiuno/msgreader@1.28.0/+esm');
    const MsgReader = typeof mod.default === 'function' ? mod.default : mod.default.default;
    const d = new MsgReader(buf).getFileData();
    if (d.error) throw new Error(d.error);
    const rec = t => (d.recipients || []).filter(r => (r.recipType || 'to') === t).map(r => r.smtpAddress || r.email).filter(Boolean);
    const mid = (String(d.headers || '').match(/^Message-ID:\s*(<[^>]+>)/im) || [])[1] || d.internetMessageId || '';
    return { messageId: mid, from: d.senderSmtpAddress || d.senderEmail || '', fromName: d.senderName || '', to: rec('to'), cc: rec('cc'),
      subject: d.subject || '', date: d.messageDeliveryTime || d.clientSubmitTime || d.creationTime || '', text: d.body || strip(d.bodyHtml),
      attachments: (d.attachments || []).map(a => ({ name: a.fileName || a.name, type: a.mimeType || '', size: a.contentLength || 0 })) };
  }
  const PostalMime = (await import('https://cdn.jsdelivr.net/npm/postal-mime@2.7.6/+esm')).default;
  const e = await PostalMime.parse(buf);
  return { messageId: e.messageId || '', from: e.from?.address || '', fromName: e.from?.name || '', to: (e.to || []).map(a => a.address).filter(Boolean), cc: (e.cc || []).map(a => a.address).filter(Boolean),
    subject: e.subject || '', date: e.date || '', text: e.text || strip(e.html),
    attachments: (e.attachments || []).filter(a => a.disposition !== 'inline').map(a => ({ name: a.filename, type: a.mimeType, size: a.content?.byteLength || 0 })) };
}
function mailItem(m, onJob) {
  const atts = JSON.parse(m.attachments || '[]');
  return `<details class="list" style="background:var(--soft);border-radius:3px;padding:8px 10px">
    <summary style="color:var(--ink)"><span class="mono muted">${fmtDate((m.sent_at || '').slice(0, 10))}</span> · <b>${esc(m.from_name || m.from_addr)}</b> · ${esc(m.subject)}${atts.length ? ` · <span class="muted">${atts.length} attachment${atts.length > 1 ? 's' : ''}</span>` : ''}</summary>
    <div class="muted" style="font-size:12.5px;margin:6px 0">From ${esc(m.from_addr)} · To ${esc(m.to_addrs)}${m.cc_addrs ? ' · Cc ' + esc(m.cc_addrs) : ''}</div>
    <pre style="white-space:pre-wrap;font-family:var(--f-body);font-size:14px;margin:0;max-height:360px;overflow:auto">${esc(m.body)}</pre>
    ${atts.length ? `<div class="muted" style="font-size:12.5px;margin-top:6px">Attachments (names only, files stay in Outlook): ${atts.map(a => esc(a.name)).join(', ')}</div>` : ''}
    ${onJob ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center"><select id="mm_${m.id}" aria-label="Move this email"><option value="">Move to…</option>${allProjects.filter(x => x.id !== currentProjectId()).map(x => `<option value="${x.id}">${esc(x.ref)} · ${esc(x.customer)}</option>`).join('')}<option value="unfile">Unfile (back to Mail to file)</option></select><button class="btn small" type="button" data-mailmove="${m.id}">Apply</button></div>` : ''}
  </details>`;
}
async function mailPage() {
  nav('mail');
  const [{ items, domain, live }, { projects }] = await Promise.all([api('/mail'), api('/projects')]);
  $('#main').innerHTML = `<div class="card"><h3>Mail to file <small>captured emails that could not be matched to a job</small></h3>
    <p class="empty" style="margin-bottom:10px">Emails are filed automatically when sent to a job's own address (e.g. <span class="mono">pro-gaz-001@${esc(domain)}</span>), when the job ref is in the subject, or when the customer's address is on them. General address: <span class="mono">admin@${esc(domain)}</span>.${live ? '' : ' The capture mailbox is not switched on yet.'}</p>
    ${items.length ? `<div class="stack">${items.map(m => `<div>${mailItem(m)}<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><select id="fm_${m.id}" aria-label="Project"><option value="">File against…</option>${projects.map(p => `<option value="${p.id}">${esc(p.ref)} · ${esc(p.customer)}</option>`).join('')}</select><button class="btn small" data-file="${m.id}">File</button></div></div>`).join('')}</div>` : '<p class="empty">Nothing to file.</p>'}</div>`;
  document.querySelectorAll('[data-file]').forEach(b => b.addEventListener('click', async () => {
    const pid = document.getElementById('fm_' + b.dataset.file).value; if (!pid) return;
    b.disabled = true;
    try { await api('/mail/' + b.dataset.file, { method: 'POST', body: { project_id: +pid } }); mailPage(); } catch (err) { b.disabled = false; }
  }));
}
function shareMsg(p) {
  const first = (p.contact_name || '').split(' ')[0];
  return `${first ? 'Hi ' + first + ', y' : 'Y'}ou can follow ${p.name} (${p.ref}) on your project page: ${location.origin}${p.track}
It shows the stage, the dates we are working to, anything we need from you, and our documents. I'll send the PIN separately.
${userName() || p.lead || ''}, Orion MIS`;
}
const pinMsg = (p, pin) => `PIN for your ${p.ref} project page: ${pin}`;
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

// ── import (job history files kept on our own PCs, never in the website code) ──
function importPage() {
  nav('imp');
  $('#main').innerHTML = `<div class="card"><h3>Import job history <small>one .json file per job · events are added as "import" and send no emails</small></h3>
    <form id="if" class="grid">
      <div class="field wide"><label for="ifile">Choose one or more job files</label><input id="ifile" type="file" accept=".json,application/json" multiple required></div>
      <div class="field wide"><button class="btn primary">Import</button></div>
    </form>
    <ul class="list" id="ires" style="margin-top:12px"></ul>
    <p class="empty" style="margin-top:12px">File format: <span class="mono">{ "project": { "ref", "name", "customer", "site", "lead", "lead_email", "contact_name", "contact_email" }, "events": [ { "type", "date", "data" } ] }</span>. A job can be imported once; after that, log events on its project page.</p></div>`;
  $('#if').addEventListener('submit', async e => {
    e.preventDefault();
    const out = $('#ires'); out.innerHTML = '';
    for (const f of $('#ifile').files) {
      let line;
      try {
        const body = JSON.parse(await f.text());
        const r = await api('/import', { method: 'POST', body });
        line = `<li><span>${esc(f.name)}: <a href="#/p/${r.id}">${esc(r.ref)}</a></span><span class="pill good">${r.added} events</span></li>`;
      } catch (err) {
        if (err.message === 'signin') return;
        line = `<li><span>${esc(f.name)}</span><span class="pill warn">${esc(err.message)}</span></li>`;
      }
      out.insertAdjacentHTML('beforeend', line);
    }
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
    else if (h === '#/import') importPage();
    else if (h === '#/mail') await mailPage();
    else if (h === '#/register') await register();
    else { nav('ov'); overview($('#main'), await api('/overview')); }
  } catch (err) {
    if (err.message !== 'signin') $('#main').innerHTML = `<div class="msg err">${esc(err.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);
route();
