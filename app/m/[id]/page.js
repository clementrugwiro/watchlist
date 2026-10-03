'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2 } from 'lucide-react';
import Shell from '../../../components/Shell';
import { Stars, Pill } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { avg, act, sortEps, lab, removeImage } from '../../../lib/util';
export default function Page() { return <Shell>{u => <Media user={u} />}</Shell>; }
function Media({ user }) {
  const { id } = useParams(); const router = useRouter();
  const [m, setM] = useState(null); const [mine, setMine] = useState([]); const [inG, setInG] = useState([]);
  const [gid, setGid] = useState(''); const [ep, setEp] = useState({ season: 1, count: 1 });
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('media').select('*, ratings(user_id,rating), episodes(*)').eq('id', id).single(),
      supabase.from('group_members').select('groups(id,name,media_type)').eq('user_id', user.id),
      supabase.from('group_media').select('group_id,status').eq('media_id', id)]);
    setM(a.data); setMine((b.data || []).map(x => x.groups).filter(Boolean)); setInG(c.data || []);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!m) return <div className="sk" />;
  const a = avg(m.ratings); const myRating = m.ratings.find(r => r.user_id === user.id)?.rating || 0;
  const eps = sortEps(m.episodes); const free = mine.filter(g => g.media_type === m.media_type && !inG.some(x => x.group_id === g.id));
  const isMine = m.created_by === user.id;
  const run = async (p, ok) => { await act(p, ok); load(); };
  const rate = n => run(supabase.from('ratings').upsert({ user_id: user.id, media_id: id, rating: n, updated_at: new Date().toISOString() }, { onConflict: 'user_id,media_id' }), 'Rating saved');
  const addEps = () => {
    const start = Math.max(0, ...eps.filter(e => e.season_number === +ep.season).map(e => e.episode_number));
    return run(supabase.from('episodes').insert(Array.from({ length: +ep.count }, (_, i) => ({ media_id: id, season_number: +ep.season, episode_number: start + i + 1 }))), 'Episodes added');
  };
  async function del() { if (confirm('Delete this media for everyone?') && await act(supabase.from('media').delete().eq('id', id), 'Deleted')) { removeImage('posters', m.poster_url); router.push('/discover'); } }
  return (<>
    <Link href="/discover" className="muted"><ChevronLeft size={14} style={{ verticalAlign: -2 }} />Discover</Link>
    <div className="hero" style={m.poster_url ? { backgroundImage: `url(${m.poster_url})` } : {}}>
      <div className="row" style={{ alignItems: 'flex-end', gap: 16, flexWrap: 'nowrap' }}>
        <div className="pc" style={{ width: 110, flex: 'none' }}><div className="im">{m.poster_url ? <img src={m.poster_url} alt="" /> : m.title[0]}</div></div>
        <div><Pill s={m.media_type} /><h1 style={{ margin: '8px 0 4px' }}>{m.title}</h1>
          <div style={{ opacity: .85 }}>{[...(m.genre || []), m.release_date?.slice(0, 4)].filter(Boolean).join(' · ')}</div>
          <div className="row" style={{ gap: 6 }}><Stars value={a === '–' ? 0 : +a} /><b>{a}</b><span style={{ opacity: .8 }}>({m.ratings.length})</span></div></div>
      </div></div>
    {m.description && <p>{m.description}</p>}
    <div className="card"><b>Your rating</b><div><Stars value={myRating} onChange={rate} /></div></div>
    <div className="card"><b>Groups</b>
      {inG.map(x => <div key={x.group_id} className="row sp" style={{ margin: '8px 0' }}><span>{mine.find(g => g.id === x.group_id)?.name}</span><Pill s={x.status} /></div>)}
      {free.length > 0 && <div className="row" style={{ marginTop: 8 }}>
        <select value={gid} onChange={e => setGid(e.target.value)}><option value="">Add to a group...</option>{free.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <button className="btn sm" disabled={!gid} onClick={() => run(supabase.from('group_media').insert({ group_id: gid, media_id: id, added_by: user.id }), 'Added to group')}>Add</button></div>}
      {free.length === 0 && inG.length === 0 && <p className="muted">No {m.media_type} group yet. Create one on the Groups tab.</p>}</div>
    <div className="card"><b>Episodes</b>
      {eps.length === 0 && <p className="muted">No episodes. Fine for movies.</p>}
      <div className="row" style={{ margin: '8px 0' }}>{eps.map(e => <span key={e.id} className="pill">{lab(e)}</span>)}</div>
      {(isMine || inG.length > 0) && <div className="row"><span className="muted">Season</span><input type="number" min="1" value={ep.season} onChange={e => setEp({ ...ep, season: e.target.value })} />
        <span className="muted">add</span><input type="number" min="1" value={ep.count} onChange={e => setEp({ ...ep, count: e.target.value })} />
        <button className="btn sm" onClick={addEps}>Add episodes</button></div>}</div>
    {isMine && <button className="btn bad" onClick={del}><Trash2 size={16} /> Delete media</button>}
  </>);
}
