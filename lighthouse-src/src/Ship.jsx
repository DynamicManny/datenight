import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ruleText, actText } from './logic.js';
import { Pattern } from './ui.jsx';

export function RadioSet({ open, keeper }) {
  return (
    <div className={'radioset' + (open ? ' on' : '')}>
      <div className="grille" aria-hidden="true">{open ? <div className="wave" /> : <div className="static" />}</div>
      <div className="rinfo">
        <div className="rlamp"><i />{open ? 'Channel open' : 'No signal'}</div>
        <b>{open ? keeper + ' is on the line.' : 'The tower is silent.'}</b>
        <small>{open ? 'Your manual is open. Talk them through it.' : 'The light on the point is dark. All you can do is hold your course.'}</small>
      </div>
    </div>
  );
}

export function ShipLog({ keeper }) {
  return (
    <div className="slip">
      <div className="slip-h">Ship&rsquo;s log</div>
      <p>11:52. Wind backing west. Rain heavy.</p>
      <p>No light on the point. Can&rsquo;t make the harbor blind.</p>
      <p>Radio set to the tower&rsquo;s channel. Waiting on {keeper}.</p>
    </div>
  );
}

export function Manual({ inst, hinted }) {
  const [struck, setStruck] = useState({});
  const tog = (k) => setStruck((s) => ({ ...s, [k]: !s[k] }));
  return (
    <div className="paper">
      <div className="paper-h">Keeper&rsquo;s manual, section 4: the clockwork</div>
      <p className="pintro">Go down the list. The first rule that fits the tower is the one. Tap a rule to cross it out.</p>
      <ol className="rules">
        {inst.rules.map((r, i) => <li key={i} className={struck[i] ? 'struck' : ''} onClick={() => tog(i)}>{ruleText(r)}</li>)}
        <li className={'def' + (struck.d ? ' struck' : '')} onClick={() => tog('d')}>Otherwise, {actText(inst.def)}.</li>
      </ol>
      <p className="ptip">Pins are counted from the left.</p>
      {hinted && <p className="pnote">You sent a flare. Two wrong pins are marked on their side.</p>}
    </div>
  );
}

export function ListOfLights({ inst }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="paper">
      <div className="paper-h">List of Lights, northern coast</div>
      <p className="pintro">Find the tower they are standing in. Read them its flashes, in order, and its color.</p>
      <div className="lights">
        {inst.list.map((e, i) => (
          <button type="button" key={e.name} className={'lrow' + (sel === i ? ' sel' : '')} onClick={() => setSel(sel === i ? null : i)}>
            <span className="ln">{e.name}</span>
            <span className="ly">{e.year}</span>
            <Pattern p={e.p} c={e.c} />
          </button>
        ))}
      </div>
      <p className="ptip">A dot is a short flash. A bar is a long one.</p>
    </div>
  );
}

export function Standby({ keeper }) {
  return (
    <div className="paper">
      <div className="paper-h">Keeper&rsquo;s manual, section 1: the lamp</div>
      <p className="pintro">Priming the lamp is in the Keeper&rsquo;s hands. There is nothing in the manual for this part.</p>
      <p className="hand">Stand by. {keeper} has this one.</p>
    </div>
  );
}

export function ShipStage({ name, inst, M, keeper, hinted }) {
  const k = M.channel ? M.att[1] + ':' + M.stage : 'closed';
  return (
    <>
      <RadioSet open={M.channel} keeper={keeper} />
      <AnimatePresence mode="wait">
        <motion.div key={k} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
          {!M.channel && <ShipLog keeper={keeper} />}
          {M.channel && name === 'prime' && <Standby keeper={keeper} />}
          {M.channel && name === 'clockwork' && <Manual inst={inst} hinted={hinted} />}
          {M.channel && name === 'signal' && <ListOfLights inst={inst} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
