'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/util';

const Ctx = createContext({ unread: {}, total: 0, setActive() {}, clear() {}, refresh() {} });
export const useNotify = () => useContext(Ctx);
export const canNotify = () => typeof Notification !== 'undefined';
export const askPermission = async () => (canNotify() ? Notification.requestPermission() : 'unsupported');

async function system(title, body, url) { // phone-style notification while the app is in the background
  if (!canNotify() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return reg.showNotification(title, { body, icon: '/icon-192.png', tag: url, data: { url } });
  } catch {}
  try { new Notification(title, { body, icon: '/icon-192.png' }); } catch {}
}

// Wraps the signed-in app. Keeps unread counts per group, listens for new messages in every group you are in,
// and alerts you (toast when the app is open, system notification when it is in the background).
export default function NotifyProvider({ user, children }) {
  const [unread, setUnread] = useState({}); const active = useRef(null);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('unread_counts'); if (error) return;
    const m = {}; (data || []).forEach(r => { if (r.gid !== active.current) m[r.gid] = Number(r.n); }); setUnread(m);
  }, []);
  const setActive = useCallback(gid => { active.current = gid; if (gid) setUnread(u => ({ ...u, [gid]: 0 })); }, []);
  const clear = useCallback(gid => setUnread(u => (u[gid] ? { ...u, [gid]: 0 } : u)), []);

  useEffect(() => {
    supabase.rpc('purge_chat').then(() => refresh());
    const iv = setInterval(refresh, 60000);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', vis);
    const ch = supabase.channel('chat-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: m }) => {
        if (m.user_id === user.id) return;
        if (m.group_id === active.current && !document.hidden) return; // you are looking at that chat right now
        setUnread(u => ({ ...u, [m.group_id]: (u[m.group_id] || 0) + 1 }));
        const [g, p] = await Promise.all([
          supabase.from('groups').select('name').eq('id', m.group_id).maybeSingle(),
          supabase.from('profiles').select('username').eq('id', m.user_id).maybeSingle()]);
        const title = g.data?.name || 'Group chat'; const body = `${p.data?.username || 'Someone'}: ${m.body}`;
        if (document.hidden) system(title, body.slice(0, 140), `/g/${m.group_id}?chat=1`);
        else toast(`💬 ${title} · ${body.slice(0, 80)}`);
      }).subscribe();
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); supabase.removeChannel(ch); };
  }, [user.id]);

  const total = Object.values(unread).reduce((a, b) => a + b, 0);
  useEffect(() => { // red badge on the installed app icon where the phone supports it
    try { if (total > 0) navigator.setAppBadge?.(total); else navigator.clearAppBadge?.(); } catch {}
  }, [total]);

  return <Ctx.Provider value={{ unread, total, setActive, clear, refresh }}>{children}</Ctx.Provider>;
}