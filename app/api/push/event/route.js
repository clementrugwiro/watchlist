import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const no = (error, status) => Response.json({ error }, { status });
export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const { data: au } = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).auth.getUser(token);
  const me = au?.user; if (!me) return no('Not signed in', 401);
  const { SUPABASE_SERVICE_ROLE_KEY: key, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env;
  if (!key || !pub || !priv) return no('Push is not configured on the server', 500);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const e = await req.json().catch(() => ({}));
  const members = async gid => ((await db.from('group_members').select('user_id').eq('group_id', gid)).data || []).map(r => r.user_id);
  const { data: mp } = await db.from('profiles').select('username').eq('id', me.id).maybeSingle();
  const who = mp?.username || 'Someone';
  let ids = [], payload;

  if (e.type === 'message') { // a chat message you just sent
    const { data: m } = await db.from('messages').select('id,group_id,user_id,body,gif_url,groups(name)').eq('id', e.messageId).maybeSingle();
    if (!m || m.user_id !== me.id) return no('Not allowed', 403);
    ids = await members(m.group_id);
    payload = { title: m.groups?.name || 'Group chat', body: `${who}: ${m.gif_url ? 'sent a GIF' : (m.body || '').slice(0, 120)}`, url: `/g/${m.group_id}?chat=1`, tag: `msg-${m.id}` };
  } else if (e.type === 'media_added') { // a title you just added to a group
    const { data: gm } = await db.from('group_media').select('group_id,added_by,media(title),groups(name)').eq('group_id', e.groupId).eq('media_id', e.mediaId).maybeSingle();
    if (!gm || gm.added_by !== me.id) return no('Not allowed', 403);
    ids = await members(gm.group_id);
    payload = { title: gm.groups?.name || 'Group', body: `${who} added ${gm.media?.title}`, url: `/g/${gm.group_id}`, tag: `add-${gm.group_id}-${e.mediaId}-${Date.now()}` };
  } else if (e.type === 'episodes') { // new episodes you just added
    const n = Math.min(Math.max(parseInt(e.count) || 0, 0), 2000); if (!n) return Response.json({ sent: 0 });
    const { data: md } = await db.from('media').select('title,created_by').eq('id', e.mediaId).maybeSingle();
    if (!md) return no('Unknown title', 404);
    const gids = ((await db.from('group_media').select('group_id').eq('media_id', e.mediaId)).data || []).map(r => r.group_id);
    const inGroup = gids.length && (await db.from('group_members').select('group_id').eq('user_id', me.id).in('group_id', gids)).data?.length;
    if (md.created_by !== me.id && !inGroup) return no('Not allowed', 403);
    const [w, c, l] = await Promise.all([ // people watching it, or who completed it
      db.from('watch_progress').select('user_id').eq('media_id', e.mediaId).eq('status', 'watching'),
      db.from('user_media').select('user_id').eq('media_id', e.mediaId),
      db.from('watchlist').select('user_id').eq('media_id', e.mediaId).in('status', ['watching', 'completed'])]);
    ids = [...new Set([...(w.data || []), ...(c.data || []), ...(l.data || [])].map(r => r.user_id))];
    payload = { title: md.title, body: `${n} new episode${n > 1 ? 's' : ''} added`, url: `/m/${e.mediaId}`, tag: `eps-${e.mediaId}-${Date.now()}` };
  } else return no('Unknown event', 400);

  ids = ids.filter(id => id !== me.id);
  if (!ids.length) return Response.json({ sent: 0 });
  const { data: subs } = await db.from('push_subscriptions').select('endpoint,p256dh,auth').in('user_id', ids);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  let sent = 0;
  await Promise.all((subs || []).map(async s => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload)); sent++; }
    catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); }
  }));
  return Response.json({ sent });
}
