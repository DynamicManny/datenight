import { W, H, currentAt } from './logic.js';
import { COLS } from './FogChart.jsx';

/* The Captain's chart. It is old. One rock on it is not really there, and one real rock is missing.
   It has no idea where the ship is. */
export default function OldChart({ inst, errors, berthNote }) {
  const c = 30, pad = 22;
  const isPhantom = (x, y) => errors.phantom && errors.phantom[0] === x && errors.phantom[1] === y;
  const isMissing = (x, y) => errors.missing && errors.missing[0] === x && errors.missing[1] === y;
  return (
    <svg className="oldchart" viewBox={`0 0 ${W * c + pad + 8} ${H * c + pad + 8}`} role="img" aria-label="Your chart of these waters. It is out of date.">
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#173246" strokeWidth="1.4" /></pattern>
      </defs>
      <rect x={pad} y={4} width={W * c} height={H * c} fill="#d7e7e3" stroke="#173246" strokeWidth="1.5" />
      {Array.from({ length: W }, (_, x) => <text key={'c' + x} x={pad + x * c + c / 2} y={H * c + 20} className="ocl">{COLS[x]}</text>)}
      {Array.from({ length: H }, (_, y) => <text key={'r' + y} x={pad - 7} y={4 + y * c + c / 2 + 4} className="ocl" textAnchor="end">{y + 1}</text>)}
      {Array.from({ length: W + 1 }, (_, x) => <line key={'v' + x} x1={pad + x * c} y1={4} x2={pad + x * c} y2={4 + H * c} stroke="#173246" strokeOpacity=".15" />)}
      {Array.from({ length: H + 1 }, (_, y) => <line key={'h' + y} x1={pad} y1={4 + y * c} x2={pad + W * c} y2={4 + y * c} stroke="#173246" strokeOpacity=".15" />)}
      {inst.cells.map((row, y) => row.map((k, x) => {
        const px = pad + x * c, py = 4 + y * c, cx = px + c / 2, cy = py + c / 2;
        const rock = (k === 'r' && !isMissing(x, y)) || isPhantom(x, y);
        const boat = k === 'boat' && !isMissing(x, y);
        const out = [];
        if (rock) out.push(<g key="r"><circle cx={cx} cy={cy} r={c * 0.34} fill="url(#hatch)" stroke="#173246" strokeWidth="1.3" /><text x={cx} y={cy + 4} className="ocx">+</text></g>);
        if (boat) out.push(<ellipse key="b" cx={cx} cy={cy} rx={c * 0.16} ry={c * 0.36} fill="#173246" opacity=".75" />);
        if (k === 'p') out.push(<rect key="p" x={px} y={py + 4} width={c} height={c - 8} fill="#9a8a6a" />);
        if (k === 'b') out.push(<g key="bb"><rect x={px + 3} y={py + 3} width={c - 6} height={c - 6} fill="none" stroke="#173246" strokeDasharray="3 2" /><text x={cx} y={cy + 5} className="ocb">{inst.berths.indexOf(x) + 1}</text></g>);
        if (k === 'g') out.push(<g key="g"><circle cx={px + 3} cy={cy} r="4" fill="#c8342a" /><circle cx={px + c - 3} cy={cy} r="4" fill="#2f9e5b" /></g>);
        const cur = currentAt(inst, x, y);
        if (cur) out.push(<path key="cu" d={`M${cx - cur * 9} ${cy}h${cur * 16}m${-cur * 6} -5l${cur * 6} 5l${-cur * 6} 5`} stroke="#2a6f8a" strokeWidth="2" fill="none" />);
        return out.length ? <g key={x + ',' + y}>{out}</g> : null;
      }))}
      <text x={pad + 4} y={H * c - 2} className="oclegend">Surveyed 1931</text>
      {berthNote && <text x={pad + W * c - 4} y={H * c - 2} className="oclegend" textAnchor="end">{berthNote}</text>}
    </svg>
  );
}
