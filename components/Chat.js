'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, CornerUpLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/util';
import { useNotify } from './Notify';
import { Sheet } from './ui';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];
const COLS = 'id,user_id,body,gif_url,reply_to,created_at,expires_at';
const left = ms => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const fmt = t => {
  const d = new Date(t); const s = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? s : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${s}`;
};

// Floating chat bubble + popup for one group. `members` is the group_members list (with profiles) from the group page.
export default function Chat({ groupId, user, members }) {
  const { unread, setActive, clear } = useNotify();
  const [open, setOpen] = useState(false); const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const [now, setNow] = useState(Date.now());
  const [reply, setReply] = useState(null); const [sel, setSel] = useState(null);
  const [gifOpen, setGifOpen] = useState(false); const [gifs, setGifs] = useState(null); const [gq, setGq] = useState('');
  const box = useRef(null); const sent = useRef(new Set()); const ref = useRef([]); ref.current = msgs;
  const who = id => members.find(x => x.user_id === id);
  const others = members.filter(x => x.user_id !== user.id);
  const add = m => setMsgs(ms => (ms.some(x => x.id === m.id) ? ms : [...ms, { ...m, reads: [], reacts: [] }]));

  useEffect(() => { if (new URLSearchParams(window.location.search).get('chat')) setOpen(true); }, []); // opened from a notification

  const load = useCallback(async () => {
    const { data } = await supabase.from('messages').select(`${COLS},message_reads(user_id),message_reactions(emoji,user_id)`)
      .eq('group_id', groupId).order('created_at', { ascending: false }).limit(200);
    setNow(Date.now());
    setMsgs((data || []).reverse().map(m => ({ ...m, reads: (m.message_reads || []).map(r => r.user_id), reacts: m.message_reactions || [] })));
  }, [groupId]);

  useEffect(() => { // live updates while the popup is open
    if (!open) return;
    setActive(groupId); sent.current = new Set();
    supabase.rpc('purge_chat').then(load);
    const f = `group_id=eq.${groupId}`;
    const ch = supabase.channel(`chat-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: f }, p => add(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: f },
        p => setMsgs(ms => ms.map(m => (m.id === p.new.id ? { ...m, expires_at: p.new.expires_at } : m))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, p => setMsgs(ms => ms.filter(m => m.id !== p.old.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' },
        p => setMsgs(ms => ms.map(m => (m.id === p.new.message_id && !m.reads.includes(p.new.user_id) ? { ...m, reads: [...m.reads, p.new.user_id] } : m))))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        p => setMsgs(ms => ms.map(m => (m.id === p.new.message_id && !m.reacts.some(r => r.user_id === p.new.user_id && r.emoji === p.new.emoji)
          ? { ...m, reacts: [...m.reacts, { emoji: p.new.emoji, user_id: p.new.user_id }] } : m))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        p => setMsgs(ms => ms.map(m => (m.id === p.old.message_id
          ? { ...m, reacts: m.reacts.filter(r => !(r.user_id === p.old.user_id && r.emoji === p.old.emoji)) } : m))))
      .subscribe();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(t); supabase.removeChannel(ch); setActive(null); };
  }, [open, groupId]);

  const markRead = useCallback(() => { // everything from others that you can currently see counts as read
    if (!open || document.hidden) return;
    clear(groupId);
    const todo = ref.current.filter(m => m.user_id !== user.id && !m.reads.includes(user.id) && !sent.current.has(m.id));
    if (!todo.length) return;
    todo.forEach(m => sent.current.add(m.id));
    supabase.from('message_reads').upsert(todo.map(m => ({ message_id: m.id, user_id: user.id })), { onConflict: 'message_id,user_id', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) return todo.forEach(m => sent.current.delete(m.id));
        const ids = new Set(todo.map(m => m.id));
        setMsgs(ms => ms.map(m => (ids.has(m.id) ? { ...m, reads: [...m.reads, user.id] } : m)));
      });
  }, [open, groupId, user.id]);
  useEffect(() => { markRead(); }, [msgs, markRead]);
  useEffect(() => { document.addEventListener('visibilitychange', markRead); return () => document.removeEventListener('visibilitychange', markRead); }, [markRead]);

  const vis = msgs.filter(m => !m.expires_at || new Date(m.expires_at).getTime() > now); // expired ones disappear even before the purge runs
  useEffect(() => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; }, [vis.length, open]);

  async function post(fields) {
    const { data, error } = await supabase.from('messages')
      .insert({ group_id: groupId, user_id: user.id, reply_to: reply?.id || null, ...fields }).select(COLS).single();
    if (error) { toast(error.message, true); return false; }
    setReply(null); add(data); return true;
  }
  async function send(e) {
    e.preventDefault(); const body = text.trim(); if (!body) return; setText('');
    if (!(await post({ body }))) setText(body);
  }
  const sendGif = async g => { if (await post({ body: (g.title || 'GIF').slice(0, 100), gif_url: g.url })) setGifOpen(false); };
  async function findGifs(term) {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/gifs?q=' + encodeURIComponent(term), { headers: { Authorization: `Bearer ${session?.access_token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'GIF search failed', true);
    setGifs(j.results);
  }
  async function react(m, emoji) {
    setSel(null);
    const mine = m.reacts.some(r => r.user_id === user.id && r.emoji === emoji);
    setMsgs(ms => ms.map(x => (x.id !== m.id ? x : { ...x, reacts: mine
      ? x.reacts.filter(r => !(r.user_id === user.id && r.emoji === emoji)) : [...x.reacts, { emoji, user_id: user.id }] })));
    const { error } = await (mine
      ? supabase.from('message_reactions').delete().eq('message_id', m.id).eq('user_id', user.id).eq('emoji', emoji)
      : supabase.from('message_reactions').insert({ message_id: m.id, user_id: user.id, emoji }));
    if (error) { toast(error.message, true); load(); }
  }
  const nameOf = id => (id === user.id ? 'You' : who(id)?.profiles?.username || 'Former member');

  if (!open) return (
    <button className="chatfab" aria-label="Open group chat" onClick={() => setOpen(true)}>
      <MessageCircle size={26} />{(unread[groupId] || 0) > 0 && <i className="dot">{unread[groupId] > 9 ? '9+' : unread[groupId]}</i>}</button>);

  return (<>
    <div className="chat" role="dialog" aria-label="Group chat">
      <div className="chd"><div><b>Group chat</b><div className="muted" style={{ fontSize: 11 }}>Messages vanish 12 hours after everyone has read them</div></div>
        <button className="ib" aria-label="Close chat" onClick={() => setOpen(false)}><X size={22} /></button></div>
      <div className="cmsgs" ref={box}>
        {vis.length === 0 && <div className="empty" style={{ padding: '30px 10px' }}>No messages yet. Say hi 👋</div>}
        {vis.map((m, i) => {
          const mine = m.user_id === user.id; const w = who(m.user_id); const prev = vis[i - 1];
          const seen = others.filter(o => m.reads.includes(o.user_id)).length;
          const gone = m.expires_at ? left(new Date(m.expires_at).getTime() - now) : null;
          const rp = m.reply_to && vis.find(x => x.id === m.reply_to);
          const rx = Object.entries(m.reacts.reduce((a, r) => ((a[r.emoji] = a[r.emoji] || []).push(r.user_id), a), {}));
          return (<div key={m.id} className={`msg ${mine ? 'me' : ''}`}>
            {!mine && prev?.user_id !== m.user_id && <span className="mn" style={{ color: w?.color }}>{w?.profiles?.username || 'Former member'}</span>}
            <div className="mb" style={mine ? {} : { borderLeft: `3px solid ${w?.color || 'var(--line)'}` }} onClick={() => setSel(sel === m.id ? null : m.id)}>
              {m.reply_to && <div className="cq">{rp ? `${nameOf(rp.user_id)}: ${rp.gif_url ? 'GIF' : rp.body}` : 'Original message'}</div>}
              {m.gif_url ? <img className="cgif" src={m.gif_url} alt="GIF" /> : m.body}</div>
            {rx.length > 0 && <div className="crx">{rx.map(([e, us]) =>
              <button key={e} className={`crxb ${us.includes(user.id) ? 'on' : ''}`} onClick={() => react(m, e)}>{e} {us.length}</button>)}</div>}
            {sel === m.id && <div className="cact">{EMOJIS.map(e => <button key={e} onClick={() => react(m, e)}>{e}</button>)}
              <button onClick={() => { setReply(m); setSel(null); }}><CornerUpLeft size={16} /> Reply</button></div>}
            <span className="mt">{fmt(m.created_at)}
              {mine && ` · ${seen === 0 ? 'Sent' : seen === others.length ? 'Seen by all' : `Seen by ${seen}/${others.length}`}`}
              {gone && ` · gone in ${gone}`}</span></div>);
        })}
      </div>
      {reply && <div className="crep"><span>Replying to {nameOf(reply.user_id)}: {reply.gif_url ? 'GIF' : reply.body.slice(0, 60)}</span>
        <button className="ib" aria-label="Cancel reply" onClick={() => setReply(null)}><X size={16} /></button></div>}
      <form className="cin" onSubmit={send}>
        <button type="button" className="btn sec" onClick={() => { setGifOpen(true); findGifs(''); }}>GIF</button>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Message the group..." maxLength={1000} autoFocus />
        <button className="btn" aria-label="Send" disabled={!text.trim()}><Send size={18} /></button></form>
    </div>
    {gifOpen && <Sheet title="Send a GIF" onClose={() => setGifOpen(false)}>
      <form onSubmit={e => { e.preventDefault(); findGifs(gq); }}><input placeholder="Search GIFs" value={gq} onChange={e => setGq(e.target.value)} /></form>
      <div className="gifgrid">{(gifs || []).map(x => <img key={x.id} src={x.preview} alt={x.title} onClick={() => sendGif(x)} />)}</div>
      <p className="muted">Powered by GIPHY</p></Sheet>}
  </>);
}