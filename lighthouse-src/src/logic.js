// Keep the Light: pure game logic. Everything both phones show is derived from
// the ordered event log plus the room seed, so the two phones can never disagree.

export const STAGES = { 1: ['prime', 'clockwork', 'signal', 'beam'], 2: ['rocks', 'harbor'] };
export const CLOCK_SECS = 600;
export const MAX_STRIKES = 3;
export const FLARES = 2;
export const PIN_COLORS = ['red', 'blue', 'yellow', 'green', 'white', 'black'];
export const LIGHT_COLORS = ['white', 'red', 'green'];
export const W = 7, H = 9;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
export const HEADINGS = ['North', 'East', 'South', 'West'];

export const DEBRIEFS = [
  'What was the moment you most wanted to grab the controls?',
  'What did the other person say that made it easier to trust them?',
  'When did you almost try it on your own? What stopped you?',
  'What would you tell the other person to do differently next storm?',
  'Which moment felt most like a team tonight?'
];

/* ---------------- seeded randomness ---------------- */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const rngFor = (s) => mulberry32(xmur3(s)());
export function shuffled(arr, seedStr) {
  const rnd = rngFor(seedStr), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

/* ---------------- Room 1, stage 1: prime the lamp (solvable alone) ---------------- */
export const VALVES = ['Fuel', 'Air', 'Draft'];
export function genPrime(seed) {
  const rnd = rngFor(seed);
  const weights = shuffled([1, 2, 3], seed + ':w');
  let target, sol;
  do {
    sol = [0, 1, 2].map(() => Math.floor(rnd() * 5));
    target = sol.reduce((s, p, i) => s + p * weights[i], 0);
  } while (target < 7 || target > 17);
  return { weights, target, max: 24 };
}
export const primeValue = (inst, v) => v.reduce((s, p, i) => s + p * inst.weights[i], 0);

/* ---------------- Room 1, stage 2: free the clockwork (rules live in the Captain's manual) ---------------- */
function randCond(rnd) {
  const t = Math.floor(rnd() * 7), c = pick(rnd, PIN_COLORS);
  switch (t) {
    case 0: return { k: 'glass', v: rnd() < 0.5 };
    case 1: return { k: 'lens', v: rnd() < 0.5 ? 'odd' : 'even' };
    case 2: return { k: 'vane', v: rnd() < 0.5 ? 'sea' : 'land' };
    case 3: return { k: 'count', v: 4 + Math.floor(rnd() * 3) };
    case 4: return { k: 'none', c };
    case 5: return { k: 'multi', c };
    default: return { k: 'last', c };
  }
}
function condTrue(c, i) {
  switch (c.k) {
    case 'glass': return i.cloudy === c.v;
    case 'lens': return (c.v === 'odd') === i.odd;
    case 'vane': return i.vane === c.v;
    case 'count': return i.n === c.v;
    case 'none': return !i.pins.includes(c.c);
    case 'multi': return i.pins.filter((x) => x === c.c).length > 1;
    default: return i.pins[i.n - 1] === c.c;
  }
}
export function condText(c) {
  switch (c.k) {
    case 'glass': return c.v ? 'the storm glass is cloudy' : 'the storm glass is clear';
    case 'lens': return 'the lens number ends in an ' + c.v + ' digit';
    case 'vane': return c.v === 'sea' ? 'the weathervane points out to sea' : 'the weathervane points toward land';
    case 'count': return 'there are exactly ' + c.v + ' pins';
    case 'none': return 'there is no ' + c.c + ' pin';
    case 'multi': return 'there is more than one ' + c.c + ' pin';
    default: return 'the last pin is ' + c.c;
  }
}
function randAct(rnd, present) {
  const t = Math.floor(rnd() * 5);
  if (t === 0) return { k: 'first' };
  if (t === 1) return { k: 'last' };
  if (t === 2) return { k: 'nth', v: 2 + Math.floor(rnd() * 3) };
  const c = pick(rnd, present);
  return t === 3 ? { k: 'firstc', c } : { k: 'lastc', c };
}
function actIndex(a, i) {
  switch (a.k) {
    case 'first': return 0;
    case 'last': return i.n - 1;
    case 'nth': return a.v - 1;
    case 'firstc': return i.pins.indexOf(a.c);
    default: return i.pins.lastIndexOf(a.c);
  }
}
export function actText(a) {
  const ord = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  switch (a.k) {
    case 'first': return 'pull the first pin';
    case 'last': return 'pull the last pin';
    case 'nth': return 'pull the ' + ord[a.v] + ' pin';
    case 'firstc': return 'pull the first ' + a.c + ' pin';
    default: return 'pull the last ' + a.c + ' pin';
  }
}
export const ruleText = (r) => 'If ' + r.conds.map(condText).join(' and ') + ', ' + actText(r.act) + '.';
export function genClockwork(seed, nRules = 5) {
  const rnd = rngFor(seed);
  let inst = null;
  for (let tries = 0; tries < 800; tries++) {
    const n = 4 + Math.floor(rnd() * 3), pins = [];
    for (let i = 0; i < n; i++) pins.push(pick(rnd, PIN_COLORS));
    const lens = String(100 + Math.floor(rnd() * 900));
    inst = { n, pins, cloudy: rnd() < 0.5, lens, odd: (+lens.charAt(2)) % 2 === 1, vane: rnd() < 0.5 ? 'sea' : 'land' };
    const present = [...new Set(pins)];
    const rules = [];
    for (let r = 0; r < nRules; r++) {
      const c1 = randCond(rnd), conds = [c1];
      if (rnd() < 0.5) { const c2 = randCond(rnd); if (c2.k !== c1.k) conds.push(c2); }
      rules.push({ conds, act: randAct(rnd, present) });
    }
    const matched = rules.findIndex((r) => r.conds.every((c) => condTrue(c, inst)));
    if (matched === 0) continue; // the first rule never just hands it over
    const def = randAct(rnd, present);
    const target = actIndex(matched < 0 ? def : rules[matched].act, inst);
    if (target < 0 || target >= n) continue;
    Object.assign(inst, { rules, def, matched, target });
    return inst;
  }
  return inst;
}

/* ---------------- Room 1, stage 3: set the signal ---------------- */
const ADJ = ['Grace', 'Mercy', 'Harbor', 'Saint', 'North', 'Morrow'];
const NOUN = ['Point', 'Head', 'Rock', 'Bay', 'Reef', 'Light'];
function randPattern(rnd) {
  const len = 3 + Math.floor(rnd() * 3); let p = '';
  for (let i = 0; i < len; i++) p += rnd() < 0.5 ? 'S' : 'L';
  return p;
}
export function genSignal(seed) {
  const rnd = rngFor(seed);
  for (let guard = 0; guard < 500; guard++) {
    const a = Math.floor(rnd() * ADJ.length), n = Math.floor(rnd() * NOUN.length), y = 1850 + Math.floor(rnd() * 60);
    const hide = rnd() < 0.5 ? 'adj' : 'noun';
    const used = new Set([a + ':' + n]), years = new Set([y]);
    const entries = [{ a, n, y, t: true }];
    const add = (e) => { const k = e.a + ':' + e.n; if (used.has(k)) return false; used.add(k); entries.push(e); return true; };
    const visSame = (e) => (hide === 'adj' ? e.n === n : e.a === a);
    // decoys that share the readable word but not the year
    let g = 0;
    while (entries.length < 4 && g++ < 100) {
      let yy = 1850 + Math.floor(rnd() * 60); if (yy === y) continue;
      const e = hide === 'adj' ? { a: Math.floor(rnd() * ADJ.length), n, y: yy } : { a, n: Math.floor(rnd() * NOUN.length), y: yy };
      add(e);
    }
    // decoys that share the year but not the readable word
    g = 0;
    while (entries.length < 6 && g++ < 100) {
      const e = { a: Math.floor(rnd() * ADJ.length), n: Math.floor(rnd() * NOUN.length), y };
      if (visSame(e)) continue; add(e);
    }
    g = 0;
    while (entries.length < 8 && g++ < 100) {
      const e = { a: Math.floor(rnd() * ADJ.length), n: Math.floor(rnd() * NOUN.length), y: 1850 + Math.floor(rnd() * 60) };
      if (visSame(e) || e.y === y) continue; add(e);
    }
    if (entries.length < 8) continue;
    const pats = new Set();
    entries.forEach((e) => { let p; do { p = randPattern(rnd) + ':' + Math.floor(rnd() * 3); } while (pats.has(p)); pats.add(p); const [pp, cc] = p.split(':'); e.p = pp; e.c = +cc; });
    const matches = entries.filter((e) => visSame(e) && e.y === y);
    if (matches.length !== 1) continue;
    const list = shuffled(entries, seed + ':list').map((e) => ({ name: ADJ[e.a] + ' ' + NOUN[e.n], year: e.y, p: e.p, c: e.c, t: !!e.t }));
    const t = list.find((e) => e.t);
    return { list: list.map(({ t: _t, ...rest }) => rest), plate: { adj: ADJ[a], noun: NOUN[n], year: y, hide }, pattern: t.p, color: t.c };
  }
  throw new Error('signal gen failed');
}

/* ---------------- Room 2: the fog ---------------- */
const key = (x, y) => x + ',' + y;
const inb = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
export const START = { x: 3, y: H - 1, h: 0 };

// cell kinds: 'w' water, 'r' rock, 'g' gate, 'b' berth, 'p' pier, 'boat'
function bfs(inst, opts = {}) {
  const seen = new Map([[key(START.x, START.y), 0]]), q = [[START.x, START.y]];
  while (q.length) {
    const [x, y] = q.shift(), d = seen.get(key(x, y));
    for (const [dx, dy] of DIRS) {
      const r = stepResult(inst, x, y, dx, dy);
      if (r.blocked) continue;
      if (r.goal) return d + 1;
      const k = key(r.x, r.y);
      if (!seen.has(k)) { seen.set(k, d + 1); q.push([r.x, r.y]); }
    }
  }
  return -1;
}
export function cellAt(inst, x, y) { return inb(x, y) ? inst.cells[y][x] : 'r'; }
export function currentAt(inst, x, y) { return inst.current && inst.current[key(x, y)] || 0; }
// One cell of movement. Returns where the ship ends up and what happened.
export function stepResult(inst, x, y, dx, dy) {
  const nx = x + dx, ny = y + dy, c = cellAt(inst, nx, ny);
  if (c === 'r' || c === 'p' || c === 'boat') return { blocked: true, scrape: true, x, y, hit: c };
  if (c === 'g') return { x: nx, y: ny, goal: true };
  if (c === 'b') {
    const berth = inst.berths.findIndex((b) => b === nx);
    if (berth === inst.berth) return { x: nx, y: ny, goal: true };
    return { blocked: true, wrongBerth: berth + 1, x, y };
  }
  const cur = currentAt(inst, nx, ny);
  if (cur) {
    const fx = nx + cur, fc = cellAt(inst, fx, ny);
    if (fc === 'w') return { x: fx, y: ny, drift: cur };
    return { blocked: true, scrape: true, x: nx, y: ny, drift: cur, hit: fc, moved: true };
  }
  return { x: nx, y: ny };
}
export function genRocks(seed) {
  const rnd = rngFor(seed);
  for (let t = 0; t < 400; t++) {
    const gate = 1 + Math.floor(rnd() * 5);
    const cells = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        if (y === 0) row.push(x === gate ? 'g' : 'r');
        else if (y === H - 1) row.push(Math.abs(x - START.x) <= 1 ? 'w' : (rnd() < 0.15 ? 'r' : 'w'));
        else row.push(rnd() < 0.3 ? 'r' : 'w');
      }
      cells.push(row);
    }
    cells[1][gate] = 'w'; cells[START.y][START.x] = 'w'; cells[START.y - 1][START.x] = 'w';
    const inst = { kind: 'rocks', cells, gate, berths: [], berth: -1, current: null };
    const d = bfs(inst);
    if (d >= 10 && d <= 16 && Math.abs(gate - START.x) >= 2) return { ...inst, dist: d };
  }
  throw new Error('rocks gen failed');
}
export function genHarbor(seed) {
  const rnd = rngFor(seed);
  const berths = [1, 3, 5];
  for (let t = 0; t < 600; t++) {
    const cells = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        if (y === 0) row.push(berths.includes(x) ? 'b' : 'p');
        else if (y === 1 || y === H - 1) row.push('w');
        else row.push(rnd() < 0.2 ? 'boat' : 'w');
      }
      cells.push(row);
    }
    const cy = 3 + Math.floor(rnd() * 3), dir = rnd() < 0.5 ? 1 : -1;
    const x0 = Math.floor(rnd() * 3), len = 4 + Math.floor(rnd() * 3);
    const current = {};
    for (let x = x0; x < Math.min(W, x0 + len); x++) { cells[cy][x] = 'w'; current[key(x, cy)] = dir; }
    cells[START.y][START.x] = 'w';
    const berth = Math.floor(rnd() * 3);
    const inst = { kind: 'harbor', cells, gate: -1, berths, berth, current, currentRow: cy, currentDir: dir };
    const d = bfs(inst);
    if (d < 9 || d > 17) continue;
    // the current has to matter: without it the route would be different or shorter
    const calm = bfs({ ...inst, current: {} });
    if (calm === d) continue;
    return { ...inst, dist: d };
  }
  throw new Error('harbor gen failed');
}

/* ---------------- Room 1, stage 4: find the ship with the beam ---------------- */
export function genBeam(seed) {
  const rnd = rngFor(seed);
  let b = 0;
  while (Math.abs(b) < 14) b = Math.round(-62 + rnd() * 124);
  return { bearing: b, tol: 7 };
}

/* ---------------- the Captain's chart is old: one rock missing, one that is not there ---------------- */
export function shortestPath(inst) {
  const prev = new Map([[key(START.x, START.y), null]]), q = [[START.x, START.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, c = cellAt(inst, nx, ny);
      const goal = c === 'g' || (c === 'b' && inst.berths.indexOf(nx) === inst.berth);
      if (c !== 'w' && !goal) continue;
      const r = { x: nx, y: ny, goal };
      const k = key(r.x, r.y);
      if (prev.has(k)) continue;
      prev.set(k, key(x, y));
      if (r.goal) { const out = []; let c = k; while (c) { const [a, b] = c.split(',').map(Number); out.unshift([a, b]); c = prev.get(c); } return out; }
      q.push([r.x, r.y]);
    }
  }
  return null;
}
export function chartErrors(inst, seed) {
  const rnd = rngFor(seed + ':chart'), path = shortestPath(inst) || [];
  const onPath = new Set(path.map(([x, y]) => key(x, y)));
  const mid = path.slice(2, -2).filter(([x, y]) => cellAt(inst, x, y) === 'w' && !currentAt(inst, x, y));
  const phantom = mid.length ? mid[Math.floor(rnd() * mid.length)] : null;
  const near = [];
  for (const [x, y] of path) for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; const c = cellAt(inst, nx, ny); if (inb(nx, ny) && ny > 0 && (c === 'r' || c === 'boat') && !onPath.has(key(nx, ny))) near.push([nx, ny]); }
  if (!near.length) {
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) { const c = cellAt(inst, x, y); if ((c === 'r' || c === 'boat') && path.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) <= 2)) near.push([x, y]); }
  }
  const missing = near.length ? near[Math.floor(rnd() * near.length)] : null;
  return { phantom, missing };
}

/* ---------------- the mission reducer ---------------- */
export function newMission(n, cfg) {
  return {
    n, phase: 'brief', cfg: { clock: !!cfg.clock, keeper: cfg.keeper === 1 ? 1 : 0 }, ready: [false, false],
    startedAt: null, endedAt: null, room: 1, att: { 1: 0, 2: 0 }, stage: 0, strikes: 0, channel: false,
    pulled: {}, lastSig: null, lastPrime: null, ask: null, hint: null, flares: 0, flareSeq: -1,
    moored: false, lastHitAt: null, resets: 0, scrapes: 0, stormHits: 0, trusted: false, openedEarly: false,
    debrief: [null, null], result: null, last: { seq: -1, kind: null }
  };
}
export const stageName = (M) => STAGES[M.room][M.stage];
export const hintKey = (M) => M.room + ':' + M.att[M.room] + ':' + M.stage;
export const keeperOf = (M) => M.cfg.keeper;
export const captainOf = (M) => 1 - M.cfg.keeper;
export const handsOf = (M) => (M.room === 1 ? keeperOf(M) : captainOf(M));
export function instFor(base, M) {
  if (M.phase !== 'play') return null;
  const s = base + ':m' + M.n + ':r' + M.room + 'a' + M.att[M.room] + 's' + M.stage;
  switch (stageName(M)) {
    case 'prime': return genPrime(s);
    case 'clockwork': return genClockwork(s, 5);
    case 'signal': return genSignal(s);
    case 'beam': return genBeam(s);
    case 'rocks': return genRocks(s);
    default: return genHarbor(s);
  }
}
const dsecs = (a, b) => { if (!a || !b) return null; const x = Date.parse(a), y = Date.parse(b); return isNaN(x) || isNaN(y) ? null : Math.max(0, Math.round((y - x) / 1000)); };
export const askable = (M) => M.phase === 'play' && stageName(M) !== 'prime' && !(M.room === 2 && M.moored);
export const STAGE_COUNT = STAGES[1].length + STAGES[2].length;

export function reduce(events, baseSeed) {
  const list = events.slice().sort((a, b) => a.seq - b.seq);
  let M = newMission(1, { clock: false, keeper: 0 });
  const log = [];
  let inst = null;
  const refresh = () => { inst = instFor(baseSeed, M); };
  const logIt = (result, ev) => {
    M.result = result; M.endedAt = ev.created_at || null;
    log.push({ n: M.n, result, clock: M.cfg.clock, secs: dsecs(M.startedAt, M.endedAt), resets: M.resets, scrapes: M.scrapes, flares: M.flares, stormHits: M.stormHits, trusted: M.trusted, openedEarly: M.openedEarly, date: ev.created_at || null, debrief: M.debrief, keeper: M.cfg.keeper });
  };
  const resetStage = () => { M.pulled = {}; M.lastSig = null; M.lastPrime = null; M.ask = null; M.moored = false; };
  const strike = (ev, kind, extra) => {
    M.strikes++; M.last = { seq: ev.seq, kind, ...extra };
    if (M.strikes >= MAX_STRIKES) {
      // three slips: this stage starts over with a fresh puzzle; finished stages stay finished
      M.resets++; M.strikes = 0; M.att[M.room]++; M.hint = null; resetStage();
      M.last = { seq: ev.seq, kind: 'reset', room: M.room, stage: stageName(M) }; refresh();
    }
  };
  const clear = (ev) => {
    M.stage++; M.hint = null; resetStage();
    if (M.stage >= STAGES[M.room].length) { M.room = 2; M.stage = 0; M.strikes = 0; M.last = { seq: ev.seq, kind: 'roomclear' }; }
    else M.last = { seq: ev.seq, kind: 'clear', stage: stageName(M) };
    refresh();
  };
  const ctxOk = (pl, p, room, stage) => M.phase === 'play' && M.room === room && stageName(M) === stage && p === handsOf(M) && pl.a === M.att[M.room] && pl.s === M.stage;

  for (const ev of list) {
    const p = ev.player, pl = ev.payload || {}, k = ev.kind;
    if (p !== 0 && p !== 1) continue;
    if (k === 'newmission') {
      if (pl.m !== M.n || M.phase === 'brief') continue;
      if (M.phase === 'play') logIt('aborted', ev);
      M = newMission(M.n + 1, M.cfg); inst = null; continue;
    }
    if (pl.m !== M.n) continue;
    if (k === 'config') {
      if (M.phase === 'brief') { M.cfg = { clock: !!pl.clock, keeper: pl.keeper === 1 ? 1 : 0 }; M.ready = [false, false]; }
    } else if (k === 'ready') {
      if (M.phase !== 'brief') continue;
      M.ready[p] = true;
      if (M.ready[0] && M.ready[1]) { M.phase = 'play'; M.startedAt = ev.created_at || null; M.last = { seq: ev.seq, kind: 'start' }; refresh(); }
    } else if (k === 'timeup') {
      if (M.phase === 'play' && M.cfg.clock) { M.phase = 'failed'; M.last = { seq: ev.seq, kind: 'timeup' }; logIt('failed', ev); inst = null; }
    } else if (k === 'channel') {
      if (M.phase === 'play' && M.room === 1 && p === keeperOf(M) && !M.channel) { M.channel = true; M.openedEarly = M.stage === 0; M.last = { seq: ev.seq, kind: 'channel' }; }
    } else if (k === 'restart') {
      // either of you can call a do-over from the Rough night menu
      if (M.phase !== 'play' || (pl.scope !== 'stage' && pl.scope !== 'room') || pl.a !== M.att[M.room] || pl.s !== M.stage) continue;
      M.resets++; M.strikes = 0; M.att[M.room]++; M.hint = null; resetStage();
      if (pl.scope === 'room') M.stage = 0;
      M.last = { seq: ev.seq, kind: 'restart', scope: pl.scope, by: p }; refresh();
    } else if (k === 'trusted') {
      if (M.phase === 'play' && M.room === 2 && p === captainOf(M) && !M.trusted) { M.trusted = true; M.last = { seq: ev.seq, kind: 'trusted' }; }
    } else if (k === 'ask') {
      if (askable(M) && p === handsOf(M) && M.flares < FLARES && M.hint !== hintKey(M) && pl.key === hintKey(M) && !(M.room === 1 && !M.channel)) {
        M.ask = hintKey(M); M.last = { seq: ev.seq, kind: 'ask', by: p };
      }
    } else if (k === 'flare') {
      if (M.phase === 'play' && p !== handsOf(M) && M.ask === hintKey(M) && M.flares < FLARES) {
        M.flares++; M.hint = M.ask; M.ask = null; M.flareSeq = ev.seq; M.last = { seq: ev.seq, kind: 'flare', by: p };
      }
    } else if (k === 'prime') {
      if (!ctxOk(pl, p, 1, 'prime') || !Array.isArray(pl.v) || pl.v.length !== 3) continue;
      const v = pl.v.map((x) => Math.max(0, Math.min(4, x | 0)));
      if (primeValue(inst, v) === inst.target) clear(ev);
      else { M.lastPrime = primeValue(inst, v); strike(ev, 'wrong', { what: 'prime' }); }
    } else if (k === 'pin') {
      if (!ctxOk(pl, p, 1, 'clockwork') || typeof pl.w !== 'number' || pl.w < 0 || pl.w >= inst.n || M.pulled[pl.w]) continue;
      if (pl.w === inst.target) clear(ev);
      else { M.pulled = { ...M.pulled, [pl.w]: true }; strike(ev, 'wrong', { what: 'pin' }); }
    } else if (k === 'signal') {
      if (!ctxOk(pl, p, 1, 'signal')) continue;
      const pat = String(pl.p || '').replace(/[^SL]/g, '').slice(0, 5), col = pl.c | 0;
      if (pat === inst.pattern && col === inst.color) clear(ev);
      else { M.lastSig = { p: pat, c: col }; strike(ev, 'wrong', { what: 'signal' }); }
    } else if (k === 'contact') {
      if (!ctxOk(pl, p, 1, 'beam') || typeof pl.ang !== 'number') continue;
      if (Math.abs(pl.ang - inst.bearing) <= inst.tol + 0.5) clear(ev);
    } else if (k === 'hit') {
      // the Captain's phone runs the sea; it reports when the ship takes a hit
      if (M.phase !== 'play' || p !== captainOf(M) || pl.room !== M.room || pl.a !== M.att[M.room] || pl.s !== M.stage || M.moored) continue;
      const at = Date.parse(ev.created_at || '');
      if (M.lastHitAt !== null && !isNaN(at) && at - M.lastHitAt < 3500) continue;
      if (!isNaN(at)) M.lastHitAt = at;
      if (M.room === 2) M.scrapes++; else M.stormHits++;
      strike(ev, M.room === 1 ? 'storm' : 'scrape', { hit: pl.what || null });
    } else if (k === 'gate') {
      if (!ctxOk(pl, p, 2, 'rocks')) continue;
      clear(ev);
    } else if (k === 'moored') {
      if (!ctxOk(pl, p, 2, 'harbor') || M.moored) continue;
      if (pl.berth === inst.berth) { M.moored = true; M.ask = null; M.last = { seq: ev.seq, kind: 'moored' }; }
      else strike(ev, 'wrongberth', { berth: (pl.berth | 0) + 1 });
    } else if (k === 'tie') {
      if (M.phase !== 'play' || M.room !== 2 || !M.moored || p !== captainOf(M) || pl.a !== M.att[2]) continue;
      M.phase = 'done'; M.last = { seq: ev.seq, kind: 'complete' }; logIt('complete', ev); inst = null;
    } else if (k === 'debrief') {
      if ((M.phase === 'done' || M.phase === 'failed') && M.debrief[p] === null) M.debrief[p] = String(pl.text || '').trim().slice(0, 300);
    }
  }
  return {
    M, log, inst, hands: M.phase === 'play' ? handsOf(M) : null,
    prompt: DEBRIEFS[xmur3(baseSeed + ':db' + M.n)() % DEBRIEFS.length]
  };
}

/* End of night awards. Asking for help earns one on purpose. */
export function awards(x) {
  const out = [];
  if (x.trusted) out.push({ t: 'Trusted the tower', d: 'Sailed straight through a rock that was only on the chart.' });
  if (x.flares > 0) out.push({ t: 'Asked for help', d: 'Called for a flare instead of guessing alone.' });
  if (x.openedEarly) out.push({ t: 'Let them in early', d: 'The radio went on before it was needed.' });
  if (x.stormHits === 0) out.push({ t: 'Steady at the wheel', d: 'Not one wave over the bow.' });
  if (x.scrapes === 0) out.push({ t: 'Not a scratch', d: 'Through the fog without touching a rock.' });
  if (x.resets > 0) out.push({ t: 'Weathered it', d: 'Started over and still made it home.' });
  if (x.secs !== null && x.secs < 420) out.push({ t: 'Swift as the beam', d: 'Home in under seven minutes.' });
  return out;
}
