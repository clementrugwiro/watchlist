'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Camera } from 'lucide-react';
import Shell from '../../components/Shell';
import { Avatar, Field } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { act, uploadImage, removeImage } from '../../lib/util';
export default function Page() { return <Shell>{u => <Profile user={u} />}</Shell>; }
function Profile({ user }) {
  const [p, setP] = useState(null); const [pw, setPw] = useState(''); const [dn, setDn] = useState(null);
  const load = () => supabase.from('profiles').select('username,avatar_url,created_at').eq('id', user.id).maybeSingle().then(({ data }) => setP(data));
  useEffect(() => {
    load();
    supabase.from('user_media').select('completed_at,media(id,title,poster_url)').order('completed_at', { ascending: false }).then(({ data }) => setDn((data || []).filter(x => x.media)));
  }, []);
  async function photo(e) {
    const file = e.target.files[0]; if (!file) return;
    const url = await uploadImage('avatars', user.id, file, 256); if (!url) return;
    if (await act(supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id), 'Photo updated')) { removeImage('avatars', p?.avatar_url); load(); }
  }
  async function change(e) { e.preventDefault(); if (await act(supabase.auth.updateUser({ password: pw }), 'Password changed')) setPw(''); }
  return (<>
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <label style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
        <Avatar name={p?.username || user.email} src={p?.avatar_url} size={96} />
        <span className="btn sm" style={{ position: 'absolute', right: -10, bottom: -4, padding: 8 }}><Camera size={14} /></span>
        <input type="file" accept="image/*" hidden onChange={photo} /></label>
      <h1 style={{ marginBottom: 2 }}>@{p?.username || user.email.split('@')[0]}</h1>
      <div className="muted">{user.email}{p && ` · member since ${p.created_at.slice(0, 4)}`}</div></div>
    <div className="card"><b>Completed{dn ? ` (${dn.length})` : ''}</b>
      {dn?.length === 0 && <p className="muted">Nothing yet. Finish a title in a group, or tap Mark completed on a title page.</p>}
      {dn?.map(({ media: m, completed_at }) => (
        <Link key={m.id} href={`/m/${m.id}`} className="row sp" style={{ margin: '10px 0' }}>
          <span className="row" style={{ flexWrap: 'nowrap' }}><div className="pc" style={{ width: 36 }}><div className="im" style={{ borderRadius: 6, fontSize: 14 }}>{m.poster_url ? <img src={m.poster_url} alt="" /> : m.title[0]}</div></div><b>{m.title}</b></span>
          <span className="muted">{completed_at.slice(0, 10)}</span></Link>))}</div>
    <form className="card" onSubmit={change}><b>Change password</b>
      <Field label="New password" type="password" minLength={6} value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="btn sec">Update password</button></form>
    <button className="btn bad" style={{ width: '100%' }} onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Sign out</button>
  </>);
}
