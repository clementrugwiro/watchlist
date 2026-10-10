'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Camera, Bell, Search } from 'lucide-react';
import Shell from '../../components/Shell';
import { Avatar, Field } from '../../components/ui';
import WatchLists from '../../components/WatchLists';
import { askPermission, canNotify } from '../../components/Notify';
import { supabase } from '../../lib/supabase';
import { act, toast, uploadImage, removeImage } from '../../lib/util';
export default function Page() { return <Shell>{u => <Profile user={u} />}</Shell>; }
function Profile({ user }) {
  const [p, setP] = useState(null); const [pw, setPw] = useState(''); const [perm, setPerm] = useState('default');
  const [q, setQ] = useState(''); const [found, setFound] = useState(null);
  const load = () => supabase.from('profiles').select('username,avatar_url,created_at').eq('id', user.id).maybeSingle().then(({ data }) => setP(data));
  useEffect(() => { load(); setPerm(canNotify() ? Notification.permission : 'unsupported'); }, []);
  useEffect(() => { // find a friend by username
    const s = q.trim().replace(/[%_]/g, ''); if (s.length < 2) { setFound(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id,username,avatar_url').ilike('username', `%${s}%`).neq('id', user.id).order('username').limit(8);
      setFound(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  async function photo(e) {
    const file = e.target.files[0]; if (!file) return;
    const url = await uploadImage('avatars', user.id, file, 256); if (!url) return;
    if (await act(supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id), 'Photo updated')) { removeImage('avatars', p?.avatar_url); load(); }
  }
  async function change(e) { e.preventDefault(); if (await act(supabase.auth.updateUser({ password: pw }), 'Password changed')) setPw(''); }
  async function enableNotes() { const r = await askPermission(); setPerm(r); if (r === 'granted') toast('Notifications on'); }
  return (<>
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <label style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
        <Avatar name={p?.username || user.email} src={p?.avatar_url} size={96} />
        <span className="btn sm" style={{ position: 'absolute', right: -10, bottom: -4, padding: 8 }}><Camera size={14} /></span>
        <input type="file" accept="image/*" hidden onChange={photo} /></label>
      <h1 style={{ marginBottom: 2 }}>@{p?.username || user.email.split('@')[0]}</h1>
      <div className="muted">{user.email}{p && ` · member since ${p.created_at.slice(0, 4)}`}</div></div>
    <div className="card"><b>My watchlist</b><p className="muted" style={{ margin: '2px 0 10px' }}>Friends can see this on your profile. Set a status on any title page, or use the menu under a poster.</p>
      <WatchLists userId={user.id} editable /></div>
    <div className="card"><b>Find a friend</b>
      <div style={{ position: 'relative', marginTop: 8 }}><Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
        <input style={{ paddingLeft: 38 }} placeholder="Search by username" value={q} onChange={e => setQ(e.target.value)} /></div>
      {found?.length === 0 && <p className="muted">Nobody found with that name.</p>}
      {found?.map(f => <Link key={f.id} href={`/u/${f.id}`} className="row" style={{ margin: '10px 0', flexWrap: 'nowrap' }}><Avatar name={f.username} src={f.avatar_url} size={34} /><b>@{f.username}</b></Link>)}</div>
    <div className="card"><div className="row sp"><b><Bell size={15} style={{ verticalAlign: -2 }} /> Chat notifications</b>
      {perm === 'default' && <button className="btn sm" onClick={enableNotes}>Turn on</button>}
      {perm === 'granted' && <span className="pill completed">On</span>}</div>
      <p className="muted" style={{ marginBottom: 0 }}>{perm === 'denied' ? 'Blocked in your browser settings. Allow notifications for this site to turn them on.'
        : perm === 'unsupported' ? 'This browser does not support notifications. On iPhone, add the app to your Home Screen first.'
        : 'Get an alert when someone writes in one of your groups. Unread counts always show on the Groups tab.'}</p></div>
    <form className="card" onSubmit={change}><b>Change password</b>
      <Field label="New password" type="password" minLength={6} value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="btn sec">Update password</button></form>
    <button className="btn bad" style={{ width: '100%' }} onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Sign out</button>
  </>);
}