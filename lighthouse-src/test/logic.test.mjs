import * as L from '../src/logic.js';
import * as P from '../src/sim.js';
let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
for (let i = 0; i < 800; i++) {
  const c = L.genClockwork('c' + i); if (!(c.target >= 0 && c.target < c.n) || c.matched === 0) fail('clock');
  const s = L.genSignal('s' + i); if (s.list.length !== 8) fail('signal');
  const b = L.genBeam('b' + i); if (Math.abs(b.bearing) < 14 || Math.abs(b.bearing) > 62) fail('beam');
  const r = L.genRocks('r' + i), h = L.genHarbor('h' + i);
  for (const inst of [r, h]) { const e = L.chartErrors(inst, 'e' + i); if (!e.phantom) fail('no phantom ' + inst.kind + i); if (!e.missing) console.log('note: no missing rock', inst.kind, i); }
}
console.log('generators done, failures', bad);

// autopilot: steer along the shortest path, the way she would talk him in
export function sail(inst, maxT = 240) {
  const path = L.shortestPath(inst); let s = P.newShip(), t = 0, wp = 1, hits = 0, ev = null;
  while (t < maxT) {
    const [cx, cy] = path[Math.min(wp, path.length - 1)], tx = cx + 0.5, ty = cy + 0.5;
    if (Math.hypot(tx - s.x, ty - s.y) < 0.3 && wp < path.length - 1) wp++;
    const want = Math.atan2(tx - s.x, -(ty - s.y)); let d = want - s.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const near = wp === path.length - 1;
    const r = P.shipStep(s, { rudder: Math.max(-1, Math.min(1, d * 2.5)), throttle: Math.abs(d) > 0.6 ? 0.25 : near ? 0.3 : 0.85 }, 1 / 30, inst);
    s = r.s; t += 1 / 30;
    if (r.ev) { if (r.ev.kind === 'hit') hits++; else { ev = r.ev; break; } }
  }
  return { t, hits, ev };
}
let tot = 0, slow = 0, fails = 0;
for (let i = 0; i < 300; i++) {
  for (const inst of [L.genRocks('r' + i), L.genHarbor('h' + i)]) {
    const r = sail(inst); tot += r.t;
    if (!r.ev || (inst.kind === 'rocks' && r.ev.kind !== 'gate') || (inst.kind === 'harbor' && (r.ev.kind !== 'moored' || r.ev.berth !== inst.berth))) { fails++; if (fails < 4) console.log('autopilot failed', inst.kind, i, r); }
    if (r.t > 90) slow++;
  }
}
console.log('autopilot: avg', (tot / 600).toFixed(1), 's, slow', slow, 'failed', fails);
// storm: ignored vs held
let st = P.newStorm(), hitsIgnored = 0; for (let t = 0; t < 120; t += 1 / 30) { const r = P.stormStep(st, 0, 1 / 30, 1); st = r.st; if (r.hit) hitsIgnored++; }
st = P.newStorm(); let hitsHeld = 0; for (let t = 0; t < 120; t += 1 / 30) { const rud = Math.max(-1, Math.min(1, (st.ang * 0.04 + st.vel * 0.03))); const r = P.stormStep(st, rud, 1 / 30, 1); st = r.st; if (r.hit) hitsHeld++; }
console.log('storm hits per 2 min: ignored', hitsIgnored, 'held', hitsHeld);

// full mission through the reducer
const seed = 'zz'; let ev = [], seq = 0; const t0 = Date.parse('2026-11-21T20:00:00Z');
const push = (p, kind, payload, dt = 1000) => ev.push({ seq: seq++, player: p, kind, payload, created_at: new Date(t0 + seq * dt).toISOString() });
let S = () => L.reduce(ev, seed), s;
push(1, 'config', { m: 1, clock: false, keeper: 0 }); push(0, 'ready', { m: 1 }); push(1, 'ready', { m: 1 }); s = S();
const solvePrime = (I) => { for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++) if (L.primeValue(I, [a, b, c]) === I.target) return [a, b, c]; };
push(1, 'hit', { m: 1, a: 0, s: 0, room: 1, what: 'storm' }); push(1, 'hit', { m: 1, a: 0, s: 0, room: 1 }, 1000); s = S(); console.log('storm hit strikes (cooldown)', s.M.strikes);
push(0, 'prime', { m: 1, a: 0, s: 0, v: solvePrime(s.inst) }); s = S();
push(0, 'channel', { m: 1 }); push(0, 'pin', { m: 1, a: 0, s: 1, w: s.inst.target }); s = S();
push(0, 'signal', { m: 1, a: 0, s: 2, p: s.inst.pattern, c: s.inst.color }); s = S(); console.log('stage', L.stageName(s.M));
push(0, 'contact', { m: 1, a: 0, s: 3, ang: s.inst.bearing + 20 }); s = S(); console.log('far contact ignored', L.stageName(s.M));
push(0, 'contact', { m: 1, a: 0, s: 3, ang: s.inst.bearing + 3 }); s = S(); console.log('room', s.M.room, L.stageName(s.M), 'strikes', s.M.strikes);
push(1, 'gate', { m: 1, a: 0, s: 0 }); s = S(); console.log('stage', L.stageName(s.M));
push(1, 'moored', { m: 1, a: 0, s: 1, berth: (s.inst.berth + 1) % 3 }); s = S(); console.log('wrong berth', s.M.last.kind, s.M.strikes);
push(1, 'moored', { m: 1, a: 0, s: 1, berth: s.inst.berth }); s = S(); console.log('moored', s.M.moored);
push(0, 'tie', { m: 1, a: 0 }); s = S(); console.log('keeper tie ignored', s.M.phase);
push(1, 'tie', { m: 1, a: 0 }); s = S(); console.log('done', s.M.phase, s.log[0].result);
// stage-level reset and the restart menu
{ let e2 = [], q = 0; const P2 = (p, kind, payload) => e2.push({ seq: q++, player: p, kind, payload, created_at: new Date(t0 + q * 5000).toISOString() });
  P2(0, 'ready', { m: 1 }); P2(1, 'ready', { m: 1 }); let r = L.reduce(e2, 'rr');
  const sol = solvePrime(r.inst); P2(0, 'prime', { m: 1, a: 0, s: 0, v: sol }); r = L.reduce(e2, 'rr');
  for (let i = 0; i < 3; i++) { r = L.reduce(e2, 'rr'); const wrong = [...Array(r.inst.n).keys()].find((w) => w !== r.inst.target && !r.M.pulled[w]); P2(0, 'pin', { m: 1, a: r.M.att[1], s: 1, w: wrong }); }
  r = L.reduce(e2, 'rr'); console.log('3 strikes keeps stage:', L.stageName(r.M), 'att', r.M.att[1], 'strikes', r.M.strikes);
  P2(1, 'restart', { m: 1, scope: 'room', a: r.M.att[1], s: r.M.stage }); r = L.reduce(e2, 'rr'); console.log('room restart ->', L.stageName(r.M), r.M.last.kind);
  P2(0, 'restart', { m: 1, scope: 'stage', a: 0, s: 0 }); r = L.reduce(e2, 'rr'); console.log('stale restart ignored, att', r.M.att[1]);
  console.log('awards sample', L.awards({ trusted: true, flares: 1, openedEarly: true, stormHits: 0, scrapes: 2, resets: 1, secs: 380 }).map((a) => a.t).join(' | '));
}
process.exit(bad || fails ? 1 : 0);
