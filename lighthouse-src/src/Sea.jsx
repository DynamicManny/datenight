import { useEffect, useRef } from 'react';

// The living backdrop: sky, storm, sea, fog and the lighthouse itself.
// It stays mounted for the whole game so nothing resets when the state changes;
// it only eases toward whatever mood the scene asks for.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };

export default function Sea({ storm = 0.7, fog = 0, light = false, stars = false, lighthouse = true }) {
  const ref = useRef(null);
  const target = useRef({ storm, fog, light, stars, lighthouse });
  target.current = { storm, fog, light, stars, lighthouse };

  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d');
    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browsers */ }

    const drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), l: 0.5 + Math.random(), s: 0.7 + Math.random() * 0.8 }));
    const starList = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random() * 0.58, r: Math.random() * 1.2 + 0.3, t: Math.random() * 6 }));
    const fogs = Array.from({ length: 10 }, () => ({ x: Math.random() * 1.6 - 0.3, y: 0.3 + Math.random() * 0.7, r: 0.3 + Math.random() * 0.35, v: (Math.random() - 0.5) * 0.02 }));
    const t0 = target.current;
    const cur = { storm: t0.storm, fog: t0.fog, light: t0.light ? 1 : 0, stars: t0.stars ? 1 : 0, lh: t0.lighthouse ? 1 : 0 };
    let raf = 0, last = performance.now(), flash = 0;
    const start = last;

    const draw = (now) => {
      const dt = reduce ? 1 : Math.min(0.05, (now - last) / 1000); last = now;
      const t = reduce ? 3 : (now - start) / 1000, m = target.current;
      const ease = (k, v) => { cur[k] += (v - cur[k]) * Math.min(1, dt * 1.2); };
      ease('storm', m.storm); ease('fog', m.fog); ease('light', m.light ? 1 : 0); ease('stars', m.stars ? 1 : 0); ease('lh', m.lighthouse ? 1 : 0);
      const S = cur.storm, horizon = h * 0.6;

      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, mix('#14254a', '#060b16', S));
      g.addColorStop(0.58, mix('#2a3f66', '#0d1830', S));
      g.addColorStop(0.6, '#0b1a2e'); g.addColorStop(1, '#040912');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      if (cur.stars > 0.01) {
        ctx.fillStyle = '#fff';
        for (const s of starList) { ctx.globalAlpha = cur.stars * (0.45 + 0.55 * Math.sin(t * 1.1 + s.t) ** 2); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      // moon glow behind the clouds when it is calm
      const moon = ctx.createRadialGradient(w * 0.2, h * 0.16, 0, w * 0.2, h * 0.16, w * 0.5);
      moon.addColorStop(0, `rgba(255,236,200,${0.16 * (1 - S)})`); moon.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = moon; ctx.fillRect(0, 0, w, h);

      if (!reduce && S > 0.6 && Math.random() < dt * 0.09 * S) flash = 1;
      if (flash > 0) { ctx.fillStyle = `rgba(205,220,255,${flash * 0.22})`; ctx.fillRect(0, 0, w, h); flash -= dt * 3.5; }

      // the lighthouse on its rock
      if (cur.lh > 0.01) {
        const unit = Math.min(w, h * 0.7) / 380, lx = w * 0.8, base = horizon + 4 * unit;
        ctx.globalAlpha = cur.lh;
        ctx.fillStyle = '#081222';
        ctx.beginPath(); ctx.ellipse(lx, base + 6 * unit, 46 * unit, 12 * unit, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(lx - 11 * unit, base); ctx.lineTo(lx - 7 * unit, base - 70 * unit); ctx.lineTo(lx + 7 * unit, base - 70 * unit); ctx.lineTo(lx + 11 * unit, base); ctx.closePath();
        ctx.fillStyle = '#0d1a2f'; ctx.fill();
        ctx.fillStyle = 'rgba(242,232,210,.16)'; for (let i = 1; i < 4; i++) ctx.fillRect(lx - 9 * unit, base - i * 18 * unit, 18 * unit, 6 * unit);
        const ly = base - 78 * unit;
        ctx.fillStyle = '#0d1a2f'; ctx.fillRect(lx - 9 * unit, ly - 2 * unit, 18 * unit, 4 * unit);
        ctx.beginPath(); ctx.moveTo(lx - 7 * unit, ly - 10 * unit); ctx.lineTo(lx, ly - 17 * unit); ctx.lineTo(lx + 7 * unit, ly - 10 * unit); ctx.fill();
        const L = cur.light;
        ctx.fillStyle = L > 0.05 ? `rgba(255,214,130,${0.35 + 0.65 * L})` : '#1a263c';
        ctx.fillRect(lx - 5 * unit, ly - 9 * unit, 10 * unit, 8 * unit);
        if (L > 0.01) {
          const ang = Math.PI + Math.sin(t * 0.55) * 0.75, len = w * 1.6, spread = 0.09;
          const bx = lx, by = ly - 5 * unit;
          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, len);
          grad.addColorStop(0, `rgba(255,222,150,${0.55 * L})`); grad.addColorStop(0.35, `rgba(255,222,150,${0.16 * L})`); grad.addColorStop(1, 'rgba(255,222,150,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ang - spread) * len, by + Math.sin(ang - spread) * len);
          ctx.lineTo(bx + Math.cos(ang + spread) * len, by + Math.sin(ang + spread) * len);
          ctx.closePath(); ctx.fill();
          const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 60 * unit);
          glow.addColorStop(0, `rgba(255,226,160,${0.7 * L})`); glow.addColorStop(1, 'rgba(255,226,160,0)');
          ctx.fillStyle = glow; ctx.fillRect(bx - 60 * unit, by - 60 * unit, 120 * unit, 120 * unit);
        }
        ctx.globalAlpha = 1;
      }

      // waves, back to front
      const cols = ['#0e2240', '#0c1d37', '#0a182e', '#081325', '#060f1d'];
      for (let i = 0; i < 5; i++) {
        const y0 = horizon + (i + 0.2) * (h - horizon) / 5.2, amp = (2 + i * 2.6) * (0.5 + S * 1.5);
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) {
          const y = y0 + Math.sin(x * 0.011 * (1 + i * 0.25) + t * (0.6 + i * 0.22) + i * 1.7) * amp + Math.sin(x * 0.029 + t * (1.3 + S) + i * 2.3) * amp * 0.35;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = cols[i]; ctx.fill();
        if (cur.light > 0.05) { ctx.strokeStyle = `rgba(255,214,140,${0.05 * cur.light * (5 - i) / 5})`; ctx.lineWidth = 1; ctx.stroke(); }
        if (S > 0.4) { ctx.strokeStyle = `rgba(220,232,245,${0.07 * S})`; ctx.lineWidth = 1.2; ctx.stroke(); }
      }

      if (cur.fog > 0.01) {
        for (const f of fogs) {
          f.x += f.v * dt; if (f.x < -0.6) f.x = 1.6; if (f.x > 1.6) f.x = -0.6;
          const R = f.r * Math.max(w, h), rg = ctx.createRadialGradient(f.x * w, f.y * h, 0, f.x * w, f.y * h, R);
          rg.addColorStop(0, `rgba(196,210,224,${0.26 * cur.fog})`); rg.addColorStop(1, 'rgba(196,210,224,0)');
          ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
        }
        ctx.fillStyle = `rgba(150,170,190,${0.16 * cur.fog})`; ctx.fillRect(0, 0, w, h);
      }

      if (S > 0.05) {
        ctx.strokeStyle = `rgba(200,218,240,${0.32 * S})`; ctx.lineWidth = 1; ctx.beginPath();
        for (const d of drops) {
          d.y += dt * d.s * (1.1 + S * 1.2); d.x += dt * 0.28 * S;
          if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); } if (d.x > 1) d.x -= 1;
          const x = d.x * w, y = d.y * h; ctx.moveTo(x, y); ctx.lineTo(x - 7 * S * d.l, y - 20 * d.l);
        }
        ctx.stroke();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    let still = 0;
    if (reduce) { draw(performance.now()); still = setInterval(() => draw(performance.now()), 1200); }
    else raf = requestAnimationFrame(draw);
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); clearInterval(still); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); };
  }, []);

  return <canvas ref={ref} className="sea" aria-hidden="true" />;
}
