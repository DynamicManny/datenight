import { useEffect, useRef } from 'react';
import { W, H } from './logic.js';
import { TOWER } from './geo.js';

export const COLS = 'ABCDEFG';
const LIT_MS = 2600;

/* The Keeper's view from the top of the tower. Fog over everything. The beam is hers:
   it sweeps on its own, and wherever she drags, it points. Rocks only show while the
   light is on them. The ship is the one moving light she can always see. */
export default function FogChart({ inst, shipRef, beamRef, flareUntil, onAim }) {
  const cv = useRef(null), wrap = useRef(null);
  const st = useRef({ aim: null, sweepT: 0, lit: new Map(), trail: [] });

  useEffect(() => {
    const c = cv.current, ctx = c.getContext('2d');
    let w = 0, h = 0, cell = 0, raf = 0, last = performance.now();
    const fit = () => {
      if (!wrap.current) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), r = wrap.current.getBoundingClientRect();
      cell = Math.min(r.width / (W + 1.1), r.height / (H + 1.1));
      w = cell * (W + 1.1); h = cell * (H + 1.1);
      c.style.width = w + 'px'; c.style.height = h + 'px'; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap.current);
    const P = (x, y) => [cell * 0.55 + x * cell, cell * 0.2 + y * cell];

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = st.current, t = now / 1000;
      // aim the beam
      if (s.aim === null) { s.sweepT += dt; beamRef.current = -Math.PI + (Math.sin(s.sweepT * 0.45) * 0.5 + 0.5) * (Math.PI / 2 + 0.25) - 0.12; }
      else { let d = s.aim - beamRef.current; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; beamRef.current += d * Math.min(1, dt * 6); }
      const beam = beamRef.current, [tx, ty] = P(TOWER.x, TOWER.y), flare = flareUntil && now < flareUntil;

      ctx.fillStyle = '#071319'; ctx.fillRect(0, 0, w, h);
      // chart squares, so you two can name places out loud
      ctx.strokeStyle = 'rgba(160,200,210,.09)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x++) { const [a, b] = P(x, 0), [, d] = P(x, H); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, d); ctx.stroke(); }
      for (let y = 0; y <= H; y++) { const [a, b] = P(0, y), [c2] = P(W, y); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, b); ctx.stroke(); }
      ctx.fillStyle = 'rgba(214,230,228,.75)'; ctx.font = `600 ${Math.round(cell * 0.28)}px "Barlow Semi Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let x = 0; x < W; x++) { const [a] = P(x + 0.5, 0); ctx.fillText(COLS[x], a, P(0, H)[1] + cell * 0.28); }
      ctx.textAlign = 'right';
      for (let y = 0; y < H; y++) { const [, b] = P(0, y + 0.5); ctx.fillText(String(y + 1), cell * 0.43, b); }

      // what the beam touches lights up for a moment
      const inBeam = (x, y) => { const [px, py] = P(x, y); let d = Math.atan2(py - ty, px - tx) - beam; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) < 0.11; };
      inst.cells.forEach((row, y) => row.forEach((k, x) => {
        const id = x + ',' + y;
        if ((k === 'r' || k === 'boat') && inBeam(x + 0.5, y + 0.5)) s.lit.set(id, now);
        const lt = s.lit.get(id), a = flare ? 1 : lt ? Math.max(0, 1 - (now - lt) / LIT_MS) : 0;
        const [px, py] = P(x, y);
        if (k === 'r' && a > 0) {
          ctx.globalAlpha = a; ctx.fillStyle = '#c9d4d6';
          ctx.beginPath(); const cx = px + cell / 2, cy = py + cell / 2, R = cell * 0.36;
          for (let i = 0; i < 7; i++) { const an = i / 7 * Math.PI * 2, rr = R * (0.78 + ((x * 7 + y * 3 + i * 5) % 5) * 0.06); ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); }
          ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        }
        if (k === 'boat' && a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#b8a48a'; ctx.beginPath(); ctx.ellipse(px + cell / 2, py + cell / 2, cell * 0.18, cell * 0.38, 0.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        if (k === 'p') { ctx.fillStyle = '#3a3128'; ctx.fillRect(px, py + cell * 0.1, cell, cell * 0.8); }
        if (k === 'b') {
          const n = inst.berths.indexOf(x) + 1;
          ctx.strokeStyle = 'rgba(255,217,138,.7)'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py + 3, cell - 6, cell - 6);
          ctx.fillStyle = '#ffd98a'; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(cell * 0.42)}px "IM Fell English", serif`; ctx.fillText(String(n), px + cell / 2, py + cell / 2 + 1);
        }
        if (k === 'g') {
          ctx.fillStyle = '#e8473a'; ctx.beginPath(); ctx.arc(px + cell * 0.1, py + cell / 2, cell * 0.11, 0, 7); ctx.fill();
          ctx.fillStyle = '#3fc27a'; ctx.beginPath(); ctx.arc(px + cell * 0.9, py + cell / 2, cell * 0.11, 0, 7); ctx.fill();
        }
        if (inst.current && inst.current[x + ',' + y]) {
          const lit = flare || inBeam(x + 0.5, y + 0.5) || (s.lit.get('c' + id) && now - s.lit.get('c' + id) < LIT_MS);
          if (inBeam(x + 0.5, y + 0.5)) s.lit.set('c' + id, now);
          if (lit) {
            const dir = inst.current[x + ',' + y], off = ((t * 0.8) % 1) * cell * 0.5 * dir;
            ctx.strokeStyle = 'rgba(120,210,230,.8)'; ctx.lineWidth = 2;
            for (const k2 of [-0.18, 0.18]) { const yy = py + cell / 2 + k2 * cell, x0 = px + cell / 2 - dir * cell * 0.2 + off; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + dir * cell * 0.22, yy); ctx.lineTo(x0 + dir * cell * 0.12, yy - cell * 0.07); ctx.moveTo(x0 + dir * cell * 0.22, yy); ctx.lineTo(x0 + dir * cell * 0.12, yy + cell * 0.07); ctx.stroke(); }
          }
        }
      }));

      // fog
      ctx.fillStyle = flare ? 'rgba(200,214,224,.05)' : 'rgba(150,170,182,.16)'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { const fx = ((i * 0.37 + t * 0.012 * (i % 2 ? 1 : -1)) % 1.4 - 0.2) * w, fy = (0.15 + i * 0.15) * h; const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, w * 0.45); g.addColorStop(0, 'rgba(190,206,214,.12)'); g.addColorStop(1, 'rgba(190,206,214,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }

      // the beam
      const L = Math.hypot(w, h) * 1.2;
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, L); g.addColorStop(0, 'rgba(255,217,138,.55)'); g.addColorStop(0.5, 'rgba(255,217,138,.14)'); g.addColorStop(1, 'rgba(255,217,138,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(beam - 0.11) * L, ty + Math.sin(beam - 0.11) * L); ctx.lineTo(tx + Math.cos(beam + 0.11) * L, ty + Math.sin(beam + 0.11) * L); ctx.closePath(); ctx.fill();
      // the tower
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(tx, ty, cell * 0.16, 0, 7); ctx.fill();
      const gl = ctx.createRadialGradient(tx, ty, 0, tx, ty, cell * 0.8); gl.addColorStop(0, 'rgba(255,217,138,.6)'); gl.addColorStop(1, 'rgba(255,217,138,0)'); ctx.fillStyle = gl; ctx.fillRect(tx - cell, ty - cell, cell * 2, cell * 2);

      // the ship: always visible, its lantern cuts through
      const sh = shipRef.current;
      if (sh) {
        if (!s.trail.length || now - s.trail[s.trail.length - 1].t > 120) s.trail.push({ x: sh.x, y: sh.y, t: now });
        s.trail = s.trail.filter((p) => now - p.t < 3200);
        s.trail.forEach((p) => { const [px, py] = P(p.x, p.y), a = 1 - (now - p.t) / 3200; ctx.fillStyle = `rgba(220,240,245,${0.35 * a})`; ctx.beginPath(); ctx.arc(px, py, cell * 0.05, 0, 7); ctx.fill(); });
        const [px, py] = P(sh.x, sh.y);
        const sg = ctx.createRadialGradient(px, py, 0, px, py, cell * 0.7); sg.addColorStop(0, 'rgba(255,190,90,.75)'); sg.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = sg; ctx.fillRect(px - cell, py - cell, cell * 2, cell * 2);
        ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(px, py, cell * 0.11 * (1 + Math.sin(t * 5) * 0.12), 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const aim = (e) => {
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, [tx, ty] = P(TOWER.x, TOWER.y);
      st.current.aim = Math.atan2(y - ty, x - tx);
    };
    const down = (e) => { c.setPointerCapture(e.pointerId); aim(e); onAim && onAim(true); };
    const move = (e) => { if (st.current.aim !== null) aim(e); };
    const up = () => { if (st.current.aim === null) return; const b = beamRef.current; st.current.aim = null; st.current.sweepT = Math.asin(Math.max(-1, Math.min(1, ((b + Math.PI + 0.12) / (Math.PI / 2 + 0.25) - 0.5) * 2))) / 0.45; onAim && onAim(false); };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); };
  }, [inst, shipRef, beamRef, flareUntil, onAim]);

  return <div className="fogchart" ref={wrap}><canvas ref={cv} aria-label="View from the tower. Drag to aim the light." /></div>;
}
