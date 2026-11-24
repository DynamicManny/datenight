// Real-time physics. Pure functions so both the phones and the tests run the same sea.
import { W, H, START, cellAt, currentAt } from './logic.js';

export const SHIP_R = 0.18;
export const ROCK_R = 0.32;   // rocks are round, and the same size you see them
export const BOAT_R = 0.26;
export const MAX_V = 0.6;      // cells per second at full ahead
export const TURN = 1.3;       // radians per second at full rudder
export const CUR_V = 0.2;     // how hard the current shoves, cells per second
export const DOCK_V = 0.2;     // faster than this into a berth and you hit the dock
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Room 2: the ship in the fog ---------- */
export const newShip = () => ({ x: START.x + 0.5, y: START.y + 0.5, h: 0, v: 0, cool: 0 });

function solidAt(inst, x, y) {
  if (x < SHIP_R || x > W - SHIP_R || y > H - SHIP_R || y < 0) return 'edge';
  const cx0 = Math.floor(x), cy0 = Math.floor(y);
  for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
    const c = cellAt(inst, cx, cy);
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
    if (c === 'r' || c === 'boat') {
      const r = c === 'r' ? ROCK_R : BOAT_R;
      if (Math.hypot(x - (cx + 0.5), y - (cy + 0.5)) < r + SHIP_R) return c;
    } else if (c === 'p') {
      const nx = Math.max(cx, Math.min(cx + 1, x)), ny = Math.max(cy + 0.1, Math.min(cy + 0.9, y));
      if (Math.hypot(x - nx, y - ny) < SHIP_R) return 'p';
    }
  }
  return null;
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

  const hit = solidAt(inst, nx, ny);
  if (hit) {
    // bump back off it, so you are never pinned against a rock
    s.x -= Math.sin(s.h) * 0.08 * Math.sign(s.v || 1); s.y += Math.cos(s.h) * 0.08 * Math.sign(s.v || 1);
    s.v = -0.05;
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
export const newStorm = () => ({ ang: 0, vel: 0, strain: 0, gust: 0, gustT: 10, t: 0 });
export function stormStep(st0, rudder, dt, level, rnd = Math.random) {
  const st = { ...st0, t: st0.t + dt, gustT: st0.gustT - dt };
  if (st.gustT <= 0) {
    // the first minute builds slowly so you can learn the wheel
    const ramp = Math.min(1, 0.35 + st.t / 70);
    st.gust = (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 20) * level * ramp;
    st.gustT = 1.4 + rnd() * 2.2;
  }
  const torque = st.gust - clamp(rudder, -1, 1) * 46 - st.ang * 0.35;
  st.vel = (st.vel + torque * dt) * (1 - Math.min(1, 1.6 * dt));
  st.ang = clamp(st.ang + st.vel * dt, -75, 75);
  const over = Math.abs(st.ang) - ZONE;
  st.strain = clamp(st.strain + (over > 0 ? (3 + over * 0.35) * dt * Math.min(1, 0.5 + st.t / 90) : -12 * dt), 0, 100);
  if (st.strain >= 100) { st.strain = 30; return { st, hit: true }; }
  return { st, hit: false };
}
// The storm eases as the Keeper gets the light going.
export const stormLevel = (stage, channel) => [1, 0.85, 0.7, 0.55][stage] * (channel ? 1 : 1.1);
