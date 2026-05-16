// ════════════════════════════════════════════════════════════════
// ORION MIS — shared site scripts
// Drop-in for every public page: cookie banner + GA4 + Tawk chat.
// Replace the three placeholder IDs below before going live.
// ════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. CONFIG — replace placeholders before deployment
  // ──────────────────────────────────────────────────────────────
  var GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';       // e.g. 'G-1A2B3C4D5E'
  var TAWK_PROPERTY_ID   = '69bab551f1726d1c37ecec82';   // 24-char hex from tawk.to admin
  var TAWK_WIDGET_ID     = '1jk0l8hp5';                  // widget ID from tawk.to admin
  var STORAGE_KEY        = 'orion_cookie_consent_v1';

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
  // 3. GA4 + TAWK LOADERS — only fire on consent
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

  var tawkLoaded = false;
  var tawkReady = false;
  function loadTawk() {
    if (tawkLoaded) return;
    if (!TAWK_PROPERTY_ID || TAWK_PROPERTY_ID === 'TAWK_PROPERTY_ID') return;
    tawkLoaded = true;
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    window.Tawk_API.onLoad = function () {
      tawkReady = true;
      try { window.Tawk_API.hideWidget(); } catch (e) {}
      console.log('[Orion] Tawk loaded and ready');
    };
    window.Tawk_API.onStatusChange = function (status) {
      console.log('[Orion] Tawk status: ' + status);
    };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://embed.tawk.to/' + TAWK_PROPERTY_ID + '/' + TAWK_WIDGET_ID;
    s.charset = 'UTF-8';
    s.setAttribute('crossorigin', '*');
    s.onerror = function () { console.warn('[Orion] Tawk script failed to load — domain may not be whitelisted'); };
    document.head.appendChild(s);
  }

  // ── ASK ORION custom launcher ────────────────────────────────
  function openOrionChat() {
    if (window.Tawk_API && tawkReady && typeof window.Tawk_API.maximize === 'function') {
      try {
        window.Tawk_API.showWidget();
        setTimeout(function () {
          try { window.Tawk_API.maximize(); } catch (e) { fallbackContact(); }
        }, 60);
        return;
      } catch (e) {}
    }
    // Tawk not loaded yet — try one short wait then fall back
    if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      try {
        window.Tawk_API.showWidget();
        window.Tawk_API.maximize();
        return;
      } catch (e) {}
    }
    fallbackContact();
  }
  function fallbackContact() {
    console.warn('[Orion] Tawk not available — falling back to mailto');
    window.location.href = 'mailto:info@orionmis.co.uk?subject=Website%20enquiry%20%E2%80%94%20Ask%20Orion';
  }

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
    btn.addEventListener('click', openOrionChat);
    document.body.appendChild(btn);
  }

  // ──────────────────────────────────────────────────────────────
  // 4. APPLY CONSENT
  // ──────────────────────────────────────────────────────────────
  function applyConsent(c) {
    if (!c) return;
    if (c.analytics) loadGA4();
    if (c.chat) loadTawk();
    // Show our custom launcher whenever cookies have been chosen — never
    // gate it on Tawk loading so it always works (falls back to mailto if Tawk fails)
    showAskOrionLauncher();
  }

  // ──────────────────────────────────────────────────────────────
  // 5. UI — banner + settings dialog
  // ──────────────────────────────────────────────────────────────
  var css = ''
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

    /* ── Ask Orion custom launcher ── */
    + '#ask-orion-launcher{position:fixed;right:20px;bottom:20px;z-index:9500;display:inline-flex;align-items:center;gap:12px;padding:12px 18px 12px 12px;background:linear-gradient(180deg,#111926,#07111F);border:1px solid rgba(0,213,255,.32);border-radius:999px;color:#F7FAFF;font-family:Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.45);transition:transform .18s,box-shadow .18s,border-color .18s;font-size:14px;line-height:1.2}'
    + '#ask-orion-launcher:hover{transform:translateY(-2px);box-shadow:0 16px 42px rgba(0,213,255,.18);border-color:#00D5FF}'
    + '#ask-orion-launcher .ao-icon{flex-shrink:0;width:38px;height:38px;border-radius:50%;background:#02050A;display:inline-flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(0,213,255,.24)}'
    + '#ask-orion-launcher .ao-icon svg{width:24px;height:24px;display:block}'
    + '#ask-orion-launcher .ao-text{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;text-align:left}'
    + '#ask-orion-launcher .ao-text b{font-size:14px;font-weight:700;color:#fff;letter-spacing:-.01em}'
    + '#ask-orion-launcher .ao-text span{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(247,250,255,.6);margin-top:2px}'
    + '@media(max-width:520px){#ask-orion-launcher{right:14px;bottom:14px;padding:10px 16px 10px 10px;gap:10px}#ask-orion-launcher .ao-icon{width:34px;height:34px}#ask-orion-launcher .ao-icon svg{width:20px;height:20px}#ask-orion-launcher .ao-text b{font-size:13px}#ask-orion-launcher .ao-text span{font-size:9px}}';

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
      + '<p>We use essential cookies to make the site work. With your OK we also use analytics and live chat cookies — see our <a href="privacy.html">privacy policy</a>.</p>'
      + '<div class="cc-banner-actions">'
      +   '<button type="button" class="cc-btn cc-btn-primary" data-cc="accept-all">Accept all</button>'
      +   '<button type="button" class="cc-btn cc-btn-line" data-cc="reject">Essential only</button>'
      +   '<button type="button" class="cc-btn cc-btn-text" data-cc="customise">Customise</button>'
      + '</div>';
  }

  function modalHTML(current) {
    var a = current && current.analytics, c = current && current.chat;
    return ''
      + '<div class="cc-modal">'
      +   '<h3>Cookie settings</h3>'
      +   '<p>Pick which categories you\'re OK with. You can change this any time using the link in the footer.</p>'
      +   '<div class="cc-toggle">'
      +     '<div class="cc-toggle-info"><b>Essential</b><span>Required for the site to work, remembering your cookie choice, form submissions. Always on.</span></div>'
      +     '<div class="cc-switch locked" aria-disabled="true" title="Essential cookies are always on"></div>'
      +   '</div>'
      +   '<div class="cc-toggle">'
      +     '<div class="cc-toggle-info"><b>Analytics</b><span>Anonymised page-view stats (Google Analytics 4) so we can see which pages are useful.</span></div>'
      +     '<div class="cc-switch ' + (a ? 'on' : '') + '" data-cc-toggle="analytics" role="switch" aria-checked="' + (a ? 'true' : 'false') + '" tabindex="0"></div>'
      +   '</div>'
      +   '<div class="cc-toggle">'
      +     '<div class="cc-toggle-info"><b>Live chat</b><span>Loads the chat widget so you can message us in real time. Off by default.</span></div>'
      +     '<div class="cc-switch ' + (c ? 'on' : '') + '" data-cc-toggle="chat" role="switch" aria-checked="' + (c ? 'true' : 'false') + '" tabindex="0"></div>'
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
    backdrop.innerHTML = modalHTML(initial || { analytics: false, chat: false });
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
    var current = readConsent() || { analytics: false, chat: false };
    showModal(current);
  };

  // ──────────────────────────────────────────────────────────────
  // 6. EVENT WIRING
  // ──────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;
    var action = t.dataset.cc;
    if (action === 'accept-all')   persistAndApply({ analytics: true, chat: true });
    else if (action === 'reject')  persistAndApply({ analytics: false, chat: false });
    else if (action === 'customise') {
      hideBanner();
      showModal(readConsent() || { analytics: false, chat: false });
    }
    else if (action === 'close') closeModal();
    else if (action === 'save') {
      var modal = document.getElementById('cc-modal-backdrop');
      if (!modal) return;
      var a = modal.querySelector('[data-cc-toggle="analytics"]').classList.contains('on');
      var c = modal.querySelector('[data-cc-toggle="chat"]').classList.contains('on');
      persistAndApply({ analytics: a, chat: c });
    }
    else if (t.dataset.ccToggle) {
      if (t.classList.contains('locked')) return;
      var on = t.classList.toggle('on');
      t.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 7. INIT — apply stored consent, otherwise show banner
  // ──────────────────────────────────────────────────────────────
  function init() {
    injectCss();
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
