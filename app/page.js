'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import Shell from '../components/Shell';
import { Avatar, Pill, Sheet, Field, Empty } from '../components/ui';
import { supabase } from '../lib/supabase';
import { act } from '../lib/util';
export default function Page() { return <Shell>{u => <Groups user={u} />}</Shell>; }
function Groups({ user }) {
  const [rows, setRows] = useState(null); const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [type, setType] = useState('anime');
  async function load() {
    const { data } = await supabase.from('group_members')
      .select('color,groups(id,name,media_type,group_members(color,profiles(username,avatar_url)),group_media(count))').eq('user_id', user.id);
    setRows((data || []).filter(r => r.groups));
  }
  useEffect(() => { load(); }, []);
  async function create(e) {
    e.preventDefault();
    if (await act(supabase.from('groups').insert({ name: name.trim(), created_by: user.id, media_type: type }), 'Group created')) { setName(''); setOpen(false); load(); }
  }
  return (<>
    <div className="row sp"><h1>Your groups</h1><button className="btn sm" onClick={() => setOpen(true)}><Plus size={16} /> New group</button></div>
    {rows === null ? <div className="sk" /> : rows.length === 0
      ? <Empty icon={<Users size={44} />} text="No groups yet. Create one and invite up to 3 friends." />
      : rows.map(({ color, groups: g }) => (
        <Link key={g.id} href={`/g/${g.id}`} className="card gcard" style={{ '--c': color }}>
          <div className="row sp"><b style={{ fontSize: 17 }}>{g.name} <Pill s={g.media_type} /></b><span className="muted">{g.group_members.length} / 4 members</span></div>
          <div className="row sp" style={{ marginTop: 10 }}>
            <span className="stack">{g.group_members.map((m, i) => <Avatar key={i} name={m.profiles?.username} src={m.profiles?.avatar_url} color={m.color} />)}</span>
            <span className="muted">{g.group_media[0]?.count || 0} titles</span></div>
        </Link>))}
    {open && <Sheet title="New group" onClose={() => setOpen(false)}>
      <form onSubmit={create}><Field label="Group name" value={name} onChange={e => setName(e.target.value)} placeholder="Anime Squad" required autoFocus />
        <label className="fld"><span>Content type (one per group, cannot be mixed)</span><select value={type} onChange={e => setType(e.target.value)}>{['movie', 'series', 'cartoon', 'anime'].map(t => <option key={t}>{t}</option>)}</select></label>
        <button className="btn" style={{ width: '100%' }}>Create group</button></form></Sheet>}
  </>);
}
