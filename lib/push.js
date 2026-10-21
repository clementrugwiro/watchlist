import { supabase } from './supabase';
const toBytes = s => { const p = '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from([...atob((s + p).replace(/-/g, '+').replace(/_/g, '/'))].map(c => c.charCodeAt(0))); };
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// Tells the server something happened; the server decides who gets a phone notification. Never blocks the UI.
export async function pushEvent(evt) {
  try {
    const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
    fetch('/api/push/event', { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(evt) });
  } catch {}
}
export async function pushEnabled() {
  try { if (!pushSupported() || Notification.permission !== 'granted') return false;
    return !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch { return false; }
}
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('This browser cannot receive notifications. On iPhone, add the app to your Home Screen first.');
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error('Notifications are not configured on the server yet');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Allow them in your phone settings for this app.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permission was not granted');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
}
export async function disablePush() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
}
