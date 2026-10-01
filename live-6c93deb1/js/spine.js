// ─────────────────────────────────────────────────────────────────────────
// Orion Live — the spine engine.
//
// Shared by the API (functions/) and the browser (staff app, customer page).
// Three things live here, and nothing else:
//   1. EVENT_TYPES  — every kind of input the spine accepts, and its form fields.
//   2. derive()     — works out the project record from the event list.
//                     Nothing is stored except events; stage, programme,
//                     waiting items, documents etc. are always recalculated.
//   3. rules()      — given one new event and the record before/after it,
//                     returns the outputs: customer emails, alerts, page lines.
//
// Plain ES module, no dependencies. Dates are 'YYYY-MM-DD' strings.
// ─────────────────────────────────────────────────────────────────────────

export const STAGES = [
  'Enquiry', 'Concept + data', 'Proposal', 'Order confirmed', 'Design', 'Procurement', 'Manufacture',
  'Factory test', 'Delivery', 'Install + commission', 'Handover', 'Aftercare',
];

// Owner roles on a project, and which role owns each stage (index matches STAGES).
export const ROLES = [
  ['sales', 'Sales'], ['design', 'Design'], ['procurement', 'Procurement'],
  ['workshop', 'Workshop'], ['site', 'Site'], ['aftercare', 'Aftercare'],
];
const STAGE_ROLE = ['sales', 'sales', 'sales', 'design', 'design', 'procurement', 'workshop', 'workshop', 'site', 'site', 'site', 'aftercare'];
export const stageRole = stage => STAGE_ROLE[stage] || 'sales';
export function parseOwners(project) {
  try { return typeof project.owners === 'string' ? JSON.parse(project.owners || '{}') : (project.owners || {}); } catch { return {}; }
}
// An owner is typed as a name, an email, or "Name <email>".
// Returns { name, email } — a bare email gets a readable name from its first part.
export function parsePerson(s) {
  s = String(s || '').trim();
  const m = s.match(/^(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>$/);
  if (m) return { name: m[1].trim() || nameFromEmail(m[2]), email: m[2].toLowerCase() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { name: nameFromEmail(s), email: s.toLowerCase() };
  return { name: s, email: '' };
}
const nameFromEmail = e => e.split('@')[0].split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
// Who owns the project right now: the owner of its current stage, else the Orion lead.
export function ownerNow(project, stage) {
  const role = stageRole(stage), owners = parseOwners(project);
  if (owners[role]) return { role, ...parsePerson(owners[role]), fromLead: false };
  return { role, name: project.lead || '', email: project.lead_email || '', fromLead: true };
}

export const MILESTONES = [
  ['survey', 'Site survey'],
  ['design', 'Design approved'],
  ['materials', 'Materials in'],
  ['build', 'Build complete'],
  ['test', 'Factory test'],
  ['delivery', 'Delivery to site'],
  ['install', 'Install complete'],
  ['sat', 'Site acceptance (SAT)'],
  ['handover', 'Go-live + handover'],
];
const MILESTONE_NAME = Object.fromEntries(MILESTONES);

// Field kinds: text, longtext, date, money, number, milestone, waiting, snag, event, check
// `stage` = the stage this event moves the project to (never backwards).
// `customer` = shows on the customer page timeline.
export const EVENT_TYPES = {
  enquiry_received: { label: 'Enquiry received', group: 'Sales', stage: 0, customer: true,
    fields: [['summary', 'What they want', 'longtext', true]] },
  quote_issued: { label: 'Quote / proposal issued', group: 'Sales', stage: 2, customer: true,
    fields: [['ref', 'Document ref', 'text', true], ['rev', 'Rev', 'text', true], ['title', 'Title', 'text'],
      ['value', 'Value (£ ex VAT)', 'money'], ['valid_until', 'Valid until', 'date']] },
  concept_issued: { label: 'Concept / data request issued', group: 'Sales', stage: 1, customer: true,
    fields: [['ref', 'Document ref', 'text', true], ['rev', 'Rev', 'text', true], ['title', 'Title', 'text', true], ['link', 'Link', 'text']] },
  site_visit: { label: 'Site visit booked or held', group: 'Sales', customer: true,
    fields: [['date', 'Visit date', 'date', true], ['purpose', 'Purpose', 'text', true], ['held', 'Visit has taken place', 'check']] },
  order_received: { label: 'Order received (PO)', group: 'Sales', stage: 3, customer: true,
    fields: [['po_ref', 'Customer PO ref', 'text', true], ['value', 'Order value (£ ex VAT)', 'money'], ['note', 'Note', 'text']] },
  milestone_planned: { label: 'Set or move a milestone date', group: 'Programme', customer: true,
    fields: [['milestone', 'Milestone', 'milestone', true], ['date', 'Planned date', 'date', true],
      ['reason', 'Reason (required if moving a date)', 'text']] },
  document_issued: { label: 'Document issued', group: 'Documents', customer: true,
    fields: [['ref', 'Document ref', 'text', true], ['rev', 'Rev', 'text', true], ['title', 'Title', 'text', true],
      ['link', 'Link (SharePoint etc.)', 'text']] },
  drawing_issued: { label: 'Drawing issued for approval', group: 'Design', stage: 4, customer: true,
    fields: [['ref', 'Drawing ref', 'text', true], ['rev', 'Rev', 'text', true], ['title', 'Title', 'text'],
      ['approve_by', 'Approval needed by', 'date', true], ['link', 'Link', 'text']] },
  drawing_approved: { label: 'Drawing approved by customer', group: 'Design', stage: 5, customer: true,
    fields: [['ref', 'Drawing ref', 'text', true], ['rev', 'Rev', 'text', true], ['by_name', 'Approved by', 'text', true]] },
  waiting_added: { label: 'Waiting on customer: add item', group: 'Customer', customer: true,
    fields: [['text', 'What we need from them', 'text', true], ['due', 'Needed by', 'date']] },
  waiting_cleared: { label: 'Waiting on customer: item done', group: 'Customer', customer: true,
    fields: [['waiting', 'Item', 'waiting', true]] },
  materials_ordered: { label: 'Materials ordered', group: 'Procurement', stage: 5, customer: true,
    fields: [['expected', 'All expected by', 'date'], ['note', 'Internal note (suppliers, POs)', 'text']] },
  materials_received: { label: 'Materials received', group: 'Procurement',
    fields: [['note', 'What arrived', 'text', true], ['all_in', 'This completes materials', 'check']] },
  build_started: { label: 'Build started', group: 'Workshop', stage: 6, customer: true, fields: [] },
  build_progress: { label: 'Build progress', group: 'Workshop', customer: true,
    fields: [['percent', 'Percent complete', 'number', true], ['note', 'Note for customer', 'text']] },
  build_complete: { label: 'Build complete', group: 'Workshop', stage: 7, customer: true, fields: [] },
  test_passed: { label: 'Factory test passed', group: 'Workshop', stage: 8, customer: true,
    fields: [['note', 'What was tested', 'text'], ['by_name', 'Witnessed / accepted by', 'text']] },
  delivery_booked: { label: 'Delivery booked', group: 'Site', customer: true,
    fields: [['date', 'Delivery date', 'date', true], ['note', 'Details for customer', 'text']] },
  delivered: { label: 'Delivered to site', group: 'Site', stage: 9, customer: true, fields: [] },
  update_posted: { label: 'Progress update (customer sees it)', group: 'Site', customer: true,
    fields: [['text', 'Update', 'longtext', true]] },
  snag_raised: { label: 'Snag raised', group: 'Site', customer: true,
    fields: [['text', 'Snag', 'text', true]] },
  snag_closed: { label: 'Snag closed', group: 'Site', customer: true,
    fields: [['snag', 'Snag', 'snag', true], ['note', 'Fix', 'text']] },
  install_complete: { label: 'Install complete', group: 'Site', customer: true, fields: [] },
  sat_signed: { label: 'SAT signed', group: 'Site', stage: 10, customer: true,
    fields: [['by_name', 'Signed by', 'text', true]] },
  handover_signed: { label: 'Handover signed', group: 'Site', stage: 11, customer: true,
    fields: [['by_name', 'Signed by', 'text', true], ['warranty_months', 'Warranty (months)', 'number', true]] },
  fault_reported: { label: 'Fault reported', group: 'Aftercare', customer: true,
    fields: [['text', 'Fault', 'text', true], ['action', 'What we are doing', 'text']] },
  note: { label: 'Internal note', group: 'Internal',
    fields: [['text', 'Note (customer never sees this)', 'longtext', true]] },
  void: { label: 'Cancel an event logged in error', group: 'Internal',
    fields: [['event', 'Event', 'event', true], ['reason', 'Reason', 'text', true]] },
};

export const fmtDate = d => {
  if (!d) return '';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${+d.slice(8, 10)} ${m[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
};
export const gbp = v => (v == null || v === '' ? '' : '£' + Math.round(+v).toLocaleString('en-GB'));
const data = e => e.data || {};

// ── derive: events → record ──────────────────────────────────────────────
export function derive(events) {
  const voided = new Set(events.filter(e => e.type === 'void').map(e => +data(e).event));
  const live = events.filter(e => !voided.has(e.id) && e.type !== 'void')
    .slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const r = {
    stage: -1, planned: {}, actual: {}, moves: [], waiting: [], docs: [], signoffs: [],
    snags: [], faults: [], percent: null, value: null, warranty: null, timeline: [], log: live,
  };
  for (const e of live) {
    const d = data(e), T = EVENT_TYPES[e.type];
    if (!T) continue;
    if (T.stage != null && T.stage > r.stage) r.stage = T.stage;
    switch (e.type) {
      case 'quote_issued':
        if (d.value) r.value = +d.value;
        r.docs.forEach(x => { if (x.ref === d.ref) x.superseded = true; });
        r.docs.push({ ref: d.ref, rev: d.rev, title: d.title || 'Proposal', date: e.date, link: d.link });
        r.waiting = r.waiting.filter(w => w.key !== 'decision');
        r.waiting.push({ key: 'decision', id: 'decision', text: 'Decision and purchase order', due: d.valid_until || null, from: e.date });
        break;
      case 'order_received':
        if (d.value) r.value = +d.value;
        r.actual.order = e.date;
        r.waiting = r.waiting.filter(w => w.key !== 'decision');
        break;
      case 'milestone_planned':
        if (r.planned[d.milestone] && r.planned[d.milestone] !== d.date)
          r.moves.push({ milestone: d.milestone, from: r.planned[d.milestone], to: d.date, reason: d.reason || '', date: e.date });
        r.planned[d.milestone] = d.date;
        break;
      case 'concept_issued':
      case 'document_issued':
        r.docs.forEach(x => { if (x.ref === d.ref) x.superseded = true; });
        r.docs.push({ ref: d.ref, rev: d.rev, title: d.title, date: e.date, link: d.link });
        break;
      case 'drawing_issued':
        r.docs.forEach(x => { if (x.ref === d.ref) x.superseded = true; });
        r.docs.push({ ref: d.ref, rev: d.rev, title: d.title || 'Drawing for approval', date: e.date, link: d.link });
        r.waiting.push({ key: 'drawing:' + d.ref, id: 'e' + e.id, text: `Approve ${d.title || 'drawing'} ${d.ref} Rev ${d.rev}`, due: d.approve_by, from: e.date });
        break;
      case 'drawing_approved':
        r.waiting = r.waiting.filter(w => w.key !== 'drawing:' + d.ref);
        r.signoffs.push({ what: `${d.ref} Rev ${d.rev} approved`, by: d.by_name, date: e.date });
        r.actual.design = e.date;
        break;
      case 'waiting_added':
        r.waiting.push({ key: 'w' + e.id, id: 'e' + e.id, text: d.text, due: d.due, from: e.date });
        break;
      case 'waiting_cleared':
        r.waiting = r.waiting.filter(w => w.id !== d.waiting);
        break;
      case 'materials_received':
        if (d.all_in) r.actual.materials = e.date;
        break;
      case 'build_progress': r.percent = +d.percent; break;
      case 'build_complete': r.actual.build = e.date; r.percent = 100; break;
      case 'test_passed':
        r.actual.test = e.date;
        if (d.by_name) r.signoffs.push({ what: 'Factory test accepted', by: d.by_name, date: e.date });
        break;
      case 'delivery_booked':
        if (r.planned.delivery && r.planned.delivery !== d.date)
          r.moves.push({ milestone: 'delivery', from: r.planned.delivery, to: d.date, reason: 'Delivery booked', date: e.date });
        r.planned.delivery = d.date;
        break;
      case 'delivered': r.actual.delivery = e.date; break;
      case 'snag_raised': r.snags.push({ id: 'e' + e.id, text: d.text, raised: e.date, closed: null }); break;
      case 'snag_closed': { const s = r.snags.find(x => x.id === d.snag); if (s) { s.closed = e.date; s.fix = d.note; } break; }
      case 'install_complete': r.actual.install = e.date; break;
      case 'sat_signed': r.actual.sat = e.date; r.signoffs.push({ what: 'Site acceptance (SAT)', by: d.by_name, date: e.date }); break;
      case 'handover_signed': {
        r.actual.handover = e.date; r.signoffs.push({ what: 'Handover', by: d.by_name, date: e.date });
        const m = +d.warranty_months || 0, t = new Date(e.date + 'T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + m);
        r.warranty = { from: e.date, to: t.toISOString().slice(0, 10), months: m };
        break;
      }
      case 'fault_reported': r.faults.push({ text: d.text, action: d.action, date: e.date }); break;
    }
    if (T.customer) r.timeline.push({ id: e.id, date: e.date, type: e.type, text: customerLine(e) });
  }
  if (r.stage < 0 && live.length) r.stage = 0;
  r.next = MILESTONES.map(([k, n]) => ({ k, n, date: r.planned[k] })).find(m => m.date && !r.actual[m.k]) || null;
  return r;
}

// What the customer reads for each event (no money, no suppliers, no internal notes)
export function customerLine(e) {
  const d = data(e);
  switch (e.type) {
    case 'enquiry_received': return 'Enquiry received.';
    case 'concept_issued': return `${d.title} ${d.ref} Rev ${d.rev} issued.`;
    case 'site_visit': return d.held ? `Site visit held: ${d.purpose}.` : `Site visit booked for ${fmtDate(d.date)}: ${d.purpose}.`;
    case 'quote_issued': return `${d.title || 'Proposal'} ${d.ref} Rev ${d.rev} issued.`;
    case 'order_received': return 'Order confirmed.';
    case 'milestone_planned': return `${MILESTONE_NAME[d.milestone] || d.milestone}: planned for ${fmtDate(d.date)}${d.reason ? ` (${d.reason})` : ''}.`;
    case 'document_issued': return `${d.title} ${d.ref} Rev ${d.rev} added to documents.`;
    case 'drawing_issued': return `${d.title || 'Drawing'} ${d.ref} Rev ${d.rev} ready for your approval.`;
    case 'drawing_approved': return `${d.ref} Rev ${d.rev} approved by ${d.by_name}.`;
    case 'waiting_added': return `We need from you: ${d.text}${d.due ? ` by ${fmtDate(d.due)}` : ''}.`;
    case 'waiting_cleared': return 'Thanks, item received.';
    case 'materials_ordered': return `Materials ordered${d.expected ? `, all expected by ${fmtDate(d.expected)}` : ''}.`;
    case 'build_started': return 'Build started in our workshop.';
    case 'build_progress': return `Build ${d.percent}% complete.${d.note ? ' ' + d.note : ''}`;
    case 'build_complete': return 'Build complete.';
    case 'test_passed': return `Factory test passed.${d.note ? ' ' + d.note : ''}`;
    case 'delivery_booked': return `Delivery booked for ${fmtDate(d.date)}.${d.note ? ' ' + d.note : ''}`;
    case 'delivered': return 'Delivered to site.';
    case 'update_posted': return d.text;
    case 'snag_raised': return `Snag logged: ${d.text}`;
    case 'snag_closed': return `Snag closed.${d.note ? ' ' + d.note : ''}`;
    case 'install_complete': return 'Installation complete.';
    case 'sat_signed': return `Site acceptance signed by ${d.by_name}.`;
    case 'handover_signed': return `Handed over. Warranty ${d.warranty_months} months.`;
    case 'fault_reported': return `Fault logged: ${d.text}.${d.action ? ' ' + d.action : ''}`;
  }
  return EVENT_TYPES[e.type]?.label || e.type;
}

// ── rules: one event → outputs ───────────────────────────────────────────
// Each output: { channel: 'email' | 'alert', subject, body, why }
// Emails go to the project's customer contacts; alerts to the Orion lead.
export function rules(project, e, before, after) {
  const d = data(e), out = [];
  const first = (project.contact_name || '').split(' ')[0] || 'Hello';
  const pageLine = `\n\nYou can see the programme, documents and anything we need from you on your project page.`;
  const sign = `\n\n${project.lead || 'Orion MIS'}\nOrion MIS · ${project.ref}`;
  const mail = (subject, body, why) => out.push({ channel: 'email', subject: `[${project.ref}] ${subject}`, body: `${first},\n\n${body}${pageLine}${sign}`, why });
  const alert = (subject, body, why) => out.push({ channel: 'alert', subject, body, why });
  const progLines = r => MILESTONES.filter(([k]) => r.planned[k]).map(([k, n]) => `• ${n}: ${fmtDate(r.planned[k])}`).join('\n');

  switch (e.type) {
    case 'enquiry_received':
      mail('We have your enquiry', `Thank you for your enquiry. We have logged it as ${project.ref} and will come back to you with a layout and budget price.`, 'Enquiry received');
      break;
    case 'concept_issued':
      mail(`${d.title} Rev ${d.rev}`, `${d.title} ${d.ref} Rev ${d.rev} is on your project page.`, 'Concept issued');
      break;
    case 'site_visit':
      if (!d.held) mail(`Site visit: ${fmtDate(d.date)}`, `We have booked a site visit for ${fmtDate(d.date)}: ${d.purpose}.`, 'Site visit booked');
      break;
    case 'quote_issued':
      mail(`${d.title || 'Proposal'} Rev ${d.rev}`, `${d.title || 'Our proposal'} ${d.ref} Rev ${d.rev} is on your project page${d.value ? `. Total ${gbp(d.value)} ex VAT` : ''}${d.valid_until ? `, valid until ${fmtDate(d.valid_until)}` : ''}.`, 'Quote issued');
      break;
    case 'order_received':
      mail('Order confirmed', `Thank you for your order (your ref ${d.po_ref}).${Object.keys(after.planned).length ? `\n\nYour programme:\n${progLines(after)}` : `\n\nWe will send your programme with key dates shortly.`}`, 'Order received');
      if (!Object.keys(after.planned).length) alert('Set the programme dates', `${project.ref} has an order but no planned milestones. The customer has been told dates will follow.`, 'Order with no programme');
      break;
    case 'milestone_planned': {
      const was = before.planned[d.milestone];
      if (was && was !== d.date) {
        mail(`Date change: ${MILESTONE_NAME[d.milestone]}`, `${MILESTONE_NAME[d.milestone]} has moved from ${fmtDate(was)} to ${fmtDate(d.date)}.${d.reason ? `\n\nReason: ${d.reason}` : ''}\n\nCurrent programme:\n${progLines(after)}`, 'A planned date moved');
        if (!d.reason) alert('Date moved without a reason', `${project.ref}: ${MILESTONE_NAME[d.milestone]} moved with no reason given. The customer email says no reason.`, 'Moves need a reason');
      }
      break;
    }
    case 'drawing_issued':
      mail(`${d.title || 'Drawing'} ready for your approval`, `${d.title || 'Drawing'} ${d.ref} Rev ${d.rev} is on your project page. Please review and approve it by ${fmtDate(d.approve_by)}.`, 'Drawing issued adds a waiting-on item');
      break;
    case 'drawing_approved':
      mail('Approval recorded', `Thank you. Your approval of ${d.ref} Rev ${d.rev} is recorded. Materials are now being ordered.`, 'Customer approval');
      break;
    case 'waiting_added':
      mail(`Needed from you: ${d.text}`, `To keep your programme on track we need: ${d.text}${d.due ? `, by ${fmtDate(d.due)}` : ''}.`, 'Waiting-on item added');
      break;
    case 'build_complete':
      mail('Build complete', `Your system is built.${after.planned.test ? ` Factory test is planned for ${fmtDate(after.planned.test)}.` : ''}`, 'Build complete');
      break;
    case 'test_passed':
      mail('Factory test passed', `Your system has passed its factory test.${d.note ? ` ${d.note}` : ''}${after.planned.delivery ? `\n\nDelivery is planned for ${fmtDate(after.planned.delivery)}.` : ''}`, 'Factory test passed');
      break;
    case 'delivery_booked':
      mail(`Delivery: ${fmtDate(d.date)}`, `Delivery is booked for ${fmtDate(d.date)}.${d.note ? `\n\n${d.note}` : ''}`, 'Delivery booked');
      break;
    case 'delivered':
      mail('Delivered: install under way', `Everything has arrived on site and installation has started.${after.planned.install ? ` Install complete is planned for ${fmtDate(after.planned.install)}.` : ''}`, 'Delivered');
      break;
    case 'install_complete':
      mail('Install complete', `Installation is complete. Commissioning is next.${after.planned.sat ? ` Site acceptance is planned for ${fmtDate(after.planned.sat)}.` : ''}`, 'Install complete');
      break;
    case 'sat_signed':
      mail('Site acceptance signed', `Thank you for signing the site acceptance test.`, 'SAT signed');
      break;
    case 'handover_signed':
      mail('Handover', `Your system is handed over. The O&M manual and training records are on your project page. Warranty runs to ${fmtDate(after.warranty?.to)}.`, 'Handover signed');
      break;
    case 'fault_reported':
      mail('Fault logged', `We have logged the fault: ${d.text}.${d.action ? `\n\n${d.action}` : ''}`, 'Fault reported');
      alert(`Fault: ${project.ref}`, d.text, 'Fault reported');
      break;
  }
  return out;
}

// Which waiting items are overdue on a given day
export const overdue = (r, today) => r.waiting.filter(w => w.due && w.due < today);
