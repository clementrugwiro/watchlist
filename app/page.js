'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users, MessageCircle, Sparkles } from 'lucide-react';
import Shell from '../components/Shell';
import { Avatar, Pill, Sheet, Field, Empty } from '../components/ui';
import { supabase } from '../lib/supabase';
import { act } from '../lib/util';
import { useNotify } from '../components/Notify';
export default function Page() { return <Shell>{u => <Groups user={u} />}</Shell>; }
function Groups({ user }) {
  const { unread } = useNotify();
  const [rows, setRows] = useState(null); const [open, setOpen] = useState(false); const [name, setName] = useState('');
  async function load() {
    const { data } = await supabase.from('group_members')
      .select('color,groups(id,name,is_personal,group_members(color,profiles(username,avatar_url)),group_media(count))').eq('user_id', user.id);
    setRows((data || []).filter(r => r.groups).sort((a, b) => (b.groups.is_personal ? 1 : 0) - (a.groups.is_personal ? 1 : 0))); // personal space first
  }
  useEffect(() => { load(); }, []);
  async function create(e) {
    e.preventDefault();
    if (await act(supabase.from('groups').insert({ name: name.trim(), created_by: user.id }), 'Group created')) { setName(''); setOpen(false); load(); }
  }
  return (<>
    <div className="row sp"><h1>Your groups</h1><button className="btn sm" onClick={() => setOpen(true)}><Plus size={16} /> New group</button></div>
    {rows === null ? <div className="sk" /> : rows.length === 0
      ? <Empty icon={<Users size={44} />} text="No groups yet. Create one and invite up to 3 friends." />
      : rows.map(({ color, groups: g }) => (
        <Link key={g.id} href={`/g/${g.id}`} className={`card gcard ${g.is_personal ? 'me' : ''}`} style={{ '--c': color }}>
          <div className="row sp"><b style={{ fontSize: 17 }}>{g.is_personal && <Sparkles size={16} style={{ verticalAlign: -2, marginRight: 6 }} />}{g.name}{unread[g.id] > 0 && <span className="dot inl" title="Unread messages"><MessageCircle size={11} />&nbsp;{unread[g.id]}</span>}</b>
            {g.is_personal ? <span className="pill watching">Personal</span> : <span className="muted">{g.group_members.length} / 4 members</span>}</div>
          <div className="row sp" style={{ marginTop: 10 }}>
            {g.is_personal ? <span className="muted">Only you. What you are watching.</span>
              : <span className="stack">{g.group_members.map((m, i) => <Avatar key={i} name={m.profiles?.username} src={m.profiles?.avatar_url} color={m.color} />)}</span>}
            <span className="muted">{g.group_media[0]?.count || 0} titles</span></div>
        </Link>))}
    {open && <Sheet title="New group" onClose={() => setOpen(false)}>
      <form onSubmit={create}><Field label="Group name" value={name} onChange={e => setName(e.target.value)} placeholder="Anime Squad" required autoFocus />
        <button className="btn" style={{ width: '100%' }}>Create group</button></form></Sheet>}
  </>);
}