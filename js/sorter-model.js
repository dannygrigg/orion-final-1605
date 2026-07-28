/* ─────────────────────────────────────────────────────────────────────────
   ORION SORTER MODEL  ·  single source of truth for the Helix machine
   ---------------------------------------------------------------------------
   Built from Danny's walkthrough of the real line, July 2026.

   MATERIAL FLOW:
     Induction (0.5–1 m/s, operators either side, accumulate)
       → 3 gapping conveyors (accelerate + gap ≥ 1.5× largest parcel)
       → scan tunnel (1-sided std, 3+ optional, weight + dims optional)
       → Helix banks @ 2.5–3 m/s (200mm modules, each L/R/straight; belts bridge banks)
       → diverts to takeaway: merge→bend→chute→carrier, OR boom conveyor
       → reject line at the end (configurable on the fly)
       → Helios over the top (routing, live config, data)

   Tags:  [DANNY]  from the walkthrough   ·  [LEMON] real project data
          [SEED]   my placeholder — tune it as we go
   ───────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  // ── KIT OF PARTS ───────────────────────────────  [mm · £]
  const KIT = {
    helix:    { name: 'Helix sorter deck', perM: 27500, moduleLen: 200, width: 1050 }, // [LEMON/DANNY]
    belt:     { name: 'Conveyor',          base: 2000, perM: 600 },                     // [LEMON]  transfer + infeed + gapping
    scan:     { name: 'Scan tunnel + dims',base: 15000, multiMult: 3 },                 // [LEMON]  ×3 for 3+ sided
    chute:    { name: 'Chute takeaway',    perM: 2000, maxWeight: 25 },                 // [DANNY]  £2k/m, ≤25kg → cage/carrier
    powered:  { name: 'Powered conveyor takeaway', perM: 3000 },                        // [DANNY]  £3k/m → away to another process
    boom:     { name: 'Boom conveyor',     from: 30000 },                               // [DANNY]  powered reversible, quoted separately
    reject:   { name: 'Reject line',       base: 4514, perM: 200, length: 3.685 }       // [LEMON]
  };

  // Controls, routing & SCADA — one-off capex, sized to the client. Routing + SCADA are
  // standard; the tier reflects integration depth. £30k baseline (recommended default).  [DANNY]
  const CONTROLS_TIERS = {
    lean:     { amount: 15000, name: 'Lean — experienced client, minimal integration' },
    baseline: { amount: 30000, name: 'Baseline — standard controls, routing & SCADA' },
    complex:  { amount: 50000, name: 'Complex — high-spec / heavy integration' }
  };
  const CONTROLS_DEFAULT = 'baseline';

  // Helios is the optional intelligence layer — a per-site MONTHLY subscription on top.  [helios.html]
  const HELIOS_TIERS = {
    core:        { mo: 1500,  name: 'Core',        sub: 'Operational visibility',       feats: ['Live dashboards', 'Throughput KPIs', 'Standard alerts', 'Monthly reports'] },
    intelligent: { mo: 3500,  name: 'Intelligent', sub: 'Prediction & decision support', feats: ['Bottleneck forecasts', 'Demand prediction', 'Smart alerts', 'Trend analytics'] },
    autonomous:  { mo: 7500,  name: 'Autonomous',  sub: 'Optimisation & AI actions',    feats: ['Dynamic rerouting', 'Labour recommendations', 'AI Assistant', 'Root-cause analysis'] },
    enterprise:  { mo: 15000, name: 'Enterprise',  sub: 'Network-wide intelligence',    feats: ['Multi-site control', 'Custom integrations', 'Executive analytics', 'Partner API'] }
  };

  // ── RULES / CONSTRAINTS (the machine physics) ──────────────────────────────
  const RULES = {
    speedFast: 3.0, speedStd: 2.5,     // m/s — faster for small/light parcels        [DANNY]
    gapFactor: 1.5,                    // gap between items = 1.5 × largest parcel      [DANNY]
    gappingBelts: 3,                   // number of gapping conveyors up front          [DANNY]
    gappingBeltFactor: 2,              // each gapping/transfer belt = 2 × max parcel    [DANNY]
    bankFactor: 0.75,                  // divert bank length = ¾ × max parcel...         [DANNY]
    // ...rounded to whole 200mm modules. 600mm → round(0.75×600/200)=2 modules.        [DANNY]
    sides: 2,                          // takeaways per bank — L+R both sides            [DANNY]
    destPitch: 3.0,                    // m — centre spacing between takeaway lines      [DANNY]
    takeawayLen: 3.0,                  // m of chute line per destination (→ £2k/m)      [SEED]
    maxDestPerLoop: 40,                // destinations before a 2nd loop                 [SEED]
    operatorRates: { light: 900, mixed: 700, heavy: 450 }, // items/hr per operator by parcel profile [DANNY]
    operatorsPerM: 1,                  // operators per metre of infeed                  [DANNY]
    inductSides: 2,                    // operators can work 1 or both sides             [DANNY]
    autoInductSpeed: 1.0,              // m/s — auto-induction, nose-to-tail (no gap)    [DANNY]
    autoInductMax: { len: 600, weight: 30 }, // auto-induct envelope; over-length → double slot (½ rate) [DANNY]
    autoInductPackage: { standard: 200000, large: 500000 }, // £ full auto-induct; large = >600mm parcels [DANNY]
    autoResidualOps: 3,                // rework-QA operators (failed 2nd-attempt re-inductions) [SEED]
    envelope: { minLen: 50, effMin: 200, maxLen: 1200, maxWidth: 1050, chuteWeight: 25, maxWeight: 70 }, // mm/kg — ≤25kg chute, >70kg call engineering [DANNY]
    pricing: { controls: 8, installation: 12, contingency: 5, margin: 30, delivery: 2500, apr: 0.08 } // % [LEMON]
  };

  const r0 = n => Math.round(n);
  const money = n => '£' + Math.round(n).toLocaleString('en-GB');

  function speedFor(maxLen, maxWeight) {
    return (maxLen <= 400 && (maxWeight || 0) <= 10) ? RULES.speedFast : RULES.speedStd; // [SEED] band
  }
  // Peak items/hr the sorter can gap at, for a given largest-parcel length
  function sorterCeiling(maxLen, maxWeight) {
    const pitch = RULES.gapFactor * maxLen / 1000;     // m, centre-to-centre
    return r0(speedFor(maxLen, maxWeight) / pitch * 3600);
  }
  function modulesPerBank(maxLen) {
    return Math.max(1, Math.round(RULES.bankFactor * maxLen / KIT.helix.moduleLen));
  }
  // Manual induction rate depends on the parcel: light parcels go on faster than heavy/awkward ones.
  function operatorProfile(maxLen, maxWeight) {
    if (maxLen <= 400 && (maxWeight || 0) <= 10) return 'light';
    if (maxLen > 600  || (maxWeight || 0) > 25) return 'heavy';
    return 'mixed';
  }
  function operatorRateFor(maxLen, maxWeight) {
    return RULES.operatorRates[operatorProfile(maxLen, maxWeight)];
  }
  function operatorsFor(targetTph, maxLen, maxWeight) {
    return Math.max(1, Math.ceil((targetTph || 0) / operatorRateFor(maxLen, maxWeight)));
  }
  // Auto-induction, nose-to-tail (no gap): rate/lane = speed ÷ parcel length.
  // Parcels over the auto-induct length limit take a double slot → half rate.
  function autoInductRate(maxLen) {
    const effLen = maxLen > RULES.autoInductMax.len ? maxLen * 2 : maxLen;
    return r0(3600 * RULES.autoInductSpeed / (effLen / 1000));
  }
  function autoLanesFor(targetTph, maxLen) {
    return Math.max(1, Math.ceil((targetTph || 0) / autoInductRate(maxLen)));
  }
  function autoInductCost(maxLen) {
    return maxLen > RULES.autoInductMax.len ? RULES.autoInductPackage.large : RULES.autoInductPackage.standard;
  }

  // ── CONFIGURE: customer answers → a real machine ───────────────────────────
  // a = { maxLen, minLen, maxWidth, maxWeight, targetTph, destinations,
  //       boomDestinations, scan, scanMulti, printApply, shape, controlsTier }
  function configure(a) {
    a = a || {};
    const e = RULES.envelope, warn = [];
    const maxLen = a.maxLen || 600, minLen = a.minLen || e.effMin;
    const dest   = a.destinations || 16;
    const target = a.targetTph || 10000;
    const booms   = Math.min(a.boomDestinations || 0, dest);
    const powered = Math.min(a.poweredDestinations || 0, dest - booms);
    const chutes  = dest - booms - powered;

    // 1 · Suitability gates
    if (maxLen > e.maxLen)        warn.push(`Longest item ${maxLen}mm is over the ${e.maxLen}mm max — engineering review.`);
    if (maxLen < e.minLen)        warn.push(`Shortest item ${maxLen}mm is under the ${e.minLen}mm floor — further engineering needed.`);
    if ((a.maxWidth||0) > e.maxWidth) warn.push(`Widest item ${a.maxWidth}mm is over the ${e.maxWidth}mm deck.`);
    if ((a.maxWeight||0) > KIT.chute.maxWeight && chutes > 0)
      warn.push(`${a.maxWeight}kg is over the ${KIT.chute.maxWeight}kg chute limit — heavier items need boom takeaways or a heavier build.`);
    if ((a.maxWeight||0) > e.maxWeight) warn.push(`${a.maxWeight}kg is over the ${e.maxWeight}kg machine max — engineering review.`);

    // 2 · Throughput — sorter ceiling vs induction supply
    const speed   = speedFor(maxLen, a.maxWeight);
    const ceiling = sorterCeiling(maxLen, a.maxWeight);
    const opRate    = operatorRateFor(maxLen, a.maxWeight); // items/hr per operator for this parcel
    const operators = operatorsFor(target, maxLen, a.maxWeight); // manual headcount to feed the line
    const infeedLen = Math.max(3, Math.ceil(operators / RULES.inductSides)); // m, 1 op/m each side
    const autoRate  = autoInductRate(maxLen);               // per-lane rate if auto-inducted
    const autoLanes = autoLanesFor(target, maxLen);
    if (target > ceiling) warn.push(`${target.toLocaleString('en-GB')} pph is above the ${ceiling.toLocaleString('en-GB')} pph ceiling for a ${maxLen}mm parcel at ${speed} m/s — tighten max size or accept fewer.`);
    if (a.autoInduct) {
      if (maxLen > RULES.autoInductMax.len) warn.push(`Auto-induction over ${RULES.autoInductMax.len}mm runs at half rate (double slot) and steps up to the larger £${(RULES.autoInductPackage.large/1000)}k package.`);
      if ((a.maxWeight||0) > RULES.autoInductMax.weight) warn.push(`Auto-induction is limited to ${RULES.autoInductMax.weight}kg — heavier parcels need manual induction or an exception path.`);
    }

    // 3 · Deck geometry — each bank feeds L + R, so banks = destinations ÷ sides
    const banks    = Math.ceil(dest / RULES.sides);
    const modsBank = modulesPerBank(maxLen);
    const bankLen  = modsBank * KIT.helix.moduleLen / 1000;   // m per divert bank
    const helixLen = +(banks * bankLen).toFixed(1);           // m of Helix (banks only)
    const transferLen = +(banks * RULES.gappingBeltFactor * maxLen / 1000).toFixed(1); // m of bridging belt
    const gappingLen  = +(RULES.gappingBelts * RULES.gappingBeltFactor * maxLen / 1000).toFixed(1);
    const deckLen  = +(banks * RULES.destPitch).toFixed(1);   // m footprint (for the drawing later)
    const loops    = Math.ceil(dest / RULES.maxDestPerLoop);
    if (loops > 1) warn.push(`${dest} destinations is over ${RULES.maxDestPerLoop}/loop — needs ${loops} loops.`);

    // 4 · Bill of materials
    const M = [];
    const push = (key, label, qty, unit, note, pass) => M.push({ key, label, qty, unit: r0(unit), cost: r0(unit * qty), note: note || '', pass: !!pass });

    if (a.autoInduct) {
      push('induct', `Full auto-induction, ${autoLanes} lane(s) @ ${RULES.autoInductSpeed} m/s nose-to-tail (${autoRate.toLocaleString('en-GB')}/hr each), camera upgrade + reinduction loop, ${RULES.autoResidualOps} rework-QA ops`, 1, autoInductCost(maxLen), 'quoted package', true);
    } else {
      push('induct', `Induction — infeed ${infeedLen}m (${operators} operators @ ${opRate}/hr, ${operatorProfile(maxLen, a.maxWeight)} parcels)`, 1, KIT.belt.base + infeedLen * KIT.belt.perM);
    }
    push('gapping', `Gapping conveyors ×${RULES.gappingBelts} · ${gappingLen}m`, 1, KIT.belt.base + gappingLen * KIT.belt.perM);
    if (a.scan) push('scan', a.scanMulti ? 'Scan tunnel — 3+ sided + weight/dims' : 'Scan tunnel + dims', 1, KIT.scan.base * (a.scanMulti ? KIT.scan.multiMult : 1));
    push('helix', `Helix deck · ${helixLen}m (${banks} banks × ${modsBank} modules, L+R)`, 1, helixLen * KIT.helix.perM);
    push('belt', `Transfer belts · ${transferLen}m`, 1, transferLen * KIT.belt.perM);
    if (chutes > 0)  push('chute', `Chute takeaways (≤${KIT.chute.maxWeight}kg → cage)`, chutes, KIT.chute.perM * RULES.takeawayLen);
    if (powered > 0) push('powered', 'Powered conveyor takeaways', powered, KIT.powered.perM * RULES.takeawayLen);
    if (booms > 0)   push('boom', 'Boom conveyors (powered reversible)', booms, KIT.boom.from, 'quoted separately');
    push('reject', 'Reject line', 1, KIT.reject.base + KIT.reject.length * KIT.reject.perM);
    if (a.printApply) push('printApply', 'Print & apply', 1, 46000, '[SEED] not yet in lemon');
    if (a.shape === 'L') push('fold', 'Deck fold — 90° (L-shape)', 1, 1750 + 2900);
    if (a.shape === 'U') push('fold', 'Deck fold — U-shape', 2, 1750 + 2900);

    const metrics = {
      speed, ceiling, operators, opRate, opProfile: operatorProfile(maxLen, a.maxWeight), infeedLen, autoRate, autoLanes, autoResidual: RULES.autoResidualOps, banks, modsBank, bankLen,
      helixLen, transferLen, gappingLen, deckLen, loops, chutes, powered, booms,
      tphMin: sorterCeiling(maxLen, a.maxWeight),   // largest item → lowest rate
      tphMax: sorterCeiling(minLen, 0)              // smallest item → highest rate
    };
    return { modules: M, metrics, warnings: warn };
  }

  // ── PRICE: BOM → ROM budget + monthly lease (real lemon rollup) ─────────────
  function price(config, opts) {
    opts = opts || {};
    const p = RULES.pricing;
    // Pass-through lines (booms, auto-induct package) are quoted separately — no extra markup.
    const passCost = config.modules.filter(m => m.pass).reduce((s, m) => s + m.cost, 0);
    const raw = config.modules.filter(m => !m.pass).reduce((s, m) => s + m.cost, 0);
    const controls     = raw * p.controls / 100;
    const installation = raw * p.installation / 100;
    const contingency  = raw * p.contingency / 100;
    const subPre = raw + controls + installation + contingency;
    const margin = subPre * p.margin / 100;
    // Controls, routing & SCADA — capex, defaults to baseline (£30k) if not specified.
    const ctrlKey = (opts.controlsTier && CONTROLS_TIERS[opts.controlsTier]) ? opts.controlsTier : CONTROLS_DEFAULT;
    const controlsTier = CONTROLS_TIERS[ctrlKey].amount;
    const finalROM = subPre + margin + p.delivery + controlsTier + passCost;

    const term = opts.term || 60;
    const r = p.apr / 12, f = Math.pow(1 + r, term);
    const lease = finalROM > 0 ? finalROM * (r * f) / (f - 1) : 0;
    // Helios — optional per-site monthly subscription, on top of the lease (not financed).
    const helios = (opts.heliosTier && HELIOS_TIERS[opts.heliosTier]) ? HELIOS_TIERS[opts.heliosTier].mo : 0;

    return { raw, controls, installation, contingency, margin, delivery: p.delivery, controls_scada: controlsTier, controlsKey: ctrlKey, passthrough: passCost, finalROM, term, lease, helios, monthly: lease, totalMonthly: lease + helios };
  }

  const API = { KIT, CONTROLS_TIERS, CONTROLS_DEFAULT, HELIOS_TIERS, RULES, speedFor, sorterCeiling, modulesPerBank, operatorProfile, operatorRateFor, operatorsFor, autoInductRate, configure, price, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.OrionSorter = API;
})(typeof self !== 'undefined' ? self : this);
