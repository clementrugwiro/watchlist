'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Shell from '../../../components/Shell';
import { Avatar, Empty } from '../../../components/ui';
import WatchLists from '../../../components/WatchLists';
import { supabase } from '../../../lib/supabase';
export default function Page() { return <Shell>{u => <Person user={u} />}</Shell>; }
function Person({ user }) {
  const { id } = useParams(); const router = useRouter(); const [p, setP] = useState(undefined);
  useEffect(() => {
    if (id === user.id) { router.replace('/profile'); return; } // your own profile lives on the Profile tab
    supabase.from('profiles').select('username,avatar_url,created_at').eq('id', id).maybeSingle().then(({ data }) => setP(data || null));
  }, [id]);
  if (id === user.id || p === undefined) return <div className="sk" />;
  return (<>
    <a className="muted" style={{ cursor: 'pointer' }} onClick={() => router.back()}><ChevronLeft size={14} style={{ verticalAlign: -2 }} />Back</a>
    {p === null ? <Empty text="This person does not exist." /> : <>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Avatar name={p.username} src={p.avatar_url} size={96} />
        <h1 style={{ marginBottom: 2 }}>@{p.username}</h1>
        <div className="muted">Member since {p.created_at.slice(0, 4)}</div></div>
      <div className="card"><b>{p.username}'s watchlist</b><div style={{ height: 8 }} /><WatchLists userId={id} /></div></>}
  </>);
}