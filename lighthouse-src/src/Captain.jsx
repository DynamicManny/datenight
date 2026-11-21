import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { S, TOWER } from './geo.js';
const Bow3DLazy = lazy(() => import('./Bow3D.jsx'));
const Bow3D = (p) => <Suspense fallback={<div className="bowload">Raising the mast…</div>}><Bow3DLazy {...p} /></Suspense>;
import OldChart from './Chart.jsx';
import { Wheel, Telegraph, useRudder, HoldButton } from './Controls.jsx';
import { RadioSet, ShipLog, Manual, ListOfLights, Standby } from './Ship.jsx';
import { genBeam, chartErrors, stageName, HEADINGS } from './logic.js';
import { newStorm, stormStep, stormLevel, ZONE, newShip, shipStep } from './sim.js';
import { buzz } from './ui.jsx';

const rad = (d) => (d * Math.PI) / 180;

/* Room 1 from the ship: hold the bow into the storm while talking her through the tower. */
export function CaptainTower({ M, inst, seed, keeper, live, send, hinted, hold, hud }) {
  const ctl = useRudder();
  const bearing = useMemo(() => genBeam(seed + ':m' + M.n + ':r1a' + M.att[1] + 's3').bearing, [seed, M.n, M.att]);
  const tower = useMemo(() => ({ x: Math.sin(rad(bearing)) * 150, z: -Math.cos(rad(bearing)) * 150 }), [bearing]);
  const view = useRef({ mode: 'storm', yawDeg: 0, tower, lightOn: false, beamYaw: 0, beamVisible: false, ship: { x: 0, y: 0, h: 0 } });
  const glare = useRef(null), needle = useRef(null), strainBar = useRef(null), gaugeWrap = useRef(null);
  const name = stageName(M);
  const ctx = useRef({}); ctx.current = { M, name, send, live };

  useEffect(() => { view.current.tower = tower; }, [tower]);
  useEffect(() => {
    view.current.lightOn = M.stage >= 1;
    view.current.beamVisible = name === 'beam';
    if (name !== 'beam') view.current.beamYaw = Math.atan2(-tower.z, -tower.x) + rad(70);
  }, [M.stage, name, tower]);
  useEffect(() => live.on('lens', (p) => {
    // her lens angle, relative to the line from the tower to the ship
    view.current.beamYaw = Math.atan2(-tower.z, -tower.x) + rad(p.ang - bearing);
  }), [live, tower, bearing]);

  useEffect(() => {
    let st = newStorm(), raf = 0, last = performance.now(), lastEmit = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const c = ctx.current;
      const r = stormStep(st, ctl.rudder.current, dt, stormLevel(c.M.stage, c.M.channel));
      st = r.st; view.current.yawDeg = st.ang;
      if (needle.current) needle.current.style.left = `${50 + (st.ang / 75) * 50}%`;
      if (strainBar.current) strainBar.current.style.transform = `scaleX(${st.strain / 100})`;
      if (gaugeWrap.current) gaugeWrap.current.classList.toggle('out', Math.abs(st.ang) > ZONE);
      if (r.hit) { buzz([80, 40, 120]); c.send('hit', { m: c.M.n, a: c.M.att[1], s: c.M.stage, room: 1, what: 'storm' }); }
      if (now - lastEmit > 200) { lastEmit = now; c.live.emit('storm', { ang: st.ang, strain: st.strain }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.__lhStorm = { get: () => st, rudder: ctl.rudder };
    return () => { cancelAnimationFrame(raf); delete window.__lhStorm; };
  }, [ctl.rudder]);

  return (
    <div className="play captain">
      <div className="scene s-cap">
        <Bow3D view={view} layout={null} glareRef={glare} />
        <div className="glare" ref={glare} />
        {hud}
        <div className="storm-g" ref={gaugeWrap}>
          <div className="hbar"><span className="zone" style={{ left: `${50 - (ZONE / 75) * 50}%`, right: `${50 - (ZONE / 75) * 50}%` }} /><i ref={needle} /></div>
          <div className="strain"><i ref={strainBar} /></div>
          <small>Keep the bow in the green</small>
        </div>
      </div>
      <div className="console">
        <RadioSet open={M.channel} keeper={keeper} />
        <AnimatePresence mode="wait">
          <motion.div key={M.channel ? M.att[1] + ':' + M.stage : 'closed'} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {!M.channel && <ShipLog keeper={keeper} />}
            {M.channel && name === 'prime' && <Standby keeper={keeper} />}
            {M.channel && name === 'clockwork' && <Manual inst={inst} hinted={hinted} />}
            {M.channel && name === 'signal' && <ListOfLights inst={inst} />}
            {M.channel && name === 'beam' && (
              <div className="paper call">
                <p className="pintro">The light is lit and the lens turns. {keeper} can&rsquo;t see you out here. Watch the beam on the horizon and talk it onto your bow.</p>
                <p className="pintro">When it is right on you, you both hold.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="dock">
        <Wheel ctl={ctl} size={118} />
        {name === 'beam' && M.channel
          ? <HoldButton label="Flash back" heldLabel="Flashing" onHold={hold.set} partnerOn={hold.partner} partnerName={keeper} tone="sky" />
          : <div className="dockhelp">Drag the wheel left and right, or tilt the phone, to keep the bow into the waves.</div>}
      </div>
    </div>
  );
}

/* Room 2 from the ship: blind in the fog, steering by her voice and an old chart. */
export function CaptainFog({ M, inst, seed, keeper, live, send, hold, flareUntil, hud }) {
  const ctl = useRudder();
  const [throttle, setThrottle] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);
  const thr = useRef(0); thr.current = throttle;
  const errors = useMemo(() => chartErrors(inst, seed + ':' + M.n + ':' + M.att[2] + ':' + M.stage), [inst, seed, M.n, M.att, M.stage]);
  const view = useRef({ mode: 'fog', yawDeg: 0, tower: { x: TOWER.x * S, z: TOWER.y * S }, lightOn: true, beamYaw: -2.4, beamVisible: true, ship: newShip(), flareUntil: 0 });
  const glare = useRef(null), compass = useRef(null), speed = useRef(null);
  const name = stageName(M);
  const ctx = useRef({}); ctx.current = { M, name, send, live };
  useEffect(() => { view.current.flareUntil = flareUntil || 0; }, [flareUntil]);
  useEffect(() => live.on('beam', (p) => { view.current.beamYaw = p.a; }), [live]);

  useEffect(() => {
    let s = newShip(), raf = 0, last = performance.now(), lastEmit = 0, done = false;
    view.current.ship = s;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const c = ctx.current;
      if (!done && !c.M.moored) {
        const r = shipStep(s, { rudder: ctl.rudder.current, throttle: thr.current }, dt, inst);
        s = r.s; view.current.ship = s;
        if (r.ev) {
          const base = { m: c.M.n, a: c.M.att[2], s: c.M.stage };
          if (r.ev.kind === 'hit') { buzz([90, 40, 140]); c.send('hit', { ...base, room: 2, what: r.ev.what }); }
          else if (r.ev.kind === 'gate') { done = true; c.send('gate', base); }
          else if (r.ev.kind === 'moored') { if (r.ev.berth === inst.berth) done = true; c.send('moored', { ...base, berth: r.ev.berth }); }
        }
      }
      if (compass.current) compass.current.style.transform = `rotate(${(-s.h * 180) / Math.PI}deg)`;
      if (speed.current) speed.current.textContent = (Math.abs(s.v) < 0.02 ? 'Dead in the water' : (s.v < 0 ? 'Going astern' : s.v > 0.42 ? 'Making good speed' : s.v > 0.2 ? 'Steady' : 'Creeping'));
      if (now - lastEmit > 100) { lastEmit = now; c.live.emit('ship', { x: s.x, y: s.y, h: s.h, v: s.v }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.__lhCaptain = { set: (r, t) => { ctl.rudder.current = r; thr.current = t; }, pose: () => view.current.ship };
    return () => { cancelAnimationFrame(raf); delete window.__lhCaptain; };
  }, [inst, ctl.rudder]);

  const heading = (h) => { const d = ((((h * 180) / Math.PI) % 360) + 360) % 360; return HEADINGS[Math.round(d / 90) % 4]; };
  return (
    <div className="play captain">
      <div className="scene s-fog">
        <Bow3D view={view} layout={inst} glareRef={glare} />
        <div className="glare soft" ref={glare} />
        {hud}
        <div className="compass" aria-hidden="true">
          <svg viewBox="-30 -30 60 60"><g ref={compass} style={{ transformOrigin: '0 0', transformBox: 'view-box' }}>
            <circle r="26" fill="rgba(7,19,25,.7)" stroke="#d6e6e2" strokeWidth="1.5" />
            <path d="M0 -24 L5 0 L0 -4 L-5 0Z" fill="#e8473a" /><path d="M0 24 L5 0 L0 4 L-5 0Z" fill="#d6e6e2" />
            <text x="0" y="-12" className="cn">N</text>
          </g></svg>
          <span ref={speed} className="spd">Dead in the water</span>
        </div>
        <AnimatePresence>
          {chartOpen && (
            <motion.div className="chartover" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
              <OldChart inst={inst} errors={errors} berthNote={name === 'harbor' ? 'Your berth: ' + (inst.berth + 1) : null} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="dock fogdock">
        <Telegraph value={throttle} onChange={setThrottle} />
        <div className="dockmid">
          <button type="button" className={'chartbtn' + (chartOpen ? ' on' : '')} onClick={() => setChartOpen((o) => !o)}>{chartOpen ? 'Back to the bow' : 'Your chart'}</button>
          {name === 'harbor' && <div className="note-slip">Harbor master: you have berth {inst.berth + 1}. Come in slow.</div>}
          {name === 'rocks' && <div className="note-slip">Make for the gate between the red and green buoys.</div>}
        </div>
        <Wheel ctl={ctl} size={112} />
      </div>
      {M.moored && (
        <div className="tieup">
          <p>Alongside. Hold to tie her up.</p>
          <HoldButton label="Throw the line" heldLabel="Holding the line" onHold={hold.set} partnerOn={hold.partner} partnerName={keeper} tone="sky" />
        </div>
      )}
      <span className="sr" aria-live="polite">{heading(view.current.ship.h)}</span>
    </div>
  );
}
