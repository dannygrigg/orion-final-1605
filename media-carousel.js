/* ──────────────────────────────────────────────────────────────────────
   ORION MEDIA CAROUSEL · v1
   ──────────────────────────────────────────────────────────────────────
   Drop a placeholder anywhere on a page:
     <div class="media-slot" data-slot="hero-home"></div>

   This script loads /media.json, finds each placeholder, and renders a
   carousel with the matching slot's items. Supports:
     • Images (with subtle Ken Burns zoom)
     • Videos (YouTube/Vimeo embed + direct .mp4)
     • Auto-advance (configurable per slot)
     • Navigation arrows + dots
     • Swipe (mobile)
     • Pause on hover
     • Smooth slide transitions

   Aspect ratio defaults to 16:9 but each slot can override.
   ──────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  const CONFIG_URL = 'media.json';
  const FALLBACK_INTERVAL = 6000;
  const TRANSITION_MS = 600;

  // ── INJECT STYLES ──────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('orion-media-styles')) return;
    const css = `
      .media-slot{position:relative;width:100%;background:#07111F;border-radius:18px;overflow:hidden;border:1px solid rgba(0,213,255,0.18)}
      .media-slot.is-empty{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0B1626,#1b3152)}
      .media-slot.is-empty:after{content:attr(data-slot);font-family:Consolas,Monaco,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(247,250,255,0.4)}
      .mc-stage{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden}
      .mc-track{position:absolute;inset:0;display:flex;transition:transform ${TRANSITION_MS}ms cubic-bezier(0.65, 0, 0.35, 1)}
      .mc-slide{flex:0 0 100%;position:relative;width:100%;height:100%;overflow:hidden;background:#000}
      .mc-slide img,.mc-slide video,.mc-slide iframe{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border:0;display:block}
      .mc-slide.has-kenburns img{animation:mc-kenburns 18s ease-in-out infinite alternate}
      @keyframes mc-kenburns{0%{transform:scale(1.0) translate(0,0)}100%{transform:scale(1.08) translate(-2%,-1%)}}
      .mc-caption{position:absolute;left:0;right:0;bottom:0;padding:18px 22px 20px;background:linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 100%);color:#fff;pointer-events:none}
      .mc-caption strong{font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400;display:block;margin-bottom:2px}
      .mc-caption span{font-family:Consolas,Monaco,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#00D5FF}
      .mc-arrows{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;pointer-events:none;padding:0 14px}
      .mc-arrow{pointer-events:auto;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;font-family:inherit}
      .mc-arrow:hover{background:rgba(0,213,255,0.6);color:#00111d;transform:scale(1.06)}
      .mc-dots{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:7px;z-index:3}
      .mc-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.4);border:0;padding:0;cursor:pointer;transition:width .25s,background .25s}
      .mc-dot.active{width:22px;border-radius:999px;background:#00D5FF;box-shadow:0 0 10px rgba(0,213,255,0.6)}
      .mc-progress{position:absolute;left:0;right:0;top:0;height:2px;background:rgba(255,255,255,0.06);z-index:3}
      .mc-progress-bar{height:100%;width:0;background:linear-gradient(90deg,#1E90FF,#00D5FF);transition:width 60ms linear}
      .media-slot[data-aspect="4:3"] .mc-stage{aspect-ratio:4/3}
      .media-slot[data-aspect="1:1"] .mc-stage{aspect-ratio:1/1}
      .media-slot[data-aspect="3:1"] .mc-stage{aspect-ratio:3/1}
      .media-slot[data-aspect="21:9"] .mc-stage{aspect-ratio:21/9}
      @media(max-width:640px){.mc-arrow{width:36px;height:36px;font-size:15px}.mc-caption{padding:14px 16px 18px}.mc-caption strong{font-size:15px}}
    `;
    const style = document.createElement('style');
    style.id = 'orion-media-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── HELPERS ────────────────────────────────────────────────────────
  function isYouTube(url) {
    return /(?:youtube\.com|youtu\.be)/i.test(url);
  }
  function isVimeo(url) {
    return /vimeo\.com/i.test(url);
  }
  function isVideoFile(url) {
    return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  }
  function isImage(url) {
    return /\.(jpg|jpeg|png|gif|webp|avif|svg|heic)(\?|$)/i.test(url) || url.startsWith('data:image/');
  }

  function youtubeEmbed(url) {
    let id = '';
    const m1 = url.match(/[?&]v=([^&]+)/);
    const m2 = url.match(/youtu\.be\/([^?&]+)/);
    const m3 = url.match(/youtube\.com\/embed\/([^?&]+)/);
    if (m1) id = m1[1];
    else if (m2) id = m2[1];
    else if (m3) id = m3[1];
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;
  }

  function vimeoEmbed(url) {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (!m) return url;
    return `https://player.vimeo.com/video/${m[1]}?background=1&autoplay=1&loop=1&muted=1`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildSlideHTML(item) {
    const url = item.url || '';
    const alt = escapeHtml(item.alt || '');
    const caption = item.caption || item.alt || '';
    const tag = item.tag || '';
    const captionBlock = (caption || tag) ? `<div class="mc-caption">${tag ? `<span>${escapeHtml(tag)}</span>` : ''}${caption ? `<strong>${escapeHtml(caption)}</strong>` : ''}</div>` : '';

    if (item.type === 'image' || isImage(url)) {
      return `<div class="mc-slide has-kenburns"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy">${captionBlock}</div>`;
    }
    if (item.type === 'youtube' || isYouTube(url)) {
      return `<div class="mc-slide"><iframe src="${escapeHtml(youtubeEmbed(url))}" allow="autoplay;encrypted-media" allowfullscreen></iframe>${captionBlock}</div>`;
    }
    if (item.type === 'vimeo' || isVimeo(url)) {
      return `<div class="mc-slide"><iframe src="${escapeHtml(vimeoEmbed(url))}" allow="autoplay;encrypted-media" allowfullscreen></iframe>${captionBlock}</div>`;
    }
    if (item.type === 'video' || isVideoFile(url)) {
      return `<div class="mc-slide"><video src="${escapeHtml(url)}" autoplay muted loop playsinline></video>${captionBlock}</div>`;
    }
    return `<div class="mc-slide"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy">${captionBlock}</div>`;
  }

  // ── CAROUSEL RENDERER ──────────────────────────────────────────────
  function renderCarousel(host, slotConfig) {
    if (!slotConfig || !slotConfig.items || slotConfig.items.length === 0) {
      host.classList.add('is-empty');
      return;
    }
    host.classList.remove('is-empty');

    const items = slotConfig.items;
    const interval = slotConfig.interval || FALLBACK_INTERVAL;
    const autoplay = slotConfig.autoplay !== false; // default true
    const showArrows = items.length > 1 && slotConfig.arrows !== false;
    const showDots = items.length > 1 && slotConfig.dots !== false;
    const showProgress = items.length > 1 && autoplay && slotConfig.progress !== false;

    host.innerHTML = `
      <div class="mc-stage">
        ${showProgress ? `<div class="mc-progress"><div class="mc-progress-bar"></div></div>` : ''}
        <div class="mc-track">${items.map(buildSlideHTML).join('')}</div>
        ${showArrows ? `
          <div class="mc-arrows">
            <button class="mc-arrow mc-prev" aria-label="Previous">‹</button>
            <button class="mc-arrow mc-next" aria-label="Next">›</button>
          </div>
        ` : ''}
        ${showDots ? `<div class="mc-dots">${items.map((_, i) => `<button class="mc-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}</div>` : ''}
      </div>
    `;

    const track = host.querySelector('.mc-track');
    const dots = host.querySelectorAll('.mc-dot');
    const progressBar = host.querySelector('.mc-progress-bar');
    let current = 0;
    let timer = null;
    let progressTimer = null;
    let progressPct = 0;

    function go(i) {
      current = ((i % items.length) + items.length) % items.length;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
      resetProgress();
    }
    function resetProgress() {
      if (!progressBar) return;
      progressPct = 0;
      progressBar.style.width = '0%';
    }
    function startAutoplay() {
      if (!autoplay || items.length < 2) return;
      stopAutoplay();
      timer = setInterval(() => go(current + 1), interval);
      if (progressBar) {
        const step = 60 / interval * 100;
        progressTimer = setInterval(() => {
          progressPct = Math.min(100, progressPct + step);
          progressBar.style.width = progressPct + '%';
        }, 60);
      }
    }
    function stopAutoplay() {
      if (timer) { clearInterval(timer); timer = null; }
      if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    }

    // Arrows
    const prev = host.querySelector('.mc-prev');
    const next = host.querySelector('.mc-next');
    if (prev) prev.addEventListener('click', () => { go(current - 1); startAutoplay(); });
    if (next) next.addEventListener('click', () => { go(current + 1); startAutoplay(); });

    // Dots
    dots.forEach(dot => {
      dot.addEventListener('click', () => { go(+dot.dataset.i); startAutoplay(); });
    });

    // Pause on hover
    host.addEventListener('mouseenter', stopAutoplay);
    host.addEventListener('mouseleave', startAutoplay);

    // Swipe
    let touchStartX = 0;
    let touchEndX = 0;
    host.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; stopAutoplay(); }, { passive: true });
    host.addEventListener('touchmove', (e) => { touchEndX = e.touches[0].clientX; }, { passive: true });
    host.addEventListener('touchend', () => {
      const dx = touchEndX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) go(current + 1); else go(current - 1);
      }
      startAutoplay();
    });

    // Pause when off-screen (saves CPU)
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => { e.isIntersecting ? startAutoplay() : stopAutoplay(); });
      }, { threshold: 0.2 });
      io.observe(host);
    } else {
      startAutoplay();
    }
  }

  // ── LOAD + INIT ────────────────────────────────────────────────────
  function init(config) {
    const slots = document.querySelectorAll('.media-slot[data-slot]');
    if (!slots.length) return;
    injectStyles();
    const slotConfigs = (config && config.slots) || {};
    slots.forEach(host => {
      const name = host.dataset.slot;
      renderCarousel(host, slotConfigs[name]);
    });
  }

  function loadAndInit() {
    // Allow inline override via window.ORION_MEDIA (set before script loads)
    if (window.ORION_MEDIA && window.ORION_MEDIA.slots) {
      init(window.ORION_MEDIA);
      return;
    }
    fetch(CONFIG_URL, { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : { slots: {} })
      .then(init)
      .catch(() => init({ slots: {} }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndInit);
  } else {
    loadAndInit();
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────
  window.OrionMedia = {
    refresh: loadAndInit,
    renderSlot: function (slotName, slotConfig) {
      const host = document.querySelector(`.media-slot[data-slot="${slotName}"]`);
      if (host) renderCarousel(host, slotConfig);
    }
  };
})();
