/* ─────────────────────────────────────────────────────────────────────────
   ORION GUIDES · the Ask Orion router + assistant team
   Barry (design) · Penny (ROI & finance) · Comet (Helios) · Liam (engineer)
   Lazy-loaded by site.js when the launcher (or a page nudge) is clicked.
   Exposes window.OrionGuides.open(guide, opts)
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.OrionGuides) return;

  var BASIN = 'https://usebasin.com/f/d04288a27fc6';
  var BOOKINGS_URL = ''; // ← Microsoft Bookings page URL goes here when created

  var GUIDES = {
    barry: { name: 'Barry', role: 'Helix & sorter designer', img: 'images/barrie-head.png' },
    penny: { name: 'Penny', role: 'ROI & finance', img: 'images/penny-head.png' },
    comet: { name: 'Comet', role: 'Helios guide', img: 'images/comet-head.png' },
    liam:  { name: 'Liam',  role: 'Talk to an engineer', img: 'images/liam-head.png' }
  };

  // One cohesive visitor document, shared by all guides, survives page moves
  // (sessionStorage). Every discovery answer lands here tagged by guide, and
  // the whole journey rides along with any form the visitor eventually sends.
  var currentGuide = null;
  function prof() { try { return JSON.parse(sessionStorage.getItem('og-profile') || '[]'); } catch (e) { return []; } }
  function addProf(text) {
    var name = (GUIDES[currentGuide] ? GUIDES[currentGuide].name : 'Site');
    var entry = name + ': ' + text;
    var p = prof();
    if (p.indexOf(entry) === -1) { p.push(entry); try { sessionStorage.setItem('og-profile', JSON.stringify(p)); } catch (e) {} }
  }
  function profFor(guideName) {
    return prof().filter(function (e) { return e.indexOf(guideName + ': ') === 0; })
      .map(function (e) { return e.slice(guideName.length + 2); });
  }
  var panel, body, head;

  // ── styles ──────────────────────────────────────────────────────────────
  var css = ''
    + '#og-panel{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:100vw;z-index:9600;background:linear-gradient(180deg,#0b1626,#081120);border-left:1px solid rgba(0,213,255,.2);box-shadow:-20px 0 60px rgba(0,0,0,.5);display:flex;flex-direction:column;transform:translateX(102%);transition:transform .3s cubic-bezier(.4,0,.2,1);font-family:Inter,system-ui,sans-serif}'
    + '#og-panel.show{transform:none}'
    + '.og-h{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}'
    + '.og-h img,.og-h .og-star{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#02050A;box-shadow:inset 0 0 0 1px rgba(0,213,255,.26)}'
    + '.og-h .og-star{display:flex;align-items:center;justify-content:center;color:#00D5FF;font-size:16px}'
    + '.og-h b{color:#fff;font-size:14.5px;letter-spacing:-.01em}'
    + '.og-h small{display:block;color:rgba(231,238,247,.55);font-size:10.5px;font-family:"JetBrains Mono",monospace;letter-spacing:.05em}'
    + '.og-h .og-bk{background:none;border:none;color:#00D5FF;font-size:13px;cursor:pointer;padding:2px 6px;font-weight:600}'
    + '.og-h .og-x{margin-left:auto;background:none;border:none;color:rgba(231,238,247,.6);font-size:22px;cursor:pointer;line-height:1;padding:2px 6px}'
    + '.og-b{flex:1;overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch}'
    + '.og-lead{color:#fff;font-size:16px;font-weight:600;margin:2px 0 4px;letter-spacing:-.01em}'
    + '.og-sub{color:rgba(231,238,247,.6);font-size:12.5px;margin-bottom:16px;line-height:1.5}'
    + '.og-card{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:12px 13px;margin-bottom:10px;cursor:pointer;transition:.15s;color:#e7eef7;font-family:inherit}'
    + '.og-card:hover{background:rgba(0,213,255,.07);border-color:rgba(0,213,255,.4);transform:translateY(-1px)}'
    + '.og-card img{width:46px;height:46px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#0d1b2e;box-shadow:inset 0 0 0 1px rgba(0,213,255,.2)}'
    + '.og-card .t b{display:block;color:#fff;font-size:14px;font-weight:650;letter-spacing:-.01em}'
    + '.og-card .t span{display:block;color:rgba(231,238,247,.55);font-size:11.5px;margin-top:1px}'
    + '.og-card .t em{color:#8fe9ff;font-style:normal}'
    + '.og-card .go{margin-left:auto;color:rgba(0,213,255,.7);font-size:17px}'
    + '.og-msgs{display:flex;flex-direction:column;gap:10px}'
    + '.og-m{max-width:88%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.55}'
    + '.og-m.bot{align-self:flex-start;background:rgba(255,255,255,.06);color:#e7eef7;border-bottom-left-radius:5px}'
    + '.og-m.me{align-self:flex-end;background:linear-gradient(180deg,#00D5FF,#1E90FF);color:#02121a;font-weight:600;border-bottom-right-radius:5px}'
    + '.og-m.bot b{color:#fff}.og-m.bot em{color:#8fe9ff;font-style:normal}'
    + '.og-feat{align-self:flex-start;max-width:94%;background:rgba(0,213,255,.06);border:1px solid rgba(0,213,255,.25);border-radius:12px;padding:11px 13px}'
    + '.og-feat b{display:block;color:#fff;font-size:12.5px;margin-bottom:3px}'
    + '.og-feat span{color:rgba(231,238,247,.75);font-size:12px;line-height:1.5;display:block}'
    + '.og-feat .tg{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#8fe9ff;border:1px solid rgba(0,213,255,.3);border-radius:4px;padding:1.5px 5px;margin-bottom:6px}'
    + '.og-prof{align-self:stretch;background:rgba(67,212,119,.07);border:1px solid rgba(67,212,119,.35);border-radius:12px;padding:12px 14px}'
    + '.og-prof b{color:#fff;font-size:12.5px;display:block;margin-bottom:6px}'
    + '.og-prof li{color:rgba(231,238,247,.8);font-size:12px;line-height:1.7;margin-left:16px}'
    + '.og-ctrls{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}'
    + '.og-chip{background:rgba(0,213,255,.08);border:1px solid rgba(0,213,255,.4);color:#bfefff;border-radius:999px;padding:8px 13px;font-size:12.5px;cursor:pointer;font-weight:600;font-family:inherit;transition:.15s}'
    + '.og-chip:hover{background:rgba(0,213,255,.18)}'
    + '.og-cta{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(180deg,#00D5FF,#1E90FF);color:#02121a;border:none;border-radius:10px;padding:10px 15px;font-size:13px;font-weight:700;cursor:pointer;margin:4px 6px 0 0;text-decoration:none;font-family:inherit}'
    + '.og-cta.sec{background:rgba(255,255,255,.06);color:#e7eef7;border:1px solid rgba(255,255,255,.14)}'
    + '.og-cap{margin-top:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:13px}'
    + '.og-cap input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:9px 11px;color:#fff;font-size:13px;margin-bottom:8px;font-family:inherit;outline:none}'
    + '.og-cap input:focus{border-color:#00D5FF}'
    + '.og-cap input.err{border-color:#ff5a6a}'
    + '.og-book{margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid rgba(0,213,255,.3)}'
    + '.og-book iframe{width:100%;height:420px;border:0;display:block;background:#fff}'
    + '.og-note{color:rgba(231,238,247,.45);font-size:10.5px;margin-top:10px;line-height:1.5}'
    + '#og-nudge{position:fixed;right:20px;bottom:88px;z-index:9550;max-width:296px;background:linear-gradient(180deg,#101c2e,#0a1524);border:1px solid rgba(0,213,255,.4);border-radius:16px 16px 4px 16px;padding:13px 15px;box-shadow:0 16px 44px rgba(0,0,0,.55);opacity:0;transform:translateY(14px);transition:.35s;font-family:Inter,system-ui,sans-serif}'
    + '#og-nudge.show{opacity:1;transform:none}'
    + '#og-nudge .who{display:flex;align-items:center;gap:8px;margin-bottom:7px}'
    + '#og-nudge .who img{width:28px;height:28px;border-radius:50%;object-fit:cover;background:#0d1b2e}'
    + '#og-nudge .who b{color:#fff;font-size:12px}#og-nudge .who small{display:block;color:rgba(231,238,247,.5);font-size:10px}'
    + '#og-nudge p{color:#e7eef7;font-size:13px;line-height:1.5;margin:0 0 10px}'
    + '#og-nudge .row{display:flex;gap:7px}'
    + '#og-nudge .yes{flex:1;background:linear-gradient(180deg,#00D5FF,#1E90FF);border:none;color:#02121a;font-weight:700;border-radius:8px;padding:8px;font-size:12.5px;cursor:pointer;font-family:inherit}'
    + '#og-nudge .no{background:none;border:none;color:rgba(231,238,247,.5);font-size:12px;cursor:pointer;padding:8px 6px;font-family:inherit}'
    + '@media(max-width:520px){#og-panel{width:100vw}#og-nudge{right:12px;left:12px;max-width:none;bottom:84px}}';

  function injectCSS() {
    if (document.getElementById('og-css')) return;
    var s = document.createElement('style'); s.id = 'og-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ── panel scaffolding ───────────────────────────────────────────────────
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div'); panel.id = 'og-panel';
    panel.innerHTML = '<div class="og-h" id="og-h"></div><div class="og-b" id="og-b"></div>';
    document.body.appendChild(panel);
    head = panel.querySelector('#og-h'); body = panel.querySelector('#og-b');
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  function open(guide, opts) {
    injectCSS(); ensurePanel(); hideNudge();
    requestAnimationFrame(function () { panel.classList.add('show'); });
    if (guide && FLOWS[guide]) FLOWS[guide](opts || {}); else router();
  }
  function close() { if (panel) panel.classList.remove('show'); }

  function shell(key) {
    currentGuide = key;
    var g = GUIDES[key];
    head.innerHTML = '<button class="og-bk" data-og="home">‹ Back</button>'
      + '<img src="' + g.img + '" alt="' + g.name + '">'
      + '<div><b>' + g.name + '</b><small>' + g.role + '</small></div>'
      + '<button class="og-x" data-og="close">×</button>';
    body.innerHTML = '<div class="og-msgs" id="og-ms"></div><div class="og-ctrls" id="og-ct"></div>';
    wireHeader();
  }
  function wireHeader() {
    var b = head.querySelector('[data-og="home"]'); if (b) b.onclick = router;
    var x = head.querySelector('[data-og="close"]'); if (x) x.onclick = close;
  }
  function bot(html) { var m = document.getElementById('og-ms'); if (!m) return; m.insertAdjacentHTML('beforeend', '<div class="og-m bot">' + html + '</div>'); body.scrollTop = body.scrollHeight; }
  function me(t) { var m = document.getElementById('og-ms'); if (!m) return; m.insertAdjacentHTML('beforeend', '<div class="og-m me">' + t + '</div>'); body.scrollTop = body.scrollHeight; }
  function feat(tag, title, txt) { var m = document.getElementById('og-ms'); if (!m) return; m.insertAdjacentHTML('beforeend', '<div class="og-feat"><span class="tg">' + tag + '</span><b>' + title + '</b><span>' + txt + '</span></div>'); body.scrollTop = body.scrollHeight; }
  function chips(arr) {
    var c = document.getElementById('og-ct'); if (!c) return; c.innerHTML = '';
    arr.forEach(function (a) {
      var b = document.createElement('button'); b.className = 'og-chip'; b.innerHTML = a[0];
      b.onclick = function () { me(b.textContent); if (a[2]) addProf(a[2]); c.innerHTML = ''; setTimeout(a[1], 260); };
      c.appendChild(b);
    });
    body.scrollTop = body.scrollHeight;
  }
  function ctas(html) { var c = document.getElementById('og-ct'); if (c) { c.innerHTML = html; body.scrollTop = body.scrollHeight; } }

  // ── router ──────────────────────────────────────────────────────────────
  function router() {
    injectCSS(); ensurePanel();
    head.innerHTML = '<span class="og-star">✦</span><div><b>Ask Orion</b><small>talk to the team</small></div><button class="og-x" data-og="close">×</button>';
    wireHeader();
    var items = [
      ['barry', 'Design a line & get a price', 'with <em>Barry</em> · our Helix designer'],
      ['penny', 'Work out the payback & finance', 'with <em>Penny</em> · does the numbers'],
      ['comet', 'Understand Helios', 'with <em>Comet</em> · the intelligence layer'],
      ['liam', 'Talk to an engineer', 'with <em>Liam</em> · book a call or visit']
    ];
    var h = '<div class="og-lead">What can we help with?</div><div class="og-sub">Tell us what you’re after and we’ll put the right one of us on it.</div>';
    items.forEach(function (it) {
      var g = GUIDES[it[0]];
      h += '<button class="og-card" data-guide="' + it[0] + '"><img src="' + g.img + '" alt="' + g.name + '"><span class="t"><b>' + it[1] + '</b><span>' + it[2] + '</span></span><span class="go">→</span></button>';
    });
    body.innerHTML = h;
    body.querySelectorAll('[data-guide]').forEach(function (el) {
      el.onclick = function () { FLOWS[el.getAttribute('data-guide')]({}); };
    });
  }

  // ── BARRY — hand off to the full builder ────────────────────────────────
  function barry() {
    shell('barry');
    bot("Right then — designing a line properly needs a bit of room to draw. I’ll open the full builder and we’ll get the kettle on. A few questions and you’ll have a drawing and an honest monthly figure — and remember, <em>everything we build comes with a two-year warranty</em>, however you pay for it.");
    ctas('<a class="og-cta" href="solution-builder.html">Open the line builder →</a><button class="og-cta sec" data-og="liam">Rather talk to someone</button>');
    var b = body.querySelector('[data-og="liam"]'); if (b) b.onclick = function () { FLOWS.liam({}); };
  }

  // ── PENNY — the finance consultant: FAQs, cashflow steer, ROI ───────────
  function penny(opts) {
    shell('penny');
    if (opts.fromNudge) { me('Show me'); pennyLabour(); return; }
    bot("Hi — I’m <em>Penny</em>, I look after the money side. Straight question to start: are you weighing up <em>whether automation pays</em>, or <em>how to pay for it</em>?");
    chips([
      ['Does it actually pay?', pennyROI, 'Asked: does it pay?'],
      ['Cash or finance?', pennyCashflow, 'Asked: cash vs finance'],
      ['What’s my labour costing?', pennyLabour, 'Wants labour cost worked out'],
      ['The small print', pennyTerms, 'Asked about terms']
    ]);
  }
  function pennyROI() {
    bot("Then the <em>ROI model</em> is where we start — and it matters more than any brochure. It takes your throughput, your headcount and your wage bill and shows the month the machine has paid for itself. If those numbers don’t work, I’ll tell you straight — but on most sorting operations the labour saving covers the lease with room to spare.");
    ctas('<a class="og-cta" href="index.html#roi">Run my numbers — ROI calculator →</a><button class="og-cta sec" data-og="next">Then how would I fund it?</button>');
    var b = body.querySelector('[data-og="next"]'); if (b) b.onclick = function () { me('Then how would I fund it?'); pennyCashflow(); };
  }
  function pennyCashflow() {
    bot("Here’s the question I’d ask any owner: <em>what else could that capital be doing?</em> Stock, people, growth, cushion — if a few hundred grand earns you more working in the business than it costs to lease the machine, writing a cheque for steel is the expensive option.");
    chips([
      ['Go on — opex vs capex?', pennyOpex, 'Wanted opex/capex explained'],
      ['I’d rather just buy it', function () {
        bot("And you can — nothing wrong with a straight purchase if you’re cash-rich. But run the ROI first: if the machine pays for itself from labour either way, the question is only <em>whose money finances the gap</em> — yours, or the funder’s at a fixed rate while yours keeps working. That’s why most of our customers lease.");
        addProf('Leaning cash purchase');
        ctas('<a class="og-cta" href="index.html#roi">Run the ROI →</a><button class="og-cta sec" data-og="liam">Talk it through</button>');
        var b = body.querySelector('[data-og="liam"]'); if (b) b.onclick = function () { FLOWS.liam({}); };
      }, 'Prefers outright purchase']
    ]);
  }
  function pennyOpex() {
    feat('the difference', 'Capex vs opex', '<b style="color:#8fe9ff">Capex</b> — capital spent up front, sat on your balance sheet depreciating, cash gone on day one. <b style="color:#8fe9ff">Opex</b> — a fixed monthly cost against operations: nothing down, predictable, and the labour saving lands in the same column it comes out of. The machine effectively pays its own bill each month.');
    bot("On a <em>60-month lease with nothing down</em>, most lines are cash-positive from month one — the wages saved are bigger than the payment. That’s the whole trick: let the machine buy itself while your capital stays in the business.");
    addProf('Walked through opex vs capex');
    ctas('<a class="og-cta" href="index.html#roi">Prove it — run my ROI →</a><a class="og-cta sec" href="warehouse-automation-finance.html">Finance explained</a><button class="og-cta sec" data-og="liam">Book a call</button>');
    var b = body.querySelector('[data-og="liam"]'); if (b) b.onclick = function () { FLOWS.liam({}); };
  }
  function pennyTerms() {
    feat('the small print', 'Straight answers', '<b style="color:#8fe9ff">Term</b> — typically 60 months, £0 deposit. <b style="color:#8fe9ff">Rate</b> — fixed for the term, subject to approval. <b style="color:#8fe9ff">End of term</b> — own it, upgrade it, or hand it back. <b style="color:#8fe9ff">Warranty</b> — two years on everything we build, however you pay. <b style="color:#8fe9ff">Support</b> — UK team, same people who built it.');
    bot("Anything in there you want unpicking, an engineer will happily go through it line by line — no salesman in the room.");
    addProf('Reviewed finance terms');
    ctas('<button class="og-cta" data-og="liam">Book that call →</button><a class="og-cta sec" href="warehouse-automation-finance.html">Read finance guide</a>');
    var b = body.querySelector('[data-og="liam"]'); if (b) b.onclick = function () { FLOWS.liam({}); };
  }
  function pennyLabour() {
    bot("Quick sums then. Roughly how many people do you have on sorting or induction across a day?");
    chips([
      ['Up to 10', function () { pennyMaths(8); }, 'Approx 8 on sort/induction'],
      ['10–25', function () { pennyMaths(18); }, 'Approx 18 on sort/induction'],
      ['25–50', function () { pennyMaths(35); }, 'Approx 35 on sort/induction'],
      ['50+', function () { pennyMaths(60); }, '50+ on sort/induction']
    ]);
  }
  function pennyMaths(n) {
    var perYr = 28000, cost = n * perYr;
    addProf('Est. labour cost £' + Math.round(cost / 1000) + 'k/yr (' + n + ' heads)');
    bot("At a loaded cost of about £28k a head, that’s roughly <em>£" + cost.toLocaleString('en-GB') + " a year</em> — every year, before sick days and turnover. A Helix line leases for a fraction of that. Put your real numbers in and I’ll show you the payback month.");
    ctas('<a class="og-cta" href="index.html#roi">Run my numbers — ROI calculator →</a><button class="og-cta sec" data-og="next">How would I fund it?</button>');
    var b = body.querySelector('[data-og="next"]'); if (b) b.onclick = function () { me('How would I fund it?'); pennyCashflow(); };
  }

  // ── COMET — Helios discovery ────────────────────────────────────────────
  function comet(opts) {
    shell('comet');
    if (opts.fromNudge) { me('Not really, no'); addProf('Ops managers lack visibility'); cometQ1b(); return; }
    bot("Hey — <em>Comet</em>. Rather than reel off features, mind if I ask a couple of quick ones about your operation? Thirty seconds, and I’ll only show you what actually fits.");
    chips([
      ['Go on then', cometQ1],
      ['Just show me everything', function () {
        bot('Fair — the full tour’s on the Helios page.');
        ctas('<a class="og-cta" href="helios.html">See what Helios does →</a>');
      }]
    ]);
  }
  function cometQ1() {
    bot("Do you have <em>ops managers</em> running the floor day-to-day?");
    chips([
      ['Yes, a couple', function () {
        feat('their answer → your feature', 'Customisable dashboards', 'Then they’d each get their own drag-and-drop dashboard — throughput, read rates, heatmaps — arranged how <i>they</i> want to see the site.');
        setTimeout(cometQ2, 700);
      }, 'Has ops managers on site'],
      ['Not really — it runs itself', function () {
        feat('their answer → your feature', 'One clear picture', 'Then a single site view matters more — one screen with everything moving on it, and alerts that come to you rather than needing someone watching.');
        setTimeout(cometQ2, 700);
      }, 'No dedicated ops managers']
    ]);
  }
  function cometQ1b() {
    feat('their answer → your feature', 'Customisable dashboards', 'Helios gives every manager their own drag-and-drop dashboard — live throughput, read rates, 365-day heatmaps — arranged how they actually want to see the site.');
    setTimeout(cometQ2, 700);
  }
  function cometQ2() {
    bot("Honest one — do you feel your current team could do with a bit more <em>structure</em> to the day?");
    chips([
      ['Definitely', function () {
        feat('their answer → your feature', 'Shift structure built in', 'Helios gives you shift breakdowns, volume-against-target and sorter leaderboards — the day structures itself around numbers everyone can see.');
        setTimeout(cometQ3, 700);
      }, 'Wants more staff structure'],
      ['They’re pretty solid', function () {
        feat('their answer → your feature', 'Stay ahead of them', 'Good teams get better with trend analytics — demand prediction tells them what’s coming before it arrives.');
        setTimeout(cometQ3, 700);
      }, 'Team already structured']
    ]);
  }
  function cometQ3() {
    bot("Last one — does the <em>engineering side</em> worry you? Keeping a machine like this running, finding faults, that sort of thing.");
    chips([
      ['Honestly, yes a bit', function () {
        feat('their answer → your feature', 'It diagnoses itself', 'Fair worry — so we built it out of the machine: predictive alerts flag a motor trending hot <i>before</i> it stops you, root-cause analysis points at the fault, and guided how-to-test steps walk your techs through the fix. The electrical schematics live right next to the machine they describe.');
        setTimeout(cometWrap, 900);
      }, 'Nervous about engineering/maintenance'],
      ['No, we have good engineers', function () {
        feat('their answer → your feature', 'Tools your engineers will love', 'Then they’ll want the SCADA digital twin and the full electrical schematics in-platform — faults down to the sensor without leaving the desk.');
        setTimeout(cometWrap, 900);
      }, 'Has strong in-house engineering']
    ]);
  }
  function cometWrap() {
    var lis = profFor('Comet').map(function (p) { return '<li>' + p + '</li>'; }).join('');
    var m = document.getElementById('og-ms');
    if (m && lis) m.insertAdjacentHTML('beforeend', '<div class="og-prof"><b>So for your operation, Helios earns its keep on:</b><ul>' + lis + '</ul></div>');
    bot("Want to see exactly that running on a line like yours? Twenty minutes with an engineer, on screen — Liam will sort you a slot.");
    ctas('<button class="og-cta" data-og="book">Book a Helios demo →</button><button class="og-cta sec" data-og="mail">Email me this instead</button>');
    var b1 = body.querySelector('[data-og="book"]'); if (b1) b1.onclick = function () { FLOWS.liam({ kind: 'Helios demo' }); };
    var b2 = body.querySelector('[data-og="mail"]'); if (b2) b2.onclick = function () { capture('Helios — send info', 'Comet discovery'); };
  }

  // ── LIAM — the human path + booking ─────────────────────────────────────
  function liam(opts) {
    shell('liam');
    var kind = opts.kind || null;
    var notes = prof();
    // The closer: recap everything the team has learned, then push for the meeting.
    if (notes.length) {
      bot("Alright — <em>Liam</em>. Right, to be clear — here’s where we’ve got to:");
      var m = document.getElementById('og-ms');
      if (m) m.insertAdjacentHTML('beforeend', '<div class="og-prof"><b>What you’ve told the team so far</b><ul>' + notes.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul></div>');
      if (kind) { bot("So a <em>" + kind + "</em> is exactly the right next step — twenty minutes with an engineer turns all that into a firm answer. Let’s get you in the diary; those notes come with you, so no repeating yourself."); booking(kind); return; }
      bot("Honestly, the next step that actually moves this forward is a short call or a site visit — an engineer turns that lot into a firm answer, usually in one conversation. No hard sell. What suits?");
    } else {
      if (kind) { bot("Alright — <em>Liam</em>. A <em>" + kind + "</em> it is. Quickest way is to get you straight in the diary."); booking(kind); return; }
      bot("Alright — I’m <em>Liam</em>. Honestly, the quickest way to get you sorted is a short call or a site visit. No hard sell, just a straight chat with an engineer. What suits?");
    }
    chips([
      ['Book a call', function () { booking('15-minute call'); }, 'Wants a call'],
      ['Book a site visit', function () { booking('site visit'); }, 'Wants a site visit'],
      ['Just email me info', function () { capture('Send me info', 'Liam'); }]
    ]);
  }
  function booking(kind) {
    if (BOOKINGS_URL) {
      bot("Pick a slot that suits and it drops straight into an engineer’s diary — you’ll get a calendar invite and a reminder.");
      ctas('<div class="og-book"><iframe src="' + BOOKINGS_URL + '" title="Book with Orion engineering"></iframe></div><div class="og-note">Booking runs on Microsoft Bookings — straight into our engineers’ Outlook diaries.</div>');
    } else {
      bot("Pop your details down for your <em>" + kind + "</em> and an engineer will come back within a working day to fix a time. Or just ring us — <a href=\"tel:+443333355269\" style=\"color:#8fe9ff\">+44 333 335 5269</a>.");
      capture(kind + ' — request', 'Liam');
    }
  }

  // ── shared capture form (posts to Basin, carries the discovery profile) ──
  function capture(subject, from) {
    var c = document.getElementById('og-ct'); if (!c) return;
    c.innerHTML = '<div class="og-cap"><form id="ogForm" novalidate>'
      + '<input type="text" name="name" placeholder="Your name" autocomplete="name">'
      + '<input type="text" name="company" placeholder="Company" autocomplete="organization">'
      + '<input type="email" name="email" placeholder="Email" autocomplete="email">'
      + '<input type="tel" name="phone" placeholder="Phone (optional)" autocomplete="tel">'
      + '<input type="hidden" name="_subject" value="' + subject + ' — Orion website (Ask Orion)">'
      + '<input type="hidden" name="source" value="Ask Orion · ' + from + '">'
      + '<input type="hidden" name="visitor_profile" value="">'
      + '<input type="hidden" name="page" value="">'
      + '<input type="hidden" name="_honeypot" value="_hp"><input type="text" name="_hp" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">'
      + '<button type="submit" class="og-cta" style="width:100%;justify-content:center">Send →</button>'
      + '</form></div>';
    var f = document.getElementById('ogForm');
    f.querySelector('[name="visitor_profile"]').value = prof().join(' | ') || 'none captured';
    f.querySelector('[name="page"]').value = location.pathname + location.hash;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.querySelector('[name="name"]'), email = f.querySelector('[name="email"]');
      var ok = true;
      if (!name.value.trim()) { name.classList.add('err'); ok = false; } else name.classList.remove('err');
      var ev = email.value.trim();
      if (!ev || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev)) { email.classList.add('err'); ok = false; } else email.classList.remove('err');
      if (!ok) return;
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
      fetch(BASIN, { method: 'POST', body: new FormData(f), headers: { 'Accept': 'application/json' } })
        .then(function (r) { if (!r.ok) throw 0; c.innerHTML = ''; bot("✅ Done — that’s with the team. We’ll come back within <em>a working day</em>. Anything urgent, ring <a href=\"tel:+443333355269\" style=\"color:#8fe9ff\">+44 333 335 5269</a>."); })
        .catch(function () { btn.disabled = false; btn.textContent = 'Send →'; alert('Sorry — that did not send. Email info@orionmis.co.uk and we’ll come straight back.'); });
    });
    body.scrollTop = body.scrollHeight;
  }

  // ── page nudges (called by site.js) ─────────────────────────────────────
  var nudgeEl;
  function hideNudge() { if (nudgeEl) { nudgeEl.classList.remove('show'); setTimeout(function () { nudgeEl && nudgeEl.remove(); nudgeEl = null; }, 350); } }
  function nudge(cfg) {
    injectCSS();
    if (nudgeEl || (panel && panel.classList.contains('show'))) return;
    var g = GUIDES[cfg.guide];
    nudgeEl = document.createElement('div'); nudgeEl.id = 'og-nudge';
    nudgeEl.innerHTML = '<div class="who"><img src="' + g.img + '" alt="' + g.name + '"><div><b>' + g.name + '</b><small>' + g.role + '</small></div></div>'
      + '<p>' + cfg.q + '</p>'
      + '<div class="row"><button class="yes">' + cfg.yes + '</button><button class="no">No thanks</button></div>';
    document.body.appendChild(nudgeEl);
    requestAnimationFrame(function () { nudgeEl.classList.add('show'); });
    // there if you want them, gone if you don't — quietly fades if ignored
    var fade = setTimeout(hideNudge, 14000);
    nudgeEl.querySelector('.yes').onclick = function () { clearTimeout(fade); try { localStorage.setItem('og-nudge-last', String(Date.now())); } catch (e) {} open(cfg.guide, { fromNudge: true }); };
    nudgeEl.querySelector('.no').onclick = function () { clearTimeout(fade); try { localStorage.setItem('og-nudge-off', String(Date.now())); } catch (e) {} hideNudge(); };
  }

  var FLOWS = { barry: barry, penny: penny, comet: comet, liam: liam };
  window.OrionGuides = { open: open, close: close, nudge: nudge };
})();
