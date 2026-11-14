/* Orion live-footage reels: plays <video data-reel> only while on screen.
   Phones get the 720p file. Visitors who ask for reduced motion, or have
   data saver on, keep the still poster. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
  if (navigator.connection && navigator.connection.saveData) { return; }
  if (!('IntersectionObserver' in window)) { return; }
  var small = window.innerWidth < 768;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src) { v.src = small ? v.dataset.srcSm : v.dataset.srcLg; }
        var p = v.play(); if (p && p.catch) { p.catch(function () {}); }
      } else if (v.src) { v.pause(); }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll('video[data-reel]').forEach(function (v) { io.observe(v); });
})();
