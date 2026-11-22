import { useCallback, useEffect, useRef, useState } from 'react';
import FogChart from './FogChart.jsx';
import { HoldButton } from './Controls.jsx';
import { START } from './logic.js';

/* Room 2 from the tower: the whole harbor under fog, her beam, and his ship's lantern. */
export default function KeeperFog({ M, inst, live, hold, captain, flareUntil, hud }) {
  const shipRef = useRef({ x: START.x + 0.5, y: START.y + 0.5, h: 0 });
  const beamRef = useRef(-2.4);
  const target = useRef(null), whaleRef = useRef(null);
  const [whaleNote, setWhaleNote] = useState(false);
  useEffect(() => { shipRef.current = { x: START.x + 0.5, y: START.y + 0.5, h: 0 }; target.current = null; }, [inst]);
  useEffect(() => live.on('ship', (p) => { target.current = p; }), [live]);
  useEffect(() => live.on('whale', (p) => { whaleRef.current = { ...p, at: performance.now() }; setWhaleNote(true); setTimeout(() => setWhaleNote(false), 7000); }), [live]);
  // ease toward the latest position so the lantern glides instead of jumping
  useEffect(() => {
    let raf = 0;
    const tick = () => { const t = target.current, s = shipRef.current; if (t) shipRef.current = { x: s.x + (t.x - s.x) * 0.2, y: s.y + (t.y - s.y) * 0.2, h: t.h }; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => { const t = setInterval(() => live.emit('beam', { a: beamRef.current }), 80); return () => clearInterval(t); }, [live]);
  const onAim = useCallback(() => {}, []);
  return (
    <div className="play keeper">
      <div className="scene s-chart">
        {hud}
        <FogChart inst={inst} shipRef={shipRef} beamRef={beamRef} flareUntil={flareUntil} onAim={onAim} whaleRef={whaleRef} />
        {whaleNote && <div className="whalenote">Something huge just surfaced next to them.</div>}
      </div>
      <div className="dock keeperdock">
        {M.moored
          ? <div className="tieup inline"><p>They are alongside. Hold to catch the line.</p><HoldButton label="Catch the line" heldLabel="Holding the line" onHold={hold.set} partnerOn={hold.partner} partnerName={captain} /></div>
          : <p className="dockhelp">The glowing light is {captain}&rsquo;s ship. Rocks only show while your beam is on them. Drag to point the light. Where it shines, the fog thins for them too.</p>}
      </div>
    </div>
  );
}
