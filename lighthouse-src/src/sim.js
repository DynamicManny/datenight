// Real-time physics. Pure functions so both the phones and the tests run the same sea.
import { W, H, START, cellAt, currentAt } from './logic.js';

export const SHIP_R = 0.24;
export const MAX_V = 0.6;      // cells per second at full ahead
export const TURN = 1.3;       // radians per second at full rudder
export const CUR_V = 0.2;     // how hard the current shoves, cells per second
export const DOCK_V = 0.2;     // faster than this into a berth and you hit the dock
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Room 2: the ship in the fog ---------- */
export const newShip = () => ({ x: START.x + 0.5, y: START.y + 0.5, h: 0, v: 0, cool: 0 });

function solidAt(inst, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return 'edge';
  const c = cellAt(inst, Math.floor(x), Math.floor(y));
  return c === 'r' || c === 'p' || c === 'boat' ? c : null;
}

// One tick. input = { rudder: -1..1, throttle: -0.35..1 }. Returns the new ship and maybe one event.
export function shipStep(s0, input, dt, inst) {
  const s = { ...s0, cool: Math.max(0, s0.cool - dt) };
  const target = clamp(input.throttle, -0.35, 1) * MAX_V;
  s.v += (target - s.v) * Math.min(1, dt * 0.9);
  const grip = 0.35 + 0.65 * Math.min(1, Math.abs(s.v) / 0.25);
  s.h += clamp(input.rudder, -1, 1) * TURN * grip * dt * (s.v < -0.01 ? -1 : 1);
  let nx = s.x + Math.sin(s.h) * s.v * dt, ny = s.y - Math.cos(s.h) * s.v * dt;
  const cur = currentAt(inst, Math.floor(nx), Math.floor(ny));
  if (cur) nx += cur * CUR_V * dt;

  let hit = null;
  for (const [ox, oy] of [[0, 0], [SHIP_R, 0], [-SHIP_R, 0], [0, SHIP_R], [0, -SHIP_R]]) {
    const k = solidAt(inst, nx + ox, ny + oy);
    if (k) { hit = k; break; }
  }
  if (hit) {
    s.v = -0.06; // bounce off
    if (s.cool <= 0) { s.cool = 1.6; return { s, ev: { kind: 'hit', what: hit } }; }
    return { s };
  }
  const cell = cellAt(inst, Math.floor(nx), Math.floor(ny));
  if (cell === 'b') {
    const berth = inst.berths.indexOf(Math.floor(nx));
    if (Math.abs(s.v) > DOCK_V) {
      s.v = -0.08;
      if (s.cool <= 0) { s.cool = 1.6; return { s, ev: { kind: 'hit', what: 'dock' } }; }
      return { s };
    }
    if (berth !== inst.berth) { s.v = -0.1; s.y += 0.05; if (s.cool <= 0) { s.cool = 2.5; return { s, ev: { kind: 'moored', berth } }; } return { s }; }
    s.x = nx; s.y = Math.max(ny, 0.55); s.v = 0;
    return { s, ev: { kind: 'moored', berth } };
  }
  s.x = nx; s.y = ny;
  if (cell === 'g') return { s, ev: { kind: 'gate' } };
  return { s };
}

/* ---------- Room 1: keep the bow into the storm ---------- */
// ang: degrees off the wind. Stay inside +-ZONE. Strain builds outside it; at 100 the ship takes a hit.
export const ZONE = 18;
export const newStorm = () => ({ ang: 0, vel: 0, strain: 0, gust: 0, gustT: 7, t: 0 });
export function stormStep(st0, rudder, dt, level, rnd = Math.random) {
  const st = { ...st0, t: st0.t + dt, gustT: st0.gustT - dt };
  if (st.gustT <= 0) {
    st.gust = (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 20) * level;
    st.gustT = 1.4 + rnd() * 2.2;
  }
  const torque = st.gust - clamp(rudder, -1, 1) * 46 - st.ang * 0.35;
  st.vel = (st.vel + torque * dt) * (1 - Math.min(1, 1.6 * dt));
  st.ang = clamp(st.ang + st.vel * dt, -75, 75);
  const over = Math.abs(st.ang) - ZONE;
  st.strain = clamp(st.strain + (over > 0 ? (3 + over * 0.35) * dt : -10 * dt), 0, 100);
  if (st.strain >= 100) { st.strain = 30; return { st, hit: true }; }
  return { st, hit: false };
}
// The storm eases as the Keeper gets the light going.
export const stormLevel = (stage, channel) => [1, 0.85, 0.7, 0.55][stage] * (channel ? 1 : 1.1);
