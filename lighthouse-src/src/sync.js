import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const ROOM = 'light';
const SLOT_KEY = 'datenight-khadi-manny-v1';
let client = null;
let offset = 0; // server clock minus this phone's clock, learned from our own inserts

export const serverNow = () => Date.now() + offset;

export function getClient() {
  if (client) return client;
  if (window.__DN_MOCK__) return (client = window.__DN_MOCK__);
  const c = window.DATENIGHT;
  if (!c) return null;
  client = createClient(c.url, c.key);
  return client;
}

export function loadSlot() {
  try { const r = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null'); return r && (r.slot === 0 || r.slot === 1) ? r.slot : null; } catch { return null; }
}
export function saveSlot(slot) { try { localStorage.setItem(SLOT_KEY, JSON.stringify({ slot })); } catch { /* private mode */ } }
export function clearSlot() { try { localStorage.removeItem(SLOT_KEY); } catch { /* private mode */ } }

export function friendly(err) {
  const m = String((err && err.message) || err || '');
  if (/schema cache|does not exist|relation/i.test(m)) return 'The database is not set up yet. Run the SQL setup in Supabase, then refresh.';
  if (/fetch|network/i.test(m)) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong: ' + m;
}

export async function openRoom() {
  const sb = getClient();
  if (!sb) throw new Error('The game could not load its connection. Refresh the page.');
  for (let i = 0; i < 3; i++) {
    const r = await sb.from('rooms').select('*').eq('code', ROOM).maybeSingle();
    if (r.error) throw r.error;
    if (r.data) return r.data;
    const seed = Math.random().toString(36).slice(2, 10);
    const ins = await sb.from('rooms').insert({ code: ROOM, game: 'light', seed, p0_name: 'Khadi', p1_name: 'Manny' });
    if (!ins.error) return { code: ROOM, seed };
    if (ins.error.code !== '23505') throw ins.error;
  }
  throw new Error('Could not open the room. Try again.');
}

export function useEvents(room, me) {
  const map = useRef(new Map());
  const [events, setEvents] = useState([]);
  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const maxSeq = () => { let m = -1; map.current.forEach((_, k) => { if (k > m) m = k; }); return m; };
  const add = useCallback((rows) => {
    let changed = false;
    for (const r of rows) if (r && !map.current.has(r.seq)) { map.current.set(r.seq, r); changed = true; }
    if (changed) setEvents(Array.from(map.current.values()));
  }, []);
  const fetchAll = useCallback(async () => {
    const sb = getClient();
    try {
      const r = await sb.from('events').select('*').eq('room', room.code).gt('seq', maxSeq()).order('seq', { ascending: true }).limit(3000);
      if (!r.error) add(r.data || []);
      return !r.error;
    } catch { return false; }
  }, [room, add]);

  useEffect(() => {
    if (!room) return undefined;
    const sb = getClient();
    let ch = null, alive = true;
    fetchAll().then(() => { if (alive) setLoaded(true); });
    try {
      ch = sb.channel('light-' + room.code)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: 'room=eq.' + room.code }, (p) => add([p.new]))
        .subscribe((s) => setLive(s === 'SUBSCRIBED'));
    } catch { setLive(false); }
    const t = setInterval(() => { if (!document.hidden) fetchAll(); }, 2500);
    const vis = () => { if (!document.hidden) fetchAll(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); try { if (ch) sb.removeChannel(ch); } catch { /* ignore */ } };
  }, [room, fetchAll, add]);

  const send = useCallback(async (kind, payload) => {
    const sb = getClient();
    for (let t = 0; t < 4; t++) {
      const row = { room: room.code, seq: maxSeq() + 1, player: me, kind, payload: payload || {} };
      const sentAt = Date.now();
      const r = await sb.from('events').insert(row).select().maybeSingle();
      if (!r.error) {
        const got = r.data || { ...row, created_at: new Date(sentAt + offset).toISOString() };
        if (r.data && r.data.created_at) { const srv = Date.parse(r.data.created_at); if (!isNaN(srv)) offset = srv - (sentAt + Date.now()) / 2; }
        add([got]);
        return true;
      }
      if (r.error.code === '23505') { await fetchAll(); continue; }
      return false;
    }
    return false;
  }, [room, me, add, fetchAll]);

  return { events, send, live, loaded };
}

/* Live link: fast, throwaway messages between the two phones (ship position, lens angle, held buttons).
   Nothing here is saved. Anything that decides the game still goes through the event log. */
export function useLive(room, me) {
  const ch = useRef(null), subs = useRef({});
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    if (!room) return undefined;
    const sb = getClient();
    let c = null;
    try {
      c = sb.channel('live-' + room.code, { config: { broadcast: { self: false, ack: false } } });
      c.on('broadcast', { event: '*' }, (msg) => {
        const { event, payload } = msg || {};
        if (!payload || payload.from === me) return;
        (subs.current[event] || []).forEach((f) => f(payload));
      }).subscribe((s) => setLinked(s === 'SUBSCRIBED'));
      ch.current = c;
    } catch { setLinked(false); }
    return () => { try { if (c) sb.removeChannel(c); } catch { /* ignore */ } ch.current = null; };
  }, [room, me]);
  const emit = useCallback((event, payload) => {
    try { if (ch.current) ch.current.send({ type: 'broadcast', event, payload: { ...payload, from: me, at: serverNow() } }); } catch { /* dropped, the next one will land */ }
  }, [me]);
  const on = useCallback((event, f) => {
    (subs.current[event] = subs.current[event] || []).push(f);
    return () => { subs.current[event] = (subs.current[event] || []).filter((g) => g !== f); };
  }, []);
  return useMemo(() => ({ emit, on, linked }), [emit, on, linked]);
}
