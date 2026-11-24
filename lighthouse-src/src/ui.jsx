import { motion } from 'framer-motion';

export const NAMES = ['Khadi', 'Manny'];
export const PIN_HEX = { red: '#e5483c', blue: '#3f7be0', yellow: '#f2c230', green: '#2fae6b', white: '#f4f1ea', black: '#15151c' };
export const LIGHT_HEX = ['#fff3cf', '#ff5a4d', '#4fdc8a'];
export const LIGHT_NAMES = ['White', 'Red', 'Green'];

// Haptics. Android vibrates. iPhone Safari has no vibration API, but toggling a native
// switch control gives a real haptic tick, so we keep a hidden one and click it (works on taps).
let iosSwitch = null;
const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
function iosTick() {
  try {
    if (!iosSwitch) {
      const l = document.createElement('label');
      l.setAttribute('aria-hidden', 'true');
      l.style.cssText = 'position:fixed;left:-40px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      l.appendChild(i); document.body.appendChild(l); iosSwitch = l;
    }
    iosSwitch.click();
  } catch { /* nothing to do */ }
}
export const buzz = (p) => {
  try {
    if (navigator.vibrate && !isIOS) { navigator.vibrate(p); return; }
    if (isIOS) { const n = Array.isArray(p) ? Math.ceil(p.length / 2) : 1; for (let k = 0; k < Math.min(n, 3); k++) setTimeout(iosTick, k * 90); }
  } catch { /* not supported */ }
};

// Tilt steering. iPhone asks for permission once, from a tap.
export async function askTilt() {
  try {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') return (await D.requestPermission()) === 'granted';
    return !!D;
  } catch { return false; }
}
export const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function Pattern({ p, c, size = 1 }) {
  return (
    <span className="pattern" style={{ '--lc': LIGHT_HEX[c], '--sz': size }} aria-label={(LIGHT_NAMES[c] || '') + ' light: ' + p.split('').map((x) => (x === 'S' ? 'short' : 'long')).join(', ')}>
      {p.split('').map((x, i) => <i key={i} className={x === 'S' ? 's' : 'l'} />)}
    </span>
  );
}

export function PinSvg({ color, pulled }) {
  return (
    <svg viewBox="0 0 40 92" className="pinsvg" aria-hidden="true">
      <rect x="17" y="30" width="6" height="56" rx="2" fill={pulled ? '#4a4f60' : '#c9a25a'} stroke="#2a1f0c" strokeWidth="1.5" />
      <rect x="15" y="62" width="10" height="4" fill="#2a1f0c" opacity=".35" />
      <circle cx="20" cy="20" r="15" fill={PIN_HEX[color]} stroke="#1a1408" strokeWidth="2.5" />
      <circle cx="15" cy="15" r="4.5" fill="#fff" opacity=".35" />
    </svg>
  );
}

export function Lantern({ on }) {
  return (
    <svg viewBox="0 0 24 32" className={'lantern' + (on ? ' on' : '')} aria-hidden="true">
      <path d="M8 6h8M12 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="8" width="14" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z" className="flame" />
      <path d="M4 28h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function FlareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="flareic" aria-hidden="true">
      <path d="M12 2l2.2 6.6L21 9l-5.4 4 2 6.8L12 16l-5.6 3.8 2-6.8L3 9l6.8-.4z" fill="currentColor" />
    </svg>
  );
}

export function Btn({ kind = 'gold', className = '', ...rest }) {
  return <motion.button whileTap={{ scale: 0.97 }} type="button" className={'btn ' + kind + ' ' + className} {...rest} />;
}
