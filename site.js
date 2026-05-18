// ════════════════════════════════════════════════════════════════
// ORION MIS — shared site scripts
// Drop-in for every public page:
//   - Cookie banner (essential + optional analytics)
//   - GA4 loader (only fires on consent)
//   - "Ask Orion" launcher + branded contact modal
//     (replaces Tawk — works offline, no third-party widget,
//      submits direct to Basin → info@orionmis.co.uk)
// ════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. CONFIG
  // ──────────────────────────────────────────────────────────────
  var GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';                  // e.g. 'G-1A2B3C4D5E'
  var BASIN_ENDPOINT     = 'https://usebasin.com/f/d04288a27fc6';  // routes to info@orionmis.co.uk
  var STORAGE_KEY        = 'orion_cookie_consent_v1';
  // Working hours (UK time, 24h): Mon–Fri 09:00–17:30
  var WORK_DAYS          = [1, 2, 3, 4, 5]; // 0 = Sunday
  var WORK_START_H       = 9;
  var WORK_END_H         = 17;
  var WORK_END_M         = 30;

  // ──────────────────────────────────────────────────────────────
  // 2. CONSENT STORE
  // ──────────────────────────────────────────────────────────────
  function readConsent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeConsent(c) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  // ──────────────────────────────────────────────────────────────
  // 3. GA4 LOADER — only fires on consent
  // ──────────────────────────────────────────────────────────────
  var ga4Loaded = false;
  function loadGA4() {
    if (ga4Loaded) return;
    if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID.indexOf('XXXXXXXXXX') !== -1) return;
    ga4Loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_MEASUREMENT_ID, { anonymize_ip: true });
  }

  // ──────────────────────────────────────────────────────────────
  // 4. APPLY CONSENT
  // ──────────────────────────────────────────────────────────────
  function applyConsent(c) {
    if (!c) return;
    if (c.analytics) loadGA4();
  }

  // ──────────────────────────────────────────────────────────────
  // 5. WORKING HOURS CHECK (UK time)
  // ──────────────────────────────────────────────────────────────
  function isWorkingHours() {
    // Use UK locale time
    var now = new Date();
    var ukParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(now);
    var weekday = '', hour = 0, minute = 0;
    ukParts.forEach(function (p) {
      if (p.type === 'weekday') weekday = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
    });
    var dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var day = dayMap[weekday];
    if (WORK_DAYS.indexOf(day) === -1) return false;
    if (hour < WORK_START_H) return false;
    if (hour > WORK_END_H) return false;
    if (hour === WORK_END_H && minute > WORK_END_M) return false;
    return true;
  }

  // ──────────────────────────────────────────────────────────────
  // 6. ASK ORION launcher + modal (replaces Tawk)
  // ──────────────────────────────────────────────────────────────
  function showAskOrionLauncher() {
    if (document.getElementById('ask-orion-launcher')) return;
    var btn = document.createElement('button');
    btn.id = 'ask-orion-launcher';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ask Orion — talk to an engineer');
    btn.innerHTML = ''
      + '<span class="ao-icon" aria-hidden="true">'
      +   '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +     '<defs><linearGradient id="aog" x1="0" y1="0" x2="1" y2="1">'
      +       '<stop offset="0" stop-color="#1E90FF"/><stop offset="1" stop-color="#00D5FF"/>'
      +     '</linearGradient></defs>'
      +     '<circle cx="50" cy="50" r="48" fill="none" stroke="url(#aog)" stroke-width="6"/>'
      +     '<path fill="url(#aog)" d="M50 18 L60 42 L86 42 L65 58 L73 84 L50 68 L27 84 L35 58 L14 42 L40 42 Z"/>'
      +   '</svg>'
      + '</span>'
      + '<span class="ao-text"><b>Ask Orion</b><span>Talk to an engineer</span></span>';
    btn.addEventListener('click', openAskOrionModal);
    document.body.appendChild(btn);
  }

  function askOrionModalHTML() {
    var working = isWorkingHours();
    var statusBlock = working
      ? '<div class="ao-status ao-online"><span class="ao-pulse"></span>'
        + '<span><b>Engineers online</b> · we usually reply within the hour during UK working time.</span>'
        + '</div>'
      : '<div class="ao-status ao-offline">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>'
        + '<span><b>Engineers offline.</b> UK working hours 09:00–17:30 Mon–Fri. '
        + 'Leave a message and we will come back the next working day.</span>'
        + '</div>';

    return ''
      + '<div class="ao-modal" role="dialog" aria-modal="true" aria-labelledby="ao-title">'
      +   '<button type="button" class="ao-close" data-ao="close" aria-label="Close">'
      +     '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>'
      +   '</button>'
      +   '<div class="ao-header">'
      +     '<div class="ao-eyebrow">Ask Orion · engineering</div>'
      +     '<h3 id="ao-title">Talk to an <em>engineer</em>.</h3>'
      +     statusBlock
      +   '</div>'
      +   '<form class="ao-form" id="aoForm" action="' + BASIN_ENDPOINT + '" method="POST" novalidate>'
      +     '<input type="hidden" name="_subject" value="Ask Orion enquiry — Orion website">'
      +     '<input type="hidden" name="source" value="Ask Orion modal">'
      +     '<input type="hidden" name="working_hours_at_send" value="' + (working ? 'Yes' : 'No') + '">'
      +     '<input type="hidden" name="_honeypot" value="_honey">'
      +     '<input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">'
      +     '<div class="ao-row">'
      +       '<label class="ao-field">'
      +         '<span class="ao-label">Your name <em>*</em></span>'
      +         '<input type="text" name="name" required autocomplete="name" placeholder="Jane Doe">'
      +       '</label>'
      +       '<label class="ao-field">'
      +         '<span class="ao-label">Company</span>'
      +         '<input type="text" name="company" autocomplete="organization" placeholder="Acme Logistics Ltd">'
      +       '</label>'
      +     '</div>'
      +     '<div class="ao-row">'
      +       '<label class="ao-field">'
      +         '<span class="ao-label">Email <em>*</em></span>'
      +         '<input type="email" name="email" required autocomplete="email" placeholder="jane@acme.co.uk">'
      +       '</label>'
      +       '<label class="ao-field">'
      +         '<span class="ao-label">Phone</span>'
      +         '<input type="tel" name="phone" autocomplete="tel" placeholder="+44 …">'
      +       '</label>'
      +     '</div>'
      +     '<label class="ao-field">'
      +       '<span class="ao-label">What would you like to ask? <em>*</em></span>'
      +       '<textarea name="message" required rows="4" placeholder="Helix sortation throughput, finance routes, conveyor specs, AMR fit for our line — bullet points are fine."></textarea>'
      +     '</label>'
      +     '<button type="submit" class="ao-submit">Send to engineering →</button>'
      +     '<div class="ao-foot">'
      +       'Replies typically within <b>1 working day</b>'
      +       ' · Prefer to call? <a href="tel:+443333355269">+44 333 335 5269</a>'
      +     '</div>'
      +   '</form>'
      +   '<div class="ao-success" hidden>'
      +     '<div class="ao-success-tick">'
      +       '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5 13 10 18 20 7"/></svg>'
      +     '</div>'
      +     '<h3>Sent.</h3>'
      +     '<p>An Orion engineer will come back to you within <b>1 working day</b>. We have logged your enquiry — if it is urgent, give us a call on <a href="tel:+443333355269">+44 333 335 5269</a>.</p>'
      +     '<button type="button" class="ao-submit" data-ao="close">Close</button>'
      +   '</div>'
      + '</div>';
  }

  function openAskOrionModal() {
    if (document.getElementById('ao-modal-backdrop')) return;
    var backdrop = document.createElement('div');
    backdrop.id = 'ao-modal-backdrop';
    backdrop.className = 'ao-modal-backdrop';
    backdrop.innerHTML = askOrionModalHTML();
    document.body.appendChild(backdrop);
    document.documentElement.style.overflow = 'hidden'; // lock scroll under modal
    requestAnimationFrame(function () { backdrop.classList.add('show'); });
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeAskOrionModal();
    });
    backdrop.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ao="close"]');
      if (t) closeAskOrionModal();
    });
    document.addEventListener('keydown', aoEscClose);
    setTimeout(function () {
      var firstInput = backdrop.querySelector('input[name="name"]');
      if (firstInput) firstInput.focus();
    }, 220);
    var form = backdrop.querySelector('#aoForm');
    if (form) form.addEventListener('submit', handleAskOrionSubmit);
  }
  function closeAskOrionModal() {
    var m = document.getElementById('ao-modal-backdrop');
    if (!m) return;
    m.classList.remove('show');
    document.removeEventListener('keydown', aoEscClose);
    setTimeout(function () {
      m.remove();
      document.documentElement.style.overflow = '';
    }, 240);
  }
  function aoEscClose(e) {
    if (e.key === 'Escape' || e.key === 'Esc') closeAskOrionModal();
  }

  function handleAskOrionSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var submitBtn = form.querySelector('.ao-submit');
    var fd = new FormData(form);

    // Basic client-side validation
    var ok = true;
    ['name', 'email', 'message'].forEach(function (k) {
      var el = form.querySelector('[name="' + k + '"]');
      var val = (el && el.value || '').trim();
      if (!val) ok = false;
      if (k === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) ok = false;
      if (el) el.classList.toggle('ao-err', !val || (k === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)));
    });
    if (!ok) return;

    submitBtn.disabled = true;
    var originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';

    // Safety timeout in case Basin hangs
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      alert('That is taking longer than expected. Please email info@orionmis.co.uk directly or call +44 333 335 5269.');
    }, 20000);

    fetch(form.action, {
      method: 'POST',
      body: fd,
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      clearTimeout(timer);
      if (timedOut) return;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Show success state
      form.style.display = 'none';
      var success = form.parentElement.querySelector('.ao-success');
      if (success) success.hidden = false;
    }).catch(function (err) {
      clearTimeout(timer);
      if (timedOut) return;
      console.warn('[Orion] Ask Orion submission failed:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      alert('Sorry — that did not send. Please email info@orionmis.co.uk directly or call +44 333 335 5269.');
    });
  }

  // ──────────────────────────────────────────────────────────────
  // 7. UI — banner + cookie settings dialog + Ask Orion modal styles
  // ──────────────────────────────────────────────────────────────
  var css = ''
    /* COOKIE BANNER */
    + '.cc-banner{position:fixed;bottom:18px;left:18px;right:18px;z-index:9000;max-width:520px;margin-left:auto;background:rgba(7,17,31,.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(0,213,255,.32);border-radius:18px;padding:20px 22px;color:#F7FAFF;font-family:Inter,system-ui,sans-serif;font-size:13.5px;line-height:1.55;box-shadow:0 18px 48px rgba(0,0,0,.5);opacity:0;transform:translateY(20px);transition:opacity .3s,transform .3s}'
    + '.cc-banner.show{opacity:1;transform:none}'
    + '.cc-banner h4{font-size:14px;font-weight:600;margin:0 0 6px;color:#fff;letter-spacing:-.01em}'
    + '.cc-banner p{margin:0 0 14px;color:rgba(247,250,255,.7)}'
    + '.cc-banner a{color:#00D5FF;text-decoration:underline}'
    + '.cc-banner-actions{display:flex;gap:8px;flex-wrap:wrap}'
    + '.cc-btn{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;font-weight:700;border-radius:999px;padding:10px 16px;cursor:pointer;border:1px solid transparent;transition:.15s}'
    + '.cc-btn-primary{background:linear-gradient(135deg,#1E90FF,#00D5FF);color:#00111d;border:0}'
    + '.cc-btn-primary:hover{transform:translateY(-1px)}'
    + '.cc-btn-line{background:transparent;border-color:rgba(255,255,255,.22);color:#fff}'
    + '.cc-btn-line:hover{background:rgba(255,255,255,.06)}'
    + '.cc-btn-text{background:transparent;color:rgba(247,250,255,.6);border:0;padding:10px 8px}'
    + '.cc-btn-text:hover{color:#fff}'

    /* COOKIE SETTINGS MODAL */
    + '.cc-modal-backdrop{position:fixed;inset:0;background:rgba(2,5,10,.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9100;display:none;align-items:center;justify-content:center;padding:18px}'
    + '.cc-modal-backdrop.show{display:flex}'
    + '.cc-modal{max-width:480px;width:100%;background:#07111F;border:1px solid rgba(0,213,255,.28);border-radius:20px;padding:28px;color:#F7FAFF;font-family:Inter,system-ui,sans-serif;font-size:13.5px;line-height:1.55;box-shadow:0 24px 72px rgba(0,0,0,.6)}'
    + '.cc-modal h3{font-size:18px;font-weight:600;margin:0 0 6px;color:#fff;letter-spacing:-.018em}'
    + '.cc-modal p{margin:0 0 18px;color:rgba(247,250,255,.7)}'
    + '.cc-toggle{display:flex;align-items:flex-start;gap:14px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03);margin-bottom:10px}'
    + '.cc-toggle:last-of-type{margin-bottom:18px}'
    + '.cc-toggle-info{flex:1;min-width:0}'
    + '.cc-toggle-info b{display:block;color:#fff;font-size:13.5px;font-weight:600;margin-bottom:2px}'
    + '.cc-toggle-info span{display:block;color:rgba(247,250,255,.6);font-size:12.5px;line-height:1.5}'
    + '.cc-switch{flex-shrink:0;position:relative;width:38px;height:22px;background:rgba(255,255,255,.10);border-radius:999px;cursor:pointer;transition:background .2s}'
    + '.cc-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s}'
    + '.cc-switch.on{background:linear-gradient(135deg,#1E90FF,#00D5FF)}'
    + '.cc-switch.on::after{transform:translateX(16px)}'
    + '.cc-switch.locked{background:rgba(0,213,255,.32);cursor:not-allowed}'
    + '.cc-switch.locked::after{transform:translateX(16px)}'
    + '.cc-modal-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}'
    + '@media(max-width:520px){.cc-banner{left:12px;right:12px;bottom:12px;padding:18px}.cc-modal{padding:22px}}'

    /* ASK ORION LAUNCHER (floating button) */
    + '#ask-orion-launcher{position:fixed;right:20px;bottom:20px;z-index:9500;display:inline-flex;align-items:center;gap:12px;padding:12px 18px 12px 12px;background:linear-gradient(180deg,#111926,#07111F);border:1px solid rgba(0,213,255,.32);border-radius:999px;color:#F7FAFF;font-family:Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.45);transition:transform .18s,box-shadow .18s,border-color .18s;font-size:14px;line-height:1.2}'
    + '#ask-orion-launcher:hover{transform:translateY(-2px);box-shadow:0 16px 42px rgba(0,213,255,.18);border-color:#00D5FF}'
    + '#ask-orion-launcher .ao-icon{flex-shrink:0;width:38px;height:38px;border-radius:50%;background:#02050A;display:inline-flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(0,213,255,.24)}'
    + '#ask-orion-launcher .ao-icon svg{width:24px;height:24px;display:block}'
    + '#ask-orion-launcher .ao-text{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;text-align:left}'
    + '#ask-orion-launcher .ao-text b{font-size:14px;font-weight:700;color:#fff;letter-spacing:-.01em}'
    + '#ask-orion-launcher .ao-text span{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(247,250,255,.6);margin-top:2px}'
    + '@media(max-width:520px){#ask-orion-launcher{right:14px;bottom:14px;padding:10px 16px 10px 10px;gap:10px}#ask-orion-launcher .ao-icon{width:34px;height:34px}#ask-orion-launcher .ao-icon svg{width:20px;height:20px}#ask-orion-launcher .ao-text b{font-size:13px}#ask-orion-launcher .ao-text span{font-size:9px}}'

    /* ASK ORION MODAL */
    + '.ao-modal-backdrop{position:fixed;inset:0;background:rgba(2,5,10,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9600;display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .25s;font-family:Inter,system-ui,sans-serif}'
    + '.ao-modal-backdrop.show{opacity:1}'
    + '.ao-modal{position:relative;max-width:540px;width:100%;max-height:92vh;overflow-y:auto;background:linear-gradient(180deg,#0B1626 0%,#07111F 100%);border:1px solid rgba(0,213,255,.32);border-radius:22px;padding:28px;color:#F7FAFF;box-shadow:0 30px 90px rgba(0,0,0,.6);transform:scale(.96);transition:transform .25s ease}'
    + '.ao-modal-backdrop.show .ao-modal{transform:scale(1)}'
    + '.ao-close{position:absolute;top:14px;right:14px;background:transparent;border:1px solid rgba(255,255,255,.12);color:rgba(247,250,255,.6);width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;padding:0}'
    + '.ao-close svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round}'
    + '.ao-close:hover{background:rgba(255,255,255,.06);color:#fff;border-color:rgba(255,255,255,.22)}'
    + '.ao-header{margin-bottom:18px;padding-right:36px}'
    + '.ao-eyebrow{font-family:"JetBrains Mono",monospace;font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#00D5FF;margin-bottom:10px}'
    + '.ao-modal h3{font-size:24px;font-weight:600;color:#fff;letter-spacing:-.024em;margin-bottom:14px;line-height:1.1;font-family:Inter,system-ui,sans-serif}'
    + '.ao-modal h3 em{font-style:italic;font-weight:400;color:#00D5FF;font-family:"DM Serif Display",Georgia,serif}'
    + '.ao-status{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:12px;font-family:Inter,system-ui,sans-serif;font-size:12.5px;line-height:1.5}'
    + '.ao-status b{color:#fff;font-weight:600}'
    + '.ao-status.ao-online{color:rgba(247,250,255,.85);background:rgba(50,213,131,.07);border:1px solid rgba(50,213,131,.30)}'
    + '.ao-status.ao-online b{color:#32D583}'
    + '.ao-status.ao-offline{color:rgba(247,250,255,.85);background:rgba(253,176,34,.06);border:1px solid rgba(253,176,34,.32)}'
    + '.ao-status.ao-offline b{color:#FDB022}'
    + '.ao-status.ao-offline svg{width:16px;height:16px;stroke:#FDB022;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;margin-top:1px}'
    + '.ao-pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:#32D583;box-shadow:0 0 10px #32D583;flex-shrink:0;margin-top:5px;animation:aoPulse 2s ease-in-out infinite}'
    + '@keyframes aoPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}'

    /* ASK ORION FORM */
    + '.ao-form{display:flex;flex-direction:column;gap:0}'
    + '.ao-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '.ao-field{display:flex;flex-direction:column;gap:6px;margin-top:14px}'
    + '.ao-row .ao-field{margin-top:14px}'
    + '.ao-label{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(247,250,255,.6)}'
    + '.ao-label em{color:#00D5FF;font-style:normal;font-weight:700;margin-left:2px}'
    + '.ao-form input,.ao-form textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:11px 14px;font-family:Inter,system-ui,sans-serif;font-size:14px;color:#fff;transition:border-color .2s,background .2s;-webkit-font-smoothing:antialiased}'
    + '.ao-form input::placeholder,.ao-form textarea::placeholder{color:rgba(247,250,255,.30)}'
    + '.ao-form input:focus,.ao-form textarea:focus{outline:none;border-color:#00D5FF;background:rgba(0,213,255,.04)}'
    + '.ao-form input.ao-err,.ao-form textarea.ao-err{border-color:rgba(255,107,107,.6);background:rgba(255,107,107,.06)}'
    + '.ao-form textarea{min-height:90px;resize:vertical;line-height:1.5;font-family:Inter,system-ui,sans-serif}'
    + '.ao-submit{margin-top:20px;background:linear-gradient(135deg,#1E90FF,#00D5FF);color:#00111d;border:0;border-radius:999px;padding:14px 22px;font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:transform .15s,box-shadow .15s;align-self:stretch}'
    + '.ao-submit:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(0,213,255,.28)}'
    + '.ao-submit:disabled{opacity:.65;cursor:wait;transform:none}'
    + '.ao-foot{margin-top:16px;font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.06em;color:rgba(247,250,255,.5);text-align:center;line-height:1.6}'
    + '.ao-foot b{color:#fff;font-weight:700}'
    + '.ao-foot a{color:#00D5FF;text-decoration:none;border-bottom:1px solid rgba(0,213,255,.4);padding-bottom:1px}'
    + '.ao-foot a:hover{color:#fff;border-bottom-color:#fff}'

    /* ASK ORION SUCCESS STATE */
    + '.ao-success{text-align:center;padding:8px 4px}'
    + '.ao-success-tick{width:64px;height:64px;border-radius:50%;background:rgba(50,213,131,.10);border:1px solid rgba(50,213,131,.40);margin:0 auto 16px;display:flex;align-items:center;justify-content:center}'
    + '.ao-success-tick svg{width:32px;height:32px;stroke:#32D583;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round}'
    + '.ao-success h3{font-size:22px;color:#fff;margin-bottom:8px}'
    + '.ao-success p{color:rgba(247,250,255,.72);font-size:14px;line-height:1.55;margin-bottom:22px}'
    + '.ao-success a{color:#00D5FF;text-decoration:none;border-bottom:1px solid rgba(0,213,255,.4)}'
    + '@media(max-width:560px){.ao-modal{padding:24px 20px;max-height:95vh}.ao-modal h3{font-size:20px}.ao-row{grid-template-columns:1fr;gap:0}}';

  function injectCss() {
    if (document.getElementById('cc-styles')) return;
    var st = document.createElement('style');
    st.id = 'cc-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function bannerHTML() {
    return ''
      + '<h4>Cookies on orionmis.co.uk</h4>'
      + '<p>We use essential cookies to make the site work. With your OK we also use anonymised analytics — see our <a href="privacy.html">privacy policy</a>.</p>'
      + '<div class="cc-banner-actions">'
      +   '<button type="button" class="cc-btn cc-btn-primary" data-cc="accept-all">Accept all</button>'
      +   '<button type="button" class="cc-btn cc-btn-line" data-cc="reject">Essential only</button>'
      +   '<button type="button" class="cc-btn cc-btn-text" data-cc="customise">Customise</button>'
      + '</div>';
  }

  function modalHTML(current) {
    var a = current && current.analytics;
    return ''
      + '<div class="cc-modal">'
      +   '<h3>Cookie settings</h3>'
      +   '<p>Pick which categories you\'re OK with. You can change this any time using the link in the footer.</p>'
      +   '<div class="cc-toggle">'
      +     '<div class="cc-toggle-info"><b>Essential</b><span>Required for the site to work, remembering your cookie choice and form submissions. Always on.</span></div>'
      +     '<div class="cc-switch locked" aria-disabled="true" title="Essential cookies are always on"></div>'
      +   '</div>'
      +   '<div class="cc-toggle">'
      +     '<div class="cc-toggle-info"><b>Analytics</b><span>Anonymised page-view stats (Google Analytics 4) so we can see which pages are useful.</span></div>'
      +     '<div class="cc-switch ' + (a ? 'on' : '') + '" data-cc-toggle="analytics" role="switch" aria-checked="' + (a ? 'true' : 'false') + '" tabindex="0"></div>'
      +   '</div>'
      +   '<div class="cc-modal-actions">'
      +     '<button type="button" class="cc-btn cc-btn-line" data-cc="close">Cancel</button>'
      +     '<button type="button" class="cc-btn cc-btn-primary" data-cc="save">Save preferences</button>'
      +   '</div>'
      + '</div>';
  }

  function showBanner() {
    if (document.getElementById('cc-banner')) return;
    var div = document.createElement('div');
    div.className = 'cc-banner';
    div.id = 'cc-banner';
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', 'Cookie consent');
    div.innerHTML = bannerHTML();
    document.body.appendChild(div);
    requestAnimationFrame(function () { div.classList.add('show'); });
  }
  function hideBanner() {
    var b = document.getElementById('cc-banner');
    if (b) b.remove();
  }

  function showModal(initial) {
    var backdrop = document.getElementById('cc-modal-backdrop');
    if (backdrop) backdrop.remove();
    backdrop = document.createElement('div');
    backdrop.className = 'cc-modal-backdrop show';
    backdrop.id = 'cc-modal-backdrop';
    backdrop.innerHTML = modalHTML(initial || { analytics: false });
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });
  }
  function closeModal() {
    var m = document.getElementById('cc-modal-backdrop');
    if (m) m.remove();
  }

  function persistAndApply(c) {
    writeConsent(c);
    applyConsent(c);
    hideBanner();
    closeModal();
  }

  // expose for footer links
  window.openCookieSettings = function () {
    var current = readConsent() || { analytics: false };
    showModal(current);
  };

  // ──────────────────────────────────────────────────────────────
  // 8. EVENT WIRING (cookie banner only — Ask Orion has its own)
  // ──────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;
    var action = t.dataset.cc;
    if (action === 'accept-all')   persistAndApply({ analytics: true });
    else if (action === 'reject')  persistAndApply({ analytics: false });
    else if (action === 'customise') {
      hideBanner();
      showModal(readConsent() || { analytics: false });
    }
    else if (action === 'close') closeModal();
    else if (action === 'save') {
      var modal = document.getElementById('cc-modal-backdrop');
      if (!modal) return;
      var a = modal.querySelector('[data-cc-toggle="analytics"]').classList.contains('on');
      persistAndApply({ analytics: a });
    }
    else if (t.dataset.ccToggle) {
      if (t.classList.contains('locked')) return;
      var on = t.classList.toggle('on');
      t.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 9. INIT
  // ──────────────────────────────────────────────────────────────
  function init() {
    injectCss();
    showAskOrionLauncher(); // ALWAYS show — no cookie consent needed (no tracking, no third-party widget)
    var c = readConsent();
    if (c) {
      applyConsent(c);
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
