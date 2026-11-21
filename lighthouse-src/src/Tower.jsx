import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VALVES, primeValue, shuffled, LIGHT_COLORS } from './logic.js';
import { Btn, PinSvg, LIGHT_HEX, LIGHT_NAMES, buzz } from './ui.jsx';
import { HoldButton } from './Controls.jsx';

export const HoldSlot = ({ setHold, partnerHold, partnerName, label, held }) => <HoldButton label={label} heldLabel={held} onHold={setHold} partnerOn={partnerHold} partnerName={partnerName} />;

/* The Keeper's radio. Only the Keeper can switch it on, and it never switches off. */
export function RadioSwitch({ open, onOpen, captain }) {
  return (
    <div className={'radiosw' + (open ? ' on' : '')}>
      <svg viewBox="0 0 40 40" className="rsic" aria-hidden="true">
        <rect x="4" y="12" width="32" height="22" rx="4" fill="#2a2318" stroke="#c9a25a" strokeWidth="2" />
        <path d="M10 12L28 4" stroke="#c9a25a" strokeWidth="2" strokeLinecap="round" />
        <circle cx="27" cy="23" r="6" fill="none" stroke="#c9a25a" strokeWidth="2" />
        {[0, 1, 2].map((i) => <rect key={i} x="9" y={18 + i * 4} width="9" height="2" rx="1" fill="#c9a25a" />)}
        <circle cx="33" cy="15" r="2.2" fill={open ? '#4fdc8a' : '#ff5a4d'} />
      </svg>
      <div className="rst">
        <b>{open ? 'Radio on' : 'Radio off'}</b>
        <small>{open ? captain + ' is on the line, manual open.' : 'The ship is out there somewhere.'}</small>
      </div>
      <button type="button" className="lever" onClick={onOpen} disabled={open} aria-label={open ? 'Radio is on' : 'Switch the radio on'}>
        <motion.span animate={{ x: open ? 26 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </button>
    </div>
  );
}

/* ---------- Stage 1: prime the lamp ---------- */
function Gauge({ val, target, max, sputter }) {
  const cx = 130, cy = 128, r = 104;
  const pt = (v, rr) => { const th = Math.PI - (v / max) * Math.PI; return [cx + rr * Math.cos(th), cy - rr * Math.sin(th)]; };
  const arc = (a, b, rr) => { const [x1, y1] = pt(a, rr), [x2, y2] = pt(b, rr); return `M${x1} ${y1} A${rr} ${rr} 0 0 1 ${x2} ${y2}`; };
  const ok = val === target;
  return (
    <svg viewBox="0 0 260 150" className={'gauge' + (sputter ? ' sputter' : '')} role="img" aria-label={`Pressure gauge reading ${val}. The line is at ${target}.`}>
      <path d={arc(0, max, r)} stroke="#2b2416" strokeWidth="22" fill="none" />
      <path d={arc(0, max, r)} stroke="#4a3d22" strokeWidth="18" fill="none" />
      <path d={arc(target - 0.5, target + 0.5, r)} stroke="#ffd27a" strokeWidth="18" fill="none" />
      {Array.from({ length: max + 1 }, (_, i) => { const [x1, y1] = pt(i, r - 14), [x2, y2] = pt(i, r - (i % 4 === 0 ? 26 : 20)); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f2e8d2" strokeWidth={i % 4 === 0 ? 2.4 : 1.2} />; })}
      {[0, 4, 8, 12, 16, 20, 24].map((i) => { const [x, y] = pt(i, r - 40); return <text key={i} x={x} y={y + 4} textAnchor="middle" className="gnum">{i}</text>; })}
      <g style={{ transform: `rotate(${(val / max) * 180}deg)`, transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box', transition: 'transform .7s cubic-bezier(.3,1.5,.5,1)' }}>
        <line x1={cx} y1={cy} x2={cx - r + 18} y2={cy} stroke={ok ? '#ffd27a' : '#ff6b5e'} strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r="10" fill="#c9a25a" stroke="#2a1f0c" strokeWidth="2" />
      <text x={cx} y={cy - 34} textAnchor="middle" className="gread">{val}</text>
    </svg>
  );
}

function Wheel({ turns }) {
  return (
    <motion.svg viewBox="0 0 60 60" className="wheel" animate={{ rotate: turns * 72 }} transition={{ type: 'spring', stiffness: 120, damping: 12 }} aria-hidden="true">
      <circle cx="30" cy="30" r="25" fill="none" stroke="#c9a25a" strokeWidth="5" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="30" y1="30" x2={30 + 25 * Math.cos((i * 72 * Math.PI) / 180)} y2={30 + 25 * Math.sin((i * 72 * Math.PI) / 180)} stroke="#c9a25a" strokeWidth="4" />)}
      <circle cx="30" cy="30" r="7" fill="#8a6a2c" />
      <circle cx={30 + 25} cy="30" r="4" fill="#ffd27a" />
    </motion.svg>
  );
}

export function Prime({ inst, M, act }) {
  const [v, setV] = useState([0, 0, 0]);
  const val = primeValue(inst, v);
  const set = (i, d) => { buzz(8); setV((o) => o.map((x, j) => (j === i ? Math.max(0, Math.min(4, x + d)) : x))); };
  return (
    <div className="panel brass">
      <div className="ph"><b>The lamp</b><span>Bring the pressure to the line, then light it.</span></div>
      <Gauge val={val} target={inst.target} max={inst.max} sputter={M.last.kind === 'wrong'} />
      <div className="valves">
        {VALVES.map((name, i) => (
          <div className="valve" key={name}>
            <Wheel turns={v[i]} />
            <b>{name}</b>
            <small>{v[i]} {v[i] === 1 ? 'turn' : 'turns'}</small>
            <div className="vb">
              <button type="button" onClick={() => set(i, -1)} disabled={v[i] === 0} aria-label={'Ease off ' + name}>−</button>
              <button type="button" onClick={() => set(i, 1)} disabled={v[i] === 4} aria-label={'Open ' + name}>+</button>
            </div>
          </div>
        ))}
      </div>
      {M.lastPrime !== null && <p className="note warn">Last try: it caught at {M.lastPrime}, then sputtered out.</p>}
      <Btn kind="lamp" onClick={() => act('prime', { v })}>Light the lamp</Btn>
    </div>
  );
}

/* ---------- Stage 2: free the clockwork ---------- */
function StormGlass({ cloudy }) {
  return (
    <svg viewBox="0 0 40 90" className="inst-svg" aria-hidden="true">
      <rect x="10" y="4" width="20" height="8" rx="2" fill="#c9a25a" />
      <path d="M12 12h16v60a8 8 0 0 1-16 0z" fill={cloudy ? '#b9c3cf' : 'rgba(200,230,255,.12)'} stroke="#e8eef5" strokeWidth="2" />
      {cloudy
        ? [0, 1, 2, 3].map((i) => <path key={i} d={`M14 ${26 + i * 12}c4-4 8 4 12 0`} stroke="#6d7a8a" strokeWidth="2.5" fill="none" />)
        : [0, 1, 2].map((i) => <path key={i} d={`M20 ${62 - i * 14}l3 5-3 5-3-5z`} fill="#e8eef5" />)}
      <rect x="8" y="78" width="24" height="8" rx="2" fill="#c9a25a" />
    </svg>
  );
}
function Vane({ to }) {
  return (
    <svg viewBox="0 0 120 90" className="inst-svg wide" aria-hidden="true">
      <path d="M8 52c6-6 10 6 16 0s10 6 16 0" stroke="#62c8ff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M8 62c6-6 10 6 16 0s10 6 16 0" stroke="#62c8ff" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity=".6" />
      <path d="M86 58l12-12 12 12v16H86z" fill="#e9dcc0" stroke="#1a1408" strokeWidth="2" />
      <rect x="95" y="64" width="6" height="10" fill="#1a1408" />
      <line x1="60" y1="40" x2="60" y2="86" stroke="#c9a25a" strokeWidth="3" />
      <g style={{ transform: `rotate(${to === 'sea' ? 180 : 0}deg)`, transformOrigin: '60px 40px', transformBox: 'view-box' }}>
        <path d="M34 40h44" stroke="#c9a25a" strokeWidth="4" strokeLinecap="round" />
        <path d="M86 40l-10-8v16z" fill="#ffd27a" stroke="#1a1408" strokeWidth="1.5" />
        <path d="M34 40l-6-9h8l6 9-6 9h-8z" fill="#c9a25a" />
      </g>
      <circle cx="60" cy="40" r="4" fill="#ffd27a" />
    </svg>
  );
}

export function deadPins(inst) {
  return shuffled([...Array(inst.n).keys()].filter((i) => i !== inst.target), 'dead' + inst.lens + inst.pins.join('')).slice(0, 2);
}

export function Clockwork({ inst, M, act, hinted }) {
  const [sel, setSel] = useState(null);
  const marked = hinted ? deadPins(inst) : [];
  return (
    <div className="panel brass">
      <div className="ph"><b>The clockwork</b><span>The lens is jammed. One pin is holding it.</span></div>
      <div className="instruments">
        <figure><StormGlass cloudy={inst.cloudy} /><figcaption>Storm glass</figcaption></figure>
        <figure className="lensplate"><div className="plate-sm"><small>LENS No.</small><b>{inst.lens}</b></div><figcaption>Lens</figcaption></figure>
        <figure><Vane to={inst.vane} /><figcaption>Weathervane</figcaption></figure>
      </div>
      <div className="rail">
        {inst.pins.map((c, i) => {
          const pulled = !!M.pulled[i];
          return (
            <motion.button
              key={i} type="button" className={'pin' + (sel === i ? ' sel' : '') + (pulled ? ' pulled' : '') + (marked.includes(i) ? ' chalk' : '')}
              disabled={pulled} onClick={() => { buzz(6); setSel(sel === i ? null : i); }}
              animate={{ y: pulled ? -26 : sel === i ? -10 : 0, opacity: pulled ? 0.45 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              aria-label={`Pin ${i + 1}, ${c}${pulled ? ', already pulled' : ''}`}
            >
              <PinSvg color={c} pulled={pulled} />
              <span className="pn">{i + 1}</span>
            </motion.button>
          );
        })}
      </div>
      {hinted && <p className="note flare">Your flare lit up two pins. Chalk marks say they are not the one.</p>}
      <Btn kind="red" disabled={sel === null} onClick={() => { const w = sel; setSel(null); act('pin', { w }); }}>
        {sel === null ? 'Choose a pin' : 'Pull pin ' + (sel + 1)}
      </Btn>
    </div>
  );
}

/* ---------- Stage 3: set the signal ---------- */
const PLAY = { S: 380, L: 1100, GAP: 380 };
export function Signal({ inst, M, act, hinted }) {
  const [slots, setSlots] = useState(['', '', '', '', '']);
  const [col, setCol] = useState(0);
  const [grime, setGrime] = useState(() => Array(21).fill(1));
  const [lit, setLit] = useState(false);
  const [playing, setPlaying] = useState(false);
  const plateRef = useRef(null), timers = useRef([]);
  useEffect(() => { if (hinted) setSlots((s) => [inst.pattern[0], ...s.slice(1)]); }, [hinted, inst.pattern]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const rub = (e) => {
    if (!plateRef.current) return;
    const r = plateRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const cx = Math.min(6, Math.floor(x * 7)), cy = Math.min(2, Math.floor(y * 3));
    setGrime((g) => g.map((a, i) => { const gx = i % 7, gy = Math.floor(i / 7); const d = Math.abs(gx - cx) + Math.abs(gy - cy); return d === 0 ? Math.max(0, a - 0.4) : d === 1 ? Math.max(0, a - 0.15) : a; }));
  };
  const cycle = (i) => { if (hinted && i === 0) return; buzz(6); setSlots((s) => s.map((x, j) => (j === i ? (x === '' ? 'S' : x === 'S' ? 'L' : '') : x))); };
  const pat = slots.filter(Boolean).join('');
  const play = () => {
    if (!pat || playing) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    setPlaying(true); let t = 200;
    for (const f of pat) {
      timers.current.push(setTimeout(() => setLit(true), t)); t += PLAY[f];
      timers.current.push(setTimeout(() => setLit(false), t)); t += PLAY.GAP;
    }
    timers.current.push(setTimeout(() => setPlaying(false), t));
  };
  const plate = inst.plate;
  const word = (w, hidden) => (hidden ? <span className="corroded" aria-label="worn away">{'▒'.repeat(w.length + 1)}</span> : <span>{w}</span>);
  const clean = grime.every((a) => a < 0.3);
  return (
    <div className="panel brass">
      <div className="ph"><b>The signal</b><span>Every light has its own flashes. Ships only trust the right one.</span></div>
      <div className="bplate" ref={plateRef} onPointerDown={rub} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') rub(e); }}>
        <div className="bp-in">
          <small>This light is</small>
          <b>{word(plate.adj, plate.hide === 'adj')} {word(plate.noun, plate.hide === 'noun')}</b>
          <small>Lit since {plate.year}</small>
        </div>
        <div className="grime" aria-hidden="true">{grime.map((a, i) => <i key={i} style={{ opacity: a }} />)}</div>
        {!clean && <span className="rubhint">Rub the plate clean</span>}
      </div>

      <div className="prog">
        <div className="lampbox"><motion.div className="siglamp" animate={{ opacity: lit ? 1 : 0.12, scale: lit ? 1.06 : 1 }} transition={{ duration: 0.08 }} style={{ background: LIGHT_HEX[col], boxShadow: lit ? `0 0 40px 12px ${LIGHT_HEX[col]}` : 'none' }} /></div>
        <div className="slots">
          {slots.map((s, i) => (
            <button type="button" key={i} className={'slot' + (s ? ' ' + s : '') + (hinted && i === 0 ? ' locked' : '')} onClick={() => cycle(i)} aria-label={`Flash ${i + 1}: ${s === 'S' ? 'short' : s === 'L' ? 'long' : 'empty'}`}>
              <i style={{ background: s ? LIGHT_HEX[col] : 'transparent' }} />
            </button>
          ))}
        </div>
        <p className="tiny">Tap a flash: short, long, off.</p>
        <div className="lenses">
          {LIGHT_COLORS.map((c, i) => (
            <button type="button" key={c} className={'lens' + (col === i ? ' on' : '')} onClick={() => { buzz(6); setCol(i); }} aria-pressed={col === i}>
              <span style={{ background: LIGHT_HEX[i] }} />{LIGHT_NAMES[i]}
            </button>
          ))}
        </div>
      </div>
      {hinted && <p className="note flare">The flare showed you the first flash. It is locked in.</p>}
      {M.lastSig && <p className="note warn">No ship answered the last signal. Check it with the Captain.</p>}
      <div className="row2">
        <Btn kind="ghost" onClick={play} disabled={!pat || playing}>{playing ? 'Flashing…' : 'Test it here'}</Btn>
        <Btn kind="lamp" onClick={() => act('signal', { p: pat, c: col })} disabled={!pat}>Send it out</Btn>
      </div>
    </div>
  );
}

export function TowerStage({ name, inst, M, act, hinted, beam }) {
  const k = M.att[1] + ':' + M.stage;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={k} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
        {name === 'prime' && <Prime inst={inst} M={M} act={act} />}
        {name === 'clockwork' && <Clockwork inst={inst} M={M} act={act} hinted={hinted} />}
        {name === 'signal' && <Signal inst={inst} M={M} act={act} hinted={hinted} />}
        {name === 'beam' && <BeamStage inst={inst} M={M} act={act} hinted={hinted} {...beam} />}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- Stage 4: find the ship. Her hands turn the lens, his eyes tell her where. ---------- */
export function BeamStage({ inst, M, act, live, hinted, partnerName, myHold, partnerHold, setHold }) {
  const [ang, setAng] = useState(0);
  const angRef = useRef(0), dial = useRef(null), both = useRef(null), sent = useRef(false);
  const [miss, setMiss] = useState(false);
  useEffect(() => { const t = setInterval(() => live.emit('lens', { ang: angRef.current }), 70); return () => clearInterval(t); }, [live]);
  useEffect(() => {
    const t = setInterval(() => {
      if (myHold.current && partnerHold) {
        if (both.current === null) both.current = performance.now();
        if (!sent.current && performance.now() - both.current > 1200) {
          if (Math.abs(angRef.current - inst.bearing) <= inst.tol) { sent.current = true; act('contact', { ang: angRef.current }); }
          else { setMiss(true); both.current = performance.now() + 1500; }
        }
      } else both.current = null;
    }, 100);
    return () => clearInterval(t);
  }, [partnerHold, act, inst, myHold]);
  useEffect(() => { if (miss) { const t = setTimeout(() => setMiss(false), 2600); return () => clearTimeout(t); } return undefined; }, [miss]);
  const turn = (e) => {
    if (!dial.current) return;
    const sv = dial.current.querySelector("svg").getBoundingClientRect();
    const x = e.clientX - (sv.left + sv.width / 2), y = e.clientY - (sv.top + sv.height * (110 / 146));
    const a = Math.max(-90, Math.min(90, (Math.atan2(x, -y) * 180) / Math.PI));
    if (Math.round(a / 3) !== Math.round(angRef.current / 3)) buzz(4);
    angRef.current = a; setAng(a); window.dispatchEvent(new CustomEvent('lh-lens', { detail: { ang: a } }));
  };
  return (
    <div className="panel brass">
      <div className="ph"><b>The great lens</b><span>The ship is out there in the dark. Turn the lens until the beam finds it.</span></div>
      <div className="lensdial" ref={dial} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); turn(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') turn(e); }} role="slider" aria-label="Lens direction" aria-valuemin={-90} aria-valuemax={90} aria-valuenow={Math.round(ang)} tabIndex={0}
        onKeyDown={(e) => { const d = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : 0; if (d) { const a = Math.max(-90, Math.min(90, angRef.current + d)); angRef.current = a; setAng(a); } }}>
        <svg viewBox="-110 -110 220 146" aria-hidden="true">
          <path d="M-100 0 A100 100 0 0 1 100 0" fill="none" stroke="#3d3018" strokeWidth="16" />
          {Array.from({ length: 19 }, (_, i) => { const a = (-90 + i * 10) * Math.PI / 180; return <line key={i} x1={Math.sin(a) * 92} y1={-Math.cos(a) * 92} x2={Math.sin(a) * (i % 3 ? 100 : 106)} y2={-Math.cos(a) * (i % 3 ? 100 : 106)} stroke="#e4d2a6" strokeWidth={i % 3 ? 1 : 2} />; })}
          {hinted && (() => { const a1 = (inst.bearing - 18) * Math.PI / 180, a2 = (inst.bearing + 18) * Math.PI / 180; return <path d={`M${Math.sin(a1) * 100} ${-Math.cos(a1) * 100} A100 100 0 0 1 ${Math.sin(a2) * 100} ${-Math.cos(a2) * 100}`} fill="none" stroke="#ff6b5e" strokeWidth="16" opacity=".55" />; })()}
          <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: '0 0', transformBox: 'view-box' }}>
            <path d="M0 0 L-15 -98 L15 -98 Z" fill="rgba(255,217,138,.4)" />
            <circle r="30" fill="#1b170e" stroke="#b98c3e" strokeWidth="4" />
            {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={Math.sin(a) * 12} y1={-Math.cos(a) * 12} x2={Math.sin(a) * 28} y2={-Math.cos(a) * 28} stroke="#7a6030" strokeWidth="2" />; })}
            <path d="M-11 -24 A26 26 0 0 1 11 -24 L6 -12 A13 13 0 0 0 -6 -12 Z" fill="#ffe3a6" />
          </g>
          <circle r="9" fill="#b98c3e" stroke="#2a1f0c" strokeWidth="2" />
        </svg>
        <span className="dialhint">Drag to turn</span>
      </div>
      {hinted && <p className="note flare">The flare lit the water for a second. The ship is somewhere inside the red arc.</p>}
      {miss && <p className="note warn">You both held, but the beam is lighting empty water.</p>}
      <div className="beamhold">
        <p className="tiny">When the Captain says the light is on them, you both hold.</p>
      </div>
      <HoldSlot setHold={setHold} partnerHold={partnerHold} partnerName={partnerName} label="Hold the beam here" held="Holding steady" />
    </div>
  );
}
