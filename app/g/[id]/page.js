'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Users, SkipForward, Check, Film, ListChecks } from 'lucide-react';
import Shell from '../../../components/Shell';
import { Avatar, Pill, Sheet, Empty } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { act, toast, sortEps, lab } from '../../../lib/util';
const COLORS = ['#6366F1', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
const PS = [['not_started', 'Planned'], ['watching', 'Watching'], ['completed', 'Completed'], ['dropped', 'Dropped']];
export default function Page() { return <Shell>{u => <Group user={u} />}</Shell>; }
function Group({ user }) {
  const { id } = useParams(); const router = useRouter();
  const [g, setG] = useState(null); const [mem, setMem] = useState([]); const [gm, setGm] = useState([]);
  const [prog, setProg] = useState([]); const [cat, setCat] = useState([]);
  const [pick, setPick] = useState(''); const [uname, setUname] = useState('');
  const [mo, setMo] = useState(false); const [lst, setLst] = useState(null); const [ex, setEx] = useState(null); const [nEp, setNEp] = useState('');
  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('groups').select('name,created_by,media_type').eq('id', id).single(),
      supabase.from('group_members').select('user_id,color,profiles(username,avatar_url)').eq('group_id', id),
      supabase.from('group_media').select('media(id,title,poster_url,episodes(id,season_number,episode_number))').eq('group_id', id),
      supabase.from('watch_progress').select('*').eq('group_id', id),
      supabase.from('media').select('id,title,media_type').order('title')]);
    setG(a.data); setMem(b.data || []); setGm(c.data || []); setProg(d.data || []); setCat(e.data || []);
    const me = (b.data || []).find(x => x.user_id === user.id);
    if (me) document.documentElement.style.setProperty('--accent', me.color);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!g) return <div className="sk" />;
  const owner = g.created_by === user.id; const me = mem.find(m => m.user_id === user.id);
  const run = async (p, ok) => { await act(p, ok); load(); };
  const pOf = (uid, mid) => prog.find(p => p.user_id === uid && p.media_id === mid);
  const st = mid => pOf(user.id, mid)?.status || 'not_started';
  const mine = s => gm.filter(x => st(x.media.id) === s);
  const RANK = { watching: 0, not_started: 1, dropped: 2, completed: 3 };
  const byMine = (a, b) => RANK[st(a.media.id)] - RANK[st(b.media.id)]
    || new Date(pOf(user.id, b.media.id)?.watched_at || 0) - new Date(pOf(user.id, a.media.id)?.watched_at || 0);
  const avail = cat.filter(c => c.media_type === g.media_type && !gm.some(x => x.media.id === c.id));
  const setP = (mid, patch) => {
    const cur = pOf(user.id, mid) || { status: 'not_started', episode_id: null };
    return run(supabase.from('watch_progress').upsert({ group_id: id, user_id: user.id, media_id: mid, episode_id: cur.episode_id, status: cur.status, ...patch, watched_at: new Date().toISOString() }, { onConflict: 'group_id,user_id,media_id' }));
  };
  const tick = (m, eps, i, idx) => {
    if (i < idx) return setP(m.id, i === 0 ? { episode_id: null, status: 'not_started' } : { episode_id: eps[i - 1].id, status: 'watching' });
    setP(m.id, { episode_id: eps[i].id, status: i === eps.length - 1 ? 'completed' : 'watching' });
  };
  const next = (m, eps, idx) => {
    if (!eps.length) return setP(m.id, { status: 'completed' });
    if (idx >= eps.length) return toast('Already at the last episode');
    setP(m.id, { episode_id: eps[idx].id, status: idx === eps.length - 1 ? 'completed' : 'watching' });
  };
  const addEps = async (m, eps) => {
    const n = Math.min(+nEp || 0, 500); if (n < 1) return toast('Enter how many episodes to add', true);
    const last = eps[eps.length - 1]; const season = last ? last.season_number : 1; const start = last ? last.episode_number : 0;
    await run(supabase.from('episodes').insert(Array.from({ length: n }, (_, i) => ({ media_id: m.id, season_number: season, episode_number: start + i + 1 }))), 'Episodes added');
    setNEp('');
  };
  async function addMember(e) {
    e.preventDefault();
    const { data: p } = await supabase.from('profiles').select('id').eq('username', uname.trim()).maybeSingle();
    if (!p) return toast('No user with that username', true);
    setUname(''); run(supabase.from('group_members').insert({ group_id: id, user_id: p.id }), 'Member added');
  }
  const leave = async () => { if (await act(supabase.from('group_members').delete().eq('group_id', id).eq('user_id', user.id))) router.push('/'); };
  const delGroup = async () => { if (confirm('Delete this group?') && await act(supabase.from('groups').delete().eq('id', id), 'Group deleted')) router.push('/'); };
  return (<>
    <Link href="/" className="muted"><ChevronLeft size={14} style={{ verticalAlign: -2 }} />Groups</Link>
    <div className="hero" style={{ background: `linear-gradient(135deg, ${me?.color || '#6366F1'}, #111827)` }}>
      <div className="row sp"><h1 style={{ margin: 0 }}>{g.name}</h1>
        <button className="btn sm" style={{ background: '#fff3' }} onClick={() => setMo(true)}><Users size={15} /> {mem.length} / 4</button></div>
      <div className="row" style={{ margin: '10px 0' }}><span className="stack">{mem.map(m => <Avatar key={m.user_id} name={m.profiles?.username} src={m.profiles?.avatar_url} color={m.color} size={34} />)}</span><Pill s={g.media_type} /></div>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>{PS.map(([s, l]) =>
        <button key={s} className="stat" onClick={() => setLst(s)}><b>{mine(s).length}</b><span style={{ fontSize: 11 }}>{l}</span></button>)}</div>
      <div style={{ fontSize: 12, opacity: .8, marginTop: 6 }}>My {g.media_type} titles. Tap a number to see the list.</div></div>
    <div className="row"><select value={pick} onChange={e => setPick(e.target.value)}>
      <option value="">{avail.length ? `Add a ${g.media_type} title...` : `No more ${g.media_type} titles. Create one in Discover.`}</option>
      {avail.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
      <button className="btn" disabled={!pick} onClick={async () => { await run(supabase.from('group_media').insert({ group_id: id, media_id: pick, added_by: user.id }), 'Added'); setPick(''); }}><Plus size={16} /> Add</button></div>
    {gm.length === 0 && <Empty icon={<Film size={44} />} text="No titles yet. Add one from the list above." />}
    {[...gm].sort(byMine).map(({ media: m }) => {
      const eps = sortEps(m.episodes); const my = pOf(user.id, m.id) || { status: 'not_started', episode_id: null };
      const myIdx = eps.findIndex(z => z.id === my.episode_id) + 1;
      return (<div className="card" key={m.id}>
        <Link href={`/m/${m.id}`} className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="pc" style={{ width: 44 }}><div className="im" style={{ borderRadius: 8, fontSize: 18 }}>{m.poster_url ? <img src={m.poster_url} alt="" /> : m.title[0]}</div></div><b>{m.title}</b></Link>
        {mem.map(x => {
          const p = pOf(x.user_id, m.id); const idx = eps.findIndex(z => z.id === p?.episode_id) + 1;
          const pct = p?.status === 'completed' ? 100 : eps.length ? idx / eps.length * 100 : 0;
          return (<div key={x.user_id} className="row" style={{ flexWrap: 'nowrap', margin: '10px 0 0' }}>
            <Avatar name={x.profiles?.username} src={x.profiles?.avatar_url} color={x.color} size={26} />
            <div style={{ flex: 1 }}><div className="row sp muted"><span>{x.user_id === user.id ? 'You' : x.profiles?.username}{idx > 0 && ` · ${lab(eps[idx - 1])}`}</span><Pill s={p?.status || 'not_started'} /></div>
              <div className="bar"><i style={{ width: pct + '%', background: x.color }} /></div></div></div>);
        })}
        <div className="row" style={{ marginTop: 12 }}>
          <select value={my.status} onChange={e => setP(m.id, { status: e.target.value })}>{PS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button className="btn sec sm" onClick={() => next(m, eps, myIdx)}>{eps.length ? <><SkipForward size={14} /> Next ep</> : <><Check size={14} /> Watched</>}</button>
          <button className="btn sec sm" onClick={() => setEx(ex === m.id ? null : m.id)}><ListChecks size={14} /> Episodes {myIdx}/{eps.length}</button>
          <button className="btn bad sm" onClick={() => run(supabase.from('group_media').delete().eq('group_id', id).eq('media_id', m.id), 'Removed')}>Remove</button></div>
        {ex === m.id && <><div className="row" style={{ marginTop: 10 }}>
          <input type="number" min="1" placeholder="New episodes to add" value={nEp} onChange={e => setNEp(e.target.value)} />
          <button className="btn sm" onClick={() => addEps(m, eps)}><Plus size={14} /> Add episodes</button></div>
          <p className="muted" style={{ marginBottom: 0 }}>Tick the last episode you watched. Earlier ones count as watched too.</p>
          <div className="eps">{eps.map((e, i) => <label key={e.id} className={`ep ${i < myIdx ? 'done' : ''}`}>
            <input type="checkbox" checked={i < myIdx} onChange={() => tick(m, eps, i, myIdx)} />{lab(e)}</label>)}</div></>}
      </div>);
    })}
    {lst && <Sheet title={`My ${PS.find(p => p[0] === lst)[1].toLowerCase()} ${g.media_type} titles (${mine(lst).length})`} onClose={() => setLst(null)}>
      {mine(lst).length === 0 && <Empty icon={<Film size={36} />} text="Nothing here yet." />}
      {mine(lst).map(({ media: m }) => {
        const eps = sortEps(m.episodes); const i = eps.findIndex(z => z.id === pOf(user.id, m.id)?.episode_id);
        return <Link key={m.id} href={`/m/${m.id}`} className="row sp" style={{ margin: '12px 0' }}><b>{m.title}</b><span className="muted">{i >= 0 ? lab(eps[i]) : ''}</span></Link>;
      })}</Sheet>}
    {mo && <Sheet title={`Members ${mem.length} / 4`} onClose={() => setMo(false)}>
      {mem.map(x => (<div key={x.user_id} className="row sp" style={{ margin: '10px 0' }}>
        <span className="row"><Avatar name={x.profiles?.username} src={x.profiles?.avatar_url} color={x.color} />@{x.profiles?.username}{x.user_id === g.created_by && <Pill s="watching" />}</span>
        {owner && x.user_id !== user.id && <button className="btn bad sm" onClick={() => run(supabase.from('group_members').delete().eq('group_id', id).eq('user_id', x.user_id), 'Member removed')}>Remove</button>}</div>))}
      {owner && <form onSubmit={addMember} className="row"><input placeholder="Friend's username" value={uname} onChange={e => setUname(e.target.value)} required />
        <button className="btn" disabled={mem.length >= 4}>{mem.length >= 4 ? 'Group full' : '+ Add member'}</button></form>}
      <p className="muted">My color in this group</p>
      <div className="row">{COLORS.map(c => <button key={c} aria-label={c} onClick={() => run(supabase.from('group_members').update({ color: c }).eq('group_id', id).eq('user_id', user.id))}
        style={{ background: c, width: 34, height: 34, borderRadius: '50%', border: 0, cursor: 'pointer', outline: me?.color === c ? '3px solid var(--fg)' : 'none', outlineOffset: 2 }} />)}</div>
      <div style={{ marginTop: 18 }}>{owner ? <button className="btn bad" onClick={delGroup}>Delete group</button> : <button className="btn bad" onClick={leave}>Leave group</button>}</div>
    </Sheet>}
  </>);
}
