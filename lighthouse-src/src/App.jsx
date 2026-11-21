import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { reduce, stageName, hintKey, askable, keeperOf, captainOf, CLOCK_SECS, MAX_STRIKES, FLARES, STAGES } from './logic.js';
import { openRoom, useEvents, useLive, loadSlot, saveSlot, clearSlot, friendly, serverNow } from './sync.js';
import { NAMES, Btn, Lantern, FlareIcon, buzz, mmss } from './ui.jsx';
import Sea from './Sea.jsx';
import { TowerStage, RadioSwitch } from './Tower.jsx';
import { CaptainTower, CaptainFog } from './Captain.jsx';
import KeeperFog from './KeeperFog.jsx';
import { usePartnerHold, useMyHold } from './Controls.jsx';

export default function App() {
  const [slot, setSlot] = useState(loadSlot);
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (slot === null) return;
    let alive = true; setErr('');
    openRoom().then((r) => alive && setRoom(r)).catch((e) => { if (alive) { setErr(friendly(e)); setSlot(null); } });
    return () => { alive = false; };
  }, [slot]);
  const leave = () => { clearSlot(); setRoom(null); setSlot(null); };
  if (slot !== null && room) return <Game room={room} me={slot} onLeave={leave} />;
  return (
    <>
      <Sea storm={0.75} light={false} />
      <Lobby busy={slot !== null} err={err} onPick={(s) => { saveSlot(s); setSlot(s); }} />
    </>
  );
}

function Lobby({ busy, err, onPick }) {
  return (
    <main className="lobby">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
        <div className="eyebrow">A storm on the northern coast</div>
        <h1 className="title">Keep the Light</h1>
        <p className="lede">A keeper in a dark tower. A captain somewhere in the fog. Neither gets home alone.</p>
      </motion.div>
      <motion.div className="who" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {NAMES.map((n, i) => (
          <motion.button key={n} type="button" className={'whob ' + (i ? 'b' : 'a')} disabled={busy} onClick={() => onPick(i)} whileTap={{ scale: 0.96 }}>
            <small>I am</small><b>{n}</b>
          </motion.button>
        ))}
      </motion.div>
      <p className="err" role="alert">{busy ? 'Climbing the stairs…' : err}</p>
    </main>
  );
}

/* ---------------------------------------------------------------- */
function useClock(M, send) {
  const [now, setNow] = useState(serverNow());
  const sent = useRef(null);
  useEffect(() => { const t = setInterval(() => setNow(serverNow()), 250); return () => clearInterval(t); }, []);
  if (!M.cfg.clock || !M.startedAt) return null;
  const end = M.phase === 'play' ? now : M.endedAt ? Date.parse(M.endedAt) : now;
  const left = CLOCK_SECS - (end - Date.parse(M.startedAt)) / 1000;
  if (M.phase === 'play' && left <= 0 && sent.current !== M.n) { sent.current = M.n; setTimeout(() => send('timeup', { m: M.n }), 0); }
  return left;
}

function comms(M, names) {
  const L = M.last, k = names[keeperOf(M)], c = names[captainOf(M)];
  const map = {
    start: 'Tower log: the lamp is cold and the storm is building.',
    channel: 'The radio crackles. Somewhere out there, a ship is listening.',
    ask: (L.by === keeperOf(M) || M.room === 1 ? k : c) + ' asked for a flare.',
    flare: 'A flare climbs into the rain and lights everything for a moment.',
    reset: M.room === 1 ? 'Too many slips. The storm knocks the tower back to dark.' : 'The hull can’t take more. The ship pulls back to open water.',
    roomclear: 'The light is burning. Out in the fog, a ship turns toward it.',
    wrong: L.what === 'prime' ? 'The lamp coughs and gutters out.' : L.what === 'pin' ? 'Clunk. Wrong pin. The gears groan.' : 'The light blinks a pattern no ship knows.',
    clear: { clockwork: 'The lamp catches. Now the lens won\u2019t turn.', signal: 'The lens turns. Now it needs its own signal.', beam: 'The signal is set. Now find the ship in the dark.', harbor: 'Through the gate. The harbor lights are close.' }[L.stage] || 'Onward.',
    scrape: 'Something scrapes along the hull.',
    move: 'The ship creeps forward through the fog.',
    drift: 'The current shoves the ship sideways.',
    helm: 'The wheel turns. The bow swings ' + (L.d === 1 ? 'to starboard.' : 'to port.'),
    moored: 'Bumpers against the dock. Throw the line.',
    wrongberth: 'Wrong berth. The harbor master waves you off.',
    line: names[L.by] + ' has the line.',
    storm: 'A wave breaks over the bow. The ship shudders.',
    complete: 'Home.',
    timeup: 'The storm peaks and passes.'
  };
  return map[L.kind] || 'The storm presses against the windows.';
}

const STAGE_LABEL = { prime: 'Prime the lamp', clockwork: 'Free the clockwork', signal: 'Set the signal', beam: 'Find the ship', rocks: 'Clear the rocks', harbor: 'Make harbor' };
function Hud({ M, left, names, live }) {
  const idx = M.room === 1 ? M.stage : STAGES[1].length + M.stage, total = STAGES[1].length + STAGES[2].length;
  return (
    <div className="hud">
      <div className="hudrow">
        <div className="lanterns" role="img" aria-label={`${MAX_STRIKES - M.strikes} of ${MAX_STRIKES} chances left`}>
          {Array.from({ length: MAX_STRIKES }, (_, i) => <Lantern key={i} on={i < MAX_STRIKES - M.strikes} />)}
        </div>
        <div className={'clock' + (left !== null && left <= 60 ? ' low' : '')}>{left === null ? 'No clock' : mmss(left)}</div>
        <div className="flares" aria-label={`${FLARES - M.flares} flares left`}><FlareIcon /><b>{FLARES - M.flares}</b></div>
      </div>
      <div className="hudrow2">
        <span className="stage">{STAGE_LABEL[stageName(M)]}</span>
        <span className="pips">{Array.from({ length: total }, (_, i) => <i key={i} className={i < idx ? 'done' : i === idx ? 'now' : ''} />)}</span>
        <span className={'link-dot' + (live ? ' on' : '')} title={live ? 'Phones linked' : 'Linking phones'} />
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={M.last.seq} className="comms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {comms(M, names)}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function ShipStatus({ live }) {
  const el = useRef(null), bar = useRef(null);
  useEffect(() => live.on('storm', (p) => {
    if (el.current) el.current.style.transform = `rotate(${p.ang * 0.6}deg)`;
    if (bar.current) { bar.current.style.transform = `scaleX(${p.strain / 100})`; bar.current.parentNode.classList.toggle('bad', p.strain > 60); }
  }), [live]);
  return (
    <div className="shipstat" aria-hidden="true">
      <svg viewBox="-20 -16 40 22"><g ref={el} style={{ transformOrigin: '0 0', transformBox: 'view-box' }}><path d="M-14 0h28l-5 5h-18z" fill="#d6e6e2" /><path d="M0 0v-13" stroke="#d6e6e2" strokeWidth="1.5" /><circle cx="0" cy="-14" r="1.6" fill="#ffb52e" /></g></svg>
      <span>The ship</span><div className="sbar"><i ref={bar} /></div>
    </div>
  );
}

function HelpBar({ M, me, hands, send, names }) {
  const key = hintKey(M);
  if (!askable(M) || (M.room === 1 && !M.channel)) return null;
  if (M.hint === key) return null;
  const other = names[hands];
  if (me === hands) {
    if (M.flares >= FLARES) return null;
    if (M.ask === key) return <div className="help waiting"><FlareIcon /> Waiting for {names[1 - me]} to send a flare…</div>;
    return <button type="button" className="help ask" onClick={() => send('ask', { m: M.n, key })}><FlareIcon /> Ask for a flare <small>{FLARES - M.flares} left</small></button>;
  }
  if (M.ask === key) {
    return (
      <motion.div className="help incoming" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <span><b>{other} is asking for help.</b> Send a flare to light things up.</span>
        <Btn kind="red" onClick={() => { buzz(30); send('flare', { m: M.n }); }}><FlareIcon /> Send a flare</Btn>
      </motion.div>
    );
  }
  return null;
}

/* ---------------------------------------------------------------- */
function Brief({ M, me, send }) {
  const keeper = keeperOf(M), captain = captainOf(M);
  const setCfg = (patch) => send('config', { m: M.n, clock: M.cfg.clock, keeper: M.cfg.keeper, ...patch });
  return (
    <div className="brief">
      <motion.div className="logbook" initial={{ opacity: 0, rotate: -2, y: 30 }} animate={{ opacity: 1, rotate: -0.6, y: 0 }} transition={{ duration: 0.7 }}>
        <div className="lb-date">The northern coast, 11:48 at night</div>
        <h2>Keep the Light</h2>
        <p>The storm came in faster than the forecast. Out on the point, the old light has gone dark, and somewhere past the reef a ship is feeling its way home.</p>
        <p>The Keeper knows every gear in that tower. The Captain knows every chart aboard that ship. Tonight, neither is enough on their own.</p>
        <p className="hand">Get the light burning. Bring the ship in.</p>
      </motion.div>

      <div className="roles">
        <div className={'role keeper ' + (keeper === 0 ? 'a' : 'b')}><small>The Keeper</small><b>{NAMES[keeper]}</b><span>In the tower</span></div>
        <button type="button" className="swap" onClick={() => setCfg({ keeper: 1 - M.cfg.keeper })} aria-label="Swap roles">⇄</button>
        <div className={'role captain ' + (captain === 0 ? 'a' : 'b')}><small>The Captain</small><b>{NAMES[captain]}</b><span>On the ship</span></div>
      </div>

      <div className="lbl">The storm</div>
      <div className="seg">
        <button type="button" className={!M.cfg.clock ? 'on' : ''} onClick={() => M.cfg.clock && setCfg({ clock: false })}>No clock<small>Take your time</small></button>
        <button type="button" className={M.cfg.clock ? 'on' : ''} onClick={() => !M.cfg.clock && setCfg({ clock: true })}>10 minutes<small>Before the storm peaks</small></button>
      </div>

      <div className="chips">
        {[0, 1].map((p) => <span key={p} className={'chip ' + (p ? 'b' : 'a') + (M.ready[p] ? ' on' : '')}><i>{NAMES[p][0]}</i>{NAMES[p]}<small>{M.ready[p] ? 'ready' : 'not yet'}</small></span>)}
      </div>
      {M.ready[me]
        ? <Btn kind="ghost" disabled>Waiting for {NAMES[1 - me]}</Btn>
        : <Btn kind="lamp" onClick={() => { buzz(20); send('ready', { m: M.n }); }}>I&rsquo;m ready</Btn>}
    </div>
  );
}

function End({ M, S, me, send, openLog }) {
  const ok = M.phase === 'done';
  const secs = M.startedAt && M.endedAt ? Math.round((Date.parse(M.endedAt) - Date.parse(M.startedAt)) / 1000) : null;
  const [draft, setDraft] = useState('');
  const mine = M.debrief[me], theirs = M.debrief[1 - me];
  return (
    <div className="end">
      <motion.div className={'fin' + (ok ? '' : ' fail')} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="eyebrow">{ok ? 'Safe in harbor' : 'The storm passed'}</div>
        <h2>{ok ? 'Home.' : 'Out at sea.'}</h2>
        <p>{ok ? 'The light held. The ship came in. Somewhere a kettle is going on.' : 'The ship rode it out past the reef. The light will be there next time.'}</p>
        <div className="stats">
          <div><b>{secs === null ? '–' : mmss(secs)}</b><small>Time</small></div>
          <div><b>{M.resets}</b><small>Restarts</small></div>
          <div><b>{M.flares}</b><small>Flares</small></div>
        </div>
      </motion.div>
      <div className="debrief">
        <div className="lbl">On the call</div>
        <div className="q">{S.prompt}</div>
        {mine === null ? (
          <>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="Your answer, if you want to keep it" />
            <div className="row2">
              <Btn kind="ghost" onClick={() => send('debrief', { m: M.n, text: '' })}>Just talk</Btn>
              <Btn kind="lamp" onClick={() => send('debrief', { m: M.n, text: draft })} disabled={!draft.trim()}>Keep it</Btn>
            </div>
          </>
        ) : theirs === null ? <p className="tiny">Waiting for {NAMES[1 - me]}.</p> : (
          [0, 1].map((p) => <div key={p} className={'ans ' + (p ? 'b' : 'a')}><b>{NAMES[p]}</b>{M.debrief[p] || <em>Said it out loud</em>}</div>)
        )}
      </div>
      <Btn kind="lamp" onClick={() => send('newmission', { m: M.n })}>Another storm</Btn>
      <Btn kind="ghost" onClick={openLog}>The logbook</Btn>
    </div>
  );
}

function LogSheet({ log, onClose }) {
  const L = log.slice().reverse(), done = log.filter((x) => x.result === 'complete').length;
  return (
    <motion.div className="sheet-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="sheet" role="dialog" aria-modal="true" aria-label="The logbook" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}>
        <h3>The logbook</h3>
        <p className="tiny">{done} brought home, {log.length - done} not finished</p>
        {!L.length && <p className="tiny">No storms on record yet.</p>}
        {L.map((x) => (
          <div className="mrow" key={x.n}>
            <div className="mh"><span>Night {x.n}</span><em className={x.result}>{x.result === 'complete' ? 'Home' : x.result === 'failed' ? 'Rode it out' : 'Called off'}</em></div>
            <div className="mm">{[x.date ? new Date(x.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null, x.result === 'complete' && x.secs !== null ? mmss(x.secs) : null, NAMES[x.keeper] + ' kept the light', x.resets + ' restarts', x.flares + ' flares'].filter(Boolean).join(', ')}</div>
            {[0, 1].map((p) => x.debrief[p] ? <div key={p} className={'ans ' + (p ? 'b' : 'a')}><b>{NAMES[p]}</b>{x.debrief[p]}</div> : null)}
          </div>
        ))}
        <Btn kind="ghost" onClick={onClose}>Close</Btn>
      </motion.div>
    </motion.div>
  );
}

/* ---------- big moments ---------- */
function Fx({ fx, onDone }) {
  const cb = useRef(onDone); cb.current = onDone;
  useEffect(() => {
    if (!fx) return undefined;
    const t = setTimeout(() => cb.current(), { role: 3400, reset: 3000, lighton: 4200, flare: 1900, wrong: 700, clear: 1300, complete: 4200, timeup: 3600 }[fx.kind] || 1500);
    return () => clearTimeout(t);
  }, [fx]);
  return (
    <AnimatePresence>
      {fx && fx.kind === 'role' && (
        <motion.div key={fx.id} className="ov" onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div>
            <div className="eyebrow">{fx.where}</div>
            <motion.h2 className={'ovbig ' + fx.cls} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>{fx.title}</motion.h2>
            <p>{fx.text}</p>
            <small className="skip">Tap to begin</small>
          </div>
        </motion.div>
      )}
      {fx && fx.kind === 'reset' && (
        <motion.div key={fx.id} className="ov dark" onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div><motion.h2 className="ovbig" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{fx.title}</motion.h2><p>{fx.text}</p></div>
        </motion.div>
      )}
      {fx && fx.kind === 'lighton' && (
        <motion.div key={fx.id} className="ov lighton" onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {fx.keeper
            ? <motion.div className="sweep" initial={{ rotate: -70, opacity: 0 }} animate={{ rotate: 40, opacity: [0, 1, 1, 0.8] }} transition={{ duration: 3.6, ease: 'easeInOut' }} />
            : <motion.div className="crossing" initial={{ x: '-120%' }} animate={{ x: '120%' }} transition={{ duration: 1.6, ease: 'easeInOut' }} />}
          <div>
            <motion.h2 className="ovbig gold" initial={{ opacity: 0, letterSpacing: '0.4em' }} animate={{ opacity: 1, letterSpacing: '0.02em' }} transition={{ delay: 0.6, duration: 1.4 }}>The light is on</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>Out in the fog, a ship turns toward it.</motion.p>
          </div>
        </motion.div>
      )}
      {fx && fx.kind === 'flare' && (
        <motion.div key={fx.id} className="flarefx" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.i initial={{ y: '90vh', x: '50vw', scale: 0.6 }} animate={{ y: '14vh', x: '58vw', scale: 1.2 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
          <motion.div className="flareglow" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.6, 0] }} transition={{ duration: 1.9, times: [0, 0.5, 0.65, 1] }} />
        </motion.div>
      )}
      {fx && fx.kind === 'wrong' && <motion.div key={fx.id} className="vignette bad" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} />}
      {fx && fx.kind === 'clear' && (
        <motion.div key={fx.id} className="banner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <b>{fx.title}</b>
        </motion.div>
      )}
      {fx && (fx.kind === 'complete' || fx.kind === 'timeup') && (
        <motion.div key={fx.id} className={'ov ' + (fx.kind === 'complete' ? 'home' : 'dark')} onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div><motion.h2 className="ovbig gold" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}>{fx.title}</motion.h2><p>{fx.text}</p></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function roleFx(M, me) {
  const keeper = keeperOf(M) === me;
  if (M.room === 1) {
    return keeper
      ? { kind: 'role', where: 'The tower', title: 'The Keeper', cls: 'keeper', text: 'The lamp is cold. You know every gear in this tower.' }
      : { kind: 'role', where: 'Out past the reef', title: 'The Captain', cls: 'captain', text: 'No light on the point and the storm is on you. Keep the bow into the waves.' };
  }
  return keeper
    ? { kind: 'role', where: 'The fog', title: 'The Keeper', cls: 'keeper', text: 'From up here you can see the rocks. They can’t.' }
    : { kind: 'role', where: 'The fog', title: 'The Captain', cls: 'captain', text: 'You can’t see past the bow, and your chart is old. The tower is the only thing you can trust.' };
}

/* ---------------------------------------------------------------- */
function Game({ room, me, onLeave }) {
  const { events, send, loaded } = useEvents(room, me);
  const live = useLive(room, me);
  const S = useMemo(() => reduce(events, room.seed), [events, room.seed]);
  const { M } = S;
  const names = NAMES;
  const left = useClock(M, send);
  const [fx, setFx] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [abortArm, setAbortArm] = useState(false);
  const [flareUntil, setFlareUntil] = useState(0);
  const seen = useRef(null), fxId = useRef(0), queued = useRef(null);
  const show = (o) => setFx({ ...o, id: ++fxId.current });
  const fxDone = () => { if (queued.current) { const q = queued.current; queued.current = null; show(q); } else setFx(null); };
  const isKeeper = keeperOf(M) === me, who = isKeeper ? 'keeper' : 'captain';
  const [myHold, setMyHold] = useMyHold(live, who);
  const partnerHold = usePartnerHold(live, isKeeper ? 'captain' : 'keeper');

  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) { seen.current = M.last.seq; return; }
    if (M.last.seq === seen.current) return;
    seen.current = M.last.seq;
    const k = M.last.kind;
    if (k === 'start') { buzz([30, 40, 30]); show(roleFx(M, me)); }
    else if (k === 'wrong' || k === 'scrape' || k === 'wrongberth' || k === 'storm') { buzz([70, 40, 90]); show({ kind: 'wrong' }); }
    else if (k === 'reset') { buzz([120, 60, 160]); show({ kind: 'reset', title: M.room === 1 ? 'The tower goes dark' : 'Back to open water', text: 'Three slips. Fresh start, new puzzles. Breathe.' }); }
    else if (k === 'clear') { buzz(40); show({ kind: 'clear', title: { clockwork: 'The lamp is lit', signal: 'The lens is turning', beam: 'The signal is set', harbor: 'Through the gate' }[M.last.stage] || 'Clear' }); }
    else if (k === 'roomclear') {
      // both phones play the same beam at the same moment: hers first, then it crosses his
      const ev = events.find((e) => e.seq === M.last.seq), at = ev && ev.created_at ? Date.parse(ev.created_at) : serverNow();
      const delay = Math.max(0, at + (isKeeper ? 700 : 1500) - serverNow());
      buzz([40, 60, 40, 60, 120]); queued.current = roleFx(M, me);
      setTimeout(() => show({ kind: 'lighton', keeper: isKeeper }), Math.min(delay, 2500));
    }
    else if (k === 'flare') { buzz([20, 30, 60]); setFlareUntil(performance.now() + 7000); show({ kind: 'flare' }); }
    else if (k === 'moored') { buzz([40, 40, 40]); }
    else if (k === 'complete') { buzz([40, 60, 40, 60, 160]); show({ kind: 'complete', title: 'Home', text: 'The line is tied. The light is still turning.' }); }
    else if (k === 'timeup') { buzz([200, 80, 200]); show({ kind: 'timeup', title: 'The storm peaks', text: 'The ship turns back to ride it out.' }); }
    else if (k === 'channel' && !isKeeper) buzz([20, 30, 20]);
    else if (k === 'ask' && me !== M.last.by) buzz([30, 50, 30]);
  }, [M.last.seq, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // the Captain's phone ties up once both of you have held for a moment
  useEffect(() => {
    if (!(M.phase === 'play' && M.room === 2 && M.moored && !isKeeper)) return undefined;
    let since = null, sent = false;
    const t = setInterval(() => {
      if (myHold.current && partnerHold) { if (since === null) since = performance.now(); if (!sent && performance.now() - since > 1500) { sent = true; send('tie', { m: M.n, a: M.att[2] }); } }
      else since = null;
    }, 100);
    return () => clearInterval(t);
  }, [M.phase, M.room, M.moored, M.n, M.att, isKeeper, partnerHold, myHold, send]);

  useEffect(() => { if (!abortArm) return undefined; const t = setTimeout(() => setAbortArm(false), 3000); return () => clearTimeout(t); }, [abortArm]);

  const act = (kind, extra) => send(kind, { m: M.n, a: M.att[M.room], s: M.stage, ...extra });
  const hinted = M.hint === hintKey(M);
  const name = M.phase === 'play' ? stageName(M) : null;
  const beamDeg = useRef(null);
  useEffect(() => { if (!(isKeeper && name === 'beam')) beamDeg.current = null; else if (beamDeg.current === null) beamDeg.current = 0; }, [isKeeper, name]);
  const hold = { set: setMyHold, partner: partnerHold };
  const playing = M.phase === 'play';
  const scene = M.phase === 'done' ? { storm: 0.05, fog: 0, light: true, stars: true }
    : M.phase === 'failed' ? { storm: 0.85, fog: 0.2, light: true }
    : M.phase === 'brief' ? { storm: 0.65, light: false }
    : M.room === 1 ? { storm: 0.85, light: false, lighthouse: false, beamRef: name === 'beam' ? beamDeg : null }
    : { storm: 0.35, fog: 1, light: true };
  const hud = playing ? <Hud M={M} left={left} names={names} live={live.linked} /> : null;
  const help = playing ? <HelpBar M={M} me={me} hands={S.hands} send={send} names={names} /> : null;
  const foot = (
    <footer className="foot">
      <button type="button" className="logbtn" onClick={() => setLogOpen(true)}>Logbook</button>
      {playing && <button type="button" className="link" onClick={() => { if (abortArm) { setAbortArm(false); send('newmission', { m: M.n }); } else setAbortArm(true); }}>{abortArm ? 'Tap again to call it off' : 'Call it off'}</button>}
      <a className="link" href="../">All games</a>
      <button type="button" className="link" onClick={onLeave}>Not you?</button>
    </footer>
  );

  let body;
  if (!loaded) body = <main className="game"><p className="tiny center">Climbing the stairs…</p></main>;
  else if (M.phase === 'brief') body = <main className="game"><header className="top"><div className="wm">Keep the Light</div></header><Brief M={M} me={me} send={send} />{foot}</main>;
  else if (!playing) body = <main className="game"><header className="top"><div className="wm">Keep the Light</div></header><End M={M} S={S} me={me} send={send} openLog={() => setLogOpen(true)} />{foot}</main>;
  else if (M.room === 1 && isKeeper) body = (
    <div className="play keeper">
      <div className="scene s-window">{hud}<ShipStatus live={live} /></div>
      <div className="console">
        {name === 'beam' && <BeamBridge beamDeg={beamDeg} />}
        <TowerStage name={name} inst={S.inst} M={M} act={act} hinted={hinted} beam={{ live, partnerName: names[captainOf(M)], myHold, partnerHold, setHold: setMyHold }} />
        <RadioSwitch open={M.channel} onOpen={() => { buzz(25); send('channel', { m: M.n }); }} captain={names[captainOf(M)]} />
        {help}
        {foot}
      </div>
    </div>
  );
  else if (M.room === 1) body = (
    <>
      <CaptainTower M={M} inst={S.inst} seed={room.seed} keeper={names[keeperOf(M)]} live={live} send={send} hinted={hinted} hold={hold} hud={hud} />
      <div className="floathelp">{help}</div>
    </>
  );
  else if (isKeeper) body = <><KeeperFog M={M} inst={S.inst} live={live} hold={hold} captain={names[captainOf(M)]} flareUntil={flareUntil} hud={hud} /><div className="floathelp">{help}</div></>;
  else body = <><CaptainFog M={M} inst={S.inst} seed={room.seed} keeper={names[keeperOf(M)]} live={live} send={send} hold={hold} flareUntil={flareUntil} hud={hud} /><div className="floathelp">{help}</div></>;

  return (
    <>
      {!(playing && !isKeeper) && <Sea {...scene} shipLit={M.room === 2 || M.phase === 'done'} />}
      {body}
      <Fx fx={fx} onDone={fxDone} />
      <AnimatePresence>{logOpen && <LogSheet log={S.log} onClose={() => setLogOpen(false)} />}</AnimatePresence>
    </>
  );
}

/* mirrors the lens angle into the window above the console */
function BeamBridge({ beamDeg }) {
  useEffect(() => {
    const f = (e) => { if (e.detail && typeof e.detail.ang === 'number') beamDeg.current = e.detail.ang; };
    window.addEventListener('lh-lens', f); return () => window.removeEventListener('lh-lens', f);
  }, [beamDeg]);
  return null;
}
