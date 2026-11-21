import * as L from '../src/logic.js';
let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
for (let i = 0; i < 1500; i++) {
  const p = L.genPrime('p' + i); if (p.target < 7 || p.target > 17) fail('prime');
  const c = L.genClockwork('c' + i); if (!(c.target >= 0 && c.target < c.n) || c.matched === 0) fail('clock ' + i);
  const s = L.genSignal('s' + i);
  const vis = s.plate.hide === 'adj' ? s.plate.noun : s.plate.adj;
  const m = s.list.filter((e) => e.name.split(' ')[s.plate.hide === 'adj' ? 1 : 0] === vis && e.year === s.plate.year);
  if (m.length !== 1 || m[0].p !== s.pattern || s.list.length !== 8 || new Set(s.list.map((e) => e.name)).size !== 8) fail('signal ' + i);
  const r = L.genRocks('r' + i); if (r.dist < 10) fail('rocks');
  const h = L.genHarbor('h' + i); if (h.dist < 9) fail('harbor');
}
console.log('generators ok, failures:', bad);

// play a full mission by solving every stage from the inside
function solvePath(inst) { // BFS returning list of [dx,dy]
  const st = { x: L.START.x, y: L.START.y }, q = [[st.x, st.y, []]], seen = new Set([st.x + ',' + st.y]);
  while (q.length) { const [x, y, path] = q.shift();
    for (let d = 0; d < 4; d++) { const [dx, dy] = L.DIRS[d]; const r = L.stepResult(inst, x, y, dx, dy);
      if (r.blocked) continue; if (r.goal) return [...path, d];
      const k = r.x + ',' + r.y; if (!seen.has(k)) { seen.add(k); q.push([r.x, r.y, [...path, d]]); } } }
}
const seed = 'zz'; let ev = [], seq = 0; const t0 = Date.parse('2026-11-21T20:00:00Z');
const push = (p, kind, payload) => ev.push({ seq: seq++, player: p, kind, payload, created_at: new Date(t0 + seq * 1000).toISOString() });
const S = () => L.reduce(ev, seed);
push(1, 'config', { m: 1, clock: true, keeper: 0 }); push(0, 'ready', { m: 1 }); push(1, 'ready', { m: 1 });
let s = S(); console.log('phase', s.M.phase, 'hands', s.hands, 'stage', L.stageName(s.M));
// captain cannot act in room 1, ask blocked before channel
push(1, 'ask', { m: 1, key: L.hintKey(s.M) }); s = S(); console.log('ask during prime ignored:', s.M.ask === null);
// solve prime
const I = s.inst; let v = null;
for (let a = 0; a < 5 && !v; a++) for (let b = 0; b < 5 && !v; b++) for (let c = 0; c < 5 && !v; c++) if (L.primeValue(I, [a, b, c]) === I.target) v = [a, b, c];
push(0, 'prime', { m: 1, a: 0, s: 0, v: [0, 0, 0] }); s = S(); console.log('wrong prime strike', s.M.strikes);
push(0, 'prime', { m: 1, a: 0, s: 0, v }); s = S(); console.log('stage', L.stageName(s.M));
push(0, 'ask', { m: 1, key: L.hintKey(s.M) }); s = S(); console.log('ask before channel ignored', s.M.ask);
push(0, 'channel', { m: 1 }); push(0, 'ask', { m: 1, key: L.hintKey(s.M) }); s = S(); console.log('ask after channel', s.M.ask);
push(0, 'flare', { m: 1 }); s = S(); console.log('keeper cannot flare own ask', s.M.flares);
push(1, 'flare', { m: 1 }); s = S(); console.log('flare sent', s.M.flares, s.M.hint === L.hintKey(s.M));
push(0, 'pin', { m: 1, a: 0, s: 1, w: s.inst.target }); s = S(); console.log('stage', L.stageName(s.M), 'strikes', s.M.strikes);
push(0, 'signal', { m: 1, a: 0, s: 2, p: 'S', c: 0 }); s = S(); console.log('wrong signal strikes', s.M.strikes, s.M.lastSig);
push(0, 'signal', { m: 1, a: 0, s: 2, p: 'SS', c: 2 }); s = S(); console.log('3rd strike reset', s.M.resets, L.stageName(s.M), s.M.att[1], 'channel kept', s.M.channel);
// resolve room 1 fresh
let g = s.inst; v = null;
for (let a = 0; a < 5 && !v; a++) for (let b = 0; b < 5 && !v; b++) for (let c = 0; c < 5 && !v; c++) if (L.primeValue(g, [a, b, c]) === g.target) v = [a, b, c];
push(0, 'prime', { m: 1, a: 1, s: 0, v }); s = S();
push(0, 'pin', { m: 1, a: 1, s: 1, w: s.inst.target }); s = S();
push(0, 'signal', { m: 1, a: 1, s: 2, p: s.inst.pattern, c: s.inst.color }); s = S();
console.log('room', s.M.room, 'hands', s.hands, L.stageName(s.M), 'strikes', s.M.strikes);
function sail(stageIdx) {
  const path = solvePath(s.inst); let h = s.M.ship.h;
  for (const d of path) {
    while (h !== d) { const diff = (d - h + 4) % 4; const t = diff === 3 ? -1 : 1; push(1, 'helm', { m: 1, a: s.M.att[2], s: stageIdx, d: t }); h = (h + t + 4) % 4; }
    push(1, 'ahead', { m: 1, a: s.M.att[2], s: stageIdx, n: 1 }); s = S();
  }
}
// one scrape into a rock first
s = S(); push(1, 'helm', { m: 1, a: 0, s: 0, d: -1 }); push(1, 'helm', { m: 1, a: 0, s: 0, d: -1 }); s = S();
const before = s.M.scrapes; push(1, 'ahead', { m: 1, a: 0, s: 0, n: 2 }); s = S(); console.log('moved south into edge -> scrape', s.M.scrapes - before, s.M.last.kind);
push(1, 'helm', { m: 1, a: 0, s: 0, d: 1 }); push(1, 'helm', { m: 1, a: 0, s: 0, d: 1 }); s = S();
sail(0); console.log('after rocks', L.stageName(s.M), s.M.ship);
sail(1); console.log('moored', s.M.moored, s.M.last.kind);
push(0, 'line', { m: 1, a: s.M.att[2] }); s = S(); console.log('one line', s.M.phase);
push(1, 'line', { m: 1, a: s.M.att[2] }); s = S(); console.log('both lines', s.M.phase, s.log[0].result, s.log[0].secs, 'scrapes', s.log[0].scrapes);
push(0, 'debrief', { m: 1, text: 'trusting the radio' }); push(1, 'newmission', { m: 1 }); s = S(); console.log('new', s.M.n, s.M.phase, s.log[0].debrief);
push(0, 'ready', { m: 2 }); push(1, 'ready', { m: 2 }); push(0, 'timeup', { m: 2 }); s = S(); console.log('timeup', s.M.phase);
// drift sanity: find a harbor where current pushes
const h = L.genHarbor('drift1'); console.log('current row', h.currentRow, 'dir', h.currentDir, 'dist', h.dist);
process.exit(bad ? 1 : 0);
