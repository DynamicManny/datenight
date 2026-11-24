import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { askTilt, buzz } from './ui.jsx';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Rudder input: drag the wheel sideways, or tilt the phone. Writes to a ref so the
   physics loop can read it every frame without re-rendering. */
export function useRudder() {
  const rudder = useRef(0);
  const [tilt, setTilt] = useState(() => { try { return localStorage.getItem('lh-tilt') === '1'; } catch { return false; } });
  useEffect(() => {
    if (!tilt) return undefined;
    const f = (e) => { if (typeof e.gamma === 'number') rudder.current = clamp(e.gamma / 26, -1, 1); };
    window.addEventListener('deviceorientation', f);
    return () => window.removeEventListener('deviceorientation', f);
  }, [tilt]);
  const toggleTilt = useCallback(async () => {
    if (tilt) { setTilt(false); try { localStorage.setItem('lh-tilt', '0'); } catch { /* */ } return; }
    const ok = await askTilt();
    if (ok) { setTilt(true); try { localStorage.setItem('lh-tilt', '1'); } catch { /* */ } }
  }, [tilt]);
  return { rudder, tilt, toggleTilt };
}

export function Wheel({ ctl, size = 132 }) {
  const start = useRef(null), svg = useRef(null);
  useEffect(() => { let r = 0; const tick = () => { if (svg.current) svg.current.style.transform = `rotate(${ctl.rudder.current * 120}deg)`; r = requestAnimationFrame(tick); }; r = requestAnimationFrame(tick); return () => cancelAnimationFrame(r); }, [ctl]);
  const down = (e) => { if (ctl.tilt) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, r: ctl.rudder.current }; buzz(5); };
  const move = (e) => { if (!start.current) return; ctl.rudder.current = clamp(start.current.r + (e.clientX - start.current.x) / 120, -1, 1); };
  const up = () => { start.current = null; };
  return (
    <div className="wheelbox">
      <div className="wheel-touch" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="slider" aria-label="Ship's wheel" aria-valuemin={-100} aria-valuemax={100} 
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') ctl.rudder.current = clamp(ctl.rudder.current - 0.15, -1, 1); if (e.key === 'ArrowRight') ctl.rudder.current = clamp(ctl.rudder.current + 0.15, -1, 1); }} tabIndex={0}>
        <svg ref={svg} viewBox="-60 -60 120 120" width={size} height={size} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return (
            <g key={i}>
              <line x1={0} y1={0} x2={Math.cos(a) * 56} y2={Math.sin(a) * 56} stroke="#7a5532" strokeWidth="5" strokeLinecap="round" />
              <circle cx={Math.cos(a) * 55} cy={Math.sin(a) * 55} r="4.5" fill={i === 6 ? '#ffb52e' : '#8b6239'} />
            </g>
          ); })}
          <circle r="40" fill="none" stroke="#9a6b3e" strokeWidth="8" />
          <circle r="40" fill="none" stroke="#c99a5e" strokeWidth="2" />
          <circle r="11" fill="#b98c3e" stroke="#3d2814" strokeWidth="2" />
        </svg>
      </div>
      <button type="button" className={'tiltbtn' + (ctl.tilt ? ' on' : '')} onClick={ctl.toggleTilt}>{ctl.tilt ? 'Tilt steering on' : 'Steer by tilting'}</button>
    </div>
  );
}

/* The engine order telegraph */
export const ORDERS = [
  { k: 'Full', v: 1 }, { k: 'Half', v: 0.6 }, { k: 'Slow', v: 0.3 }, { k: 'Stop', v: 0 }, { k: 'Astern', v: -0.35 }
];
export function Telegraph({ value, onChange }) {
  return (
    <div className="telegraph" role="radiogroup" aria-label="Engine">
      {ORDERS.map((o) => (
        <button key={o.k} type="button" role="radio" aria-checked={value === o.v} className={'tg' + (value === o.v ? ' on' : '') + (o.v < 0 ? ' astern' : '')} onClick={() => { buzz(12); onChange(o.v); }}>
          {o.k}
        </button>
      ))}
    </div>
  );
}

/* Press and hold. Calls onHold(true/false); the parent shares it over the live link. */
export function HoldButton({ label, heldLabel, onHold, partnerOn, partnerName, tone = 'lamp' }) {
  const [on, setOn] = useState(false);
  const set = (v) => { if (v === on) return; setOn(v); onHold(v); if (v) buzz(15); };
  useEffect(() => () => onHold(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="holdwrap">
      <motion.button type="button" className={'hold ' + tone + (on ? ' on' : '') + (on && partnerOn ? ' both' : '')}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); set(true); }}
        onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') set(true); }} onKeyUp={() => set(false)}
        animate={{ scale: on ? 0.96 : 1 }}>
        <span className="ring" />
        <b>{on ? heldLabel : label}</b>
      </motion.button>
      <div className={'partner' + (partnerOn ? ' on' : '')}><i />{partnerOn ? partnerName + ' is holding' : partnerName + ' is not holding'}</div>
    </div>
  );
}

/* Track the other phone's hold from heartbeats */
export function usePartnerHold(live, who) {
  const [on, setOn] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const off = live.on('hold', (p) => { if (p.who !== who) return; last.current = performance.now(); setOn(!!p.on); });
    const t = setInterval(() => { if (performance.now() - last.current > 900) setOn(false); }, 200);
    return () => { off(); clearInterval(t); };
  }, [live, who]);
  return on;
}

export function useMyHold(live, who) {
  const on = useRef(false);
  useEffect(() => {
    const t = setInterval(() => { if (on.current) live.emit('hold', { who, on: true }); }, 300);
    return () => clearInterval(t);
  }, [live, who]);
  const set = useCallback((v) => { on.current = v; live.emit('hold', { who, on: v }); }, [live, who]);
  return [on, set];
}
