'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2, Pencil, RefreshCw } from 'lucide-react';
import Shell from '../../../components/Shell';
import { Stars, Pill, Sheet, Field } from '../../../components/ui';
import { syncMedia } from '../../../lib/anilist';
import { syncTmdb } from '../../../lib/tmdb';
import { supabase } from '../../../lib/supabase';
import { avg, act, sortEps, lab, removeImage, uploadImage, toast, SECTIONS, LIST_STATUS } from '../../../lib/util';
export default function Page() { return <Shell>{u => <Media user={u} />}</Shell>; }
function Media({ user }) {
  const { id } = useParams(); const router = useRouter();
  const [m, setM] = useState(null); const [mine, setMine] = useState([]); const [inG, setInG] = useState([]);
  const [gid, setGid] = useState(''); const [ep, setEp] = useState({ season: 1, count: 1 });
  const [wl, setWl] = useState(''); const [edit, setEdit] = useState(null); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from('media').select('*, ratings(user_id,rating), episodes(*)').eq('id', id).single(),
      supabase.from('group_members').select('groups(id,name,media_type)').eq('user_id', user.id),
      supabase.from('group_media').select('group_id,status').eq('media_id', id),
      supabase.from('watchlist').select('status').eq('media_id', id).eq('user_id', user.id).maybeSingle()]);
    setM(a.data); setMine((b.data || []).map(x => x.groups).filter(Boolean)); setInG(c.data || []); setWl(d.data?.status || '');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!m) return <div className="sk" />;
  const a = avg(m.ratings); const myRating = m.ratings.find(r => r.user_id === user.id)?.rating || 0;
  const eps = sortEps(m.episodes); const free = mine.filter(g => g.media_type === m.media_type && !inG.some(x => x.group_id === g.id));
  const isMine = m.created_by === user.id; const canEdit = isMine || inG.length > 0;
  const run = async (p, ok) => { await act(p, ok); load(); };
  const rate = n => run(supabase.from('ratings').upsert({ user_id: user.id, media_id: id, rating: n, updated_at: new Date().toISOString() }, { onConflict: 'user_id,media_id' }), 'Rating saved');
  const addEps = () => {
    const start = Math.max(0, ...eps.filter(e => e.season_number === +ep.season).map(e => e.episode_number));
    return run(supabase.from('episodes').insert(Array.from({ length: +ep.count }, (_, i) => ({ media_id: id, season_number: +ep.season, episode_number: start + i + 1 }))), 'Episodes added');
  };
  const setList = v => run(v === '' ? supabase.from('watchlist').delete().eq('media_id', id).eq('user_id', user.id)
    : supabase.from('watchlist').upsert({ user_id: user.id, media_id: id, status: v, updated_at: new Date().toISOString() }, { onConflict: 'user_id,media_id' }),
    v === '' ? 'Removed from your list' : `Saved to your list as ${v}`);
  const ed = k => e => setEdit({ ...edit, [k]: e.target.value });
  const startEdit = () => { setFile(null); setEdit({ title: m.title, media_type: m.media_type, genre: (m.genre || []).join(', '), release_date: m.release_date || '', poster_url: m.poster_url || '', description: m.description || '', mal_id: m.mal_id || '', tmdb_id: m.tmdb_id || '' }); };
  async function saveEdit(e) {
    e.preventDefault(); setBusy(true);
    let poster = edit.poster_url.trim() || null;
    if (file) { poster = await uploadImage('posters', user.id, file, 600); if (!poster) return setBusy(false); }
    const { data, error } = await supabase.from('media').update({ title: edit.title.trim(), media_type: edit.media_type,
      genre: edit.genre.split(',').map(s => s.trim()).filter(Boolean), release_date: edit.release_date || null, poster_url: poster,
      description: edit.description.trim() || null, mal_id: edit.mal_id ? +edit.mal_id : null, tmdb_id: edit.tmdb_id ? +edit.tmdb_id : null }).eq('id', id).select('id');
    setBusy(false);
    if (error) return toast(error.message, true);
    if (!data?.length) return toast('You cannot edit this title', true);
    if (poster !== m.poster_url) removeImage('posters', m.poster_url);
    toast('Saved'); setEdit(null); load();
  }
  async function doSync() {
    setBusy(true);
    try {
      const r = await (m.media_type === 'anime' ? syncMedia : syncTmdb)(m, m.episodes);
      toast(r.status === 'review' ? `No confident match on ${m.media_type === 'anime' ? 'AniList. Add the MAL ID' : 'TMDB. Add the TMDB ID'} in Edit.` : r.status === 'denied' ? 'You cannot edit this title'
        : r.status === 'error' ? r.msg : r.added ? `Added ${r.added} new episodes` : 'Already up to date', r.status === 'error');
    } catch (e) { toast(e.message, true); }
    setBusy(false); load();
  }
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
    <div className="card"><div className="row sp"><b>My list</b>{wl && <Pill s={wl} />}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <select value={wl} onChange={e => setList(e.target.value)}><option value="">Not in my list</option>
          {LIST_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <p className="muted" style={{ marginBottom: 0 }}>Shows on your profile under {SECTIONS.find(s => s[0] === m.media_type)?.[1] || 'your lists'}.</p></div>
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
    {canEdit && <div className="row"><button className="btn sec" onClick={startEdit}><Pencil size={16} /> Edit</button>
      {['anime', 'movie', 'series'].includes(m.media_type) && <button className="btn sec" disabled={busy} onClick={doSync}><RefreshCw size={16} /> {busy ? 'Working...' : m.media_type === 'movie' ? 'Refresh details' : 'Sync episodes'}</button>}</div>}
    {isMine && <button className="btn bad" onClick={del}><Trash2 size={16} /> Delete media</button>}
    {edit && <Sheet title="Edit media" onClose={() => setEdit(null)}>
      <form onSubmit={saveEdit}>
        <Field label="Title" value={edit.title} onChange={ed('title')} required />
        <label className="fld"><span>Type{inG.length > 0 && ' (locked while in a group)'}</span>
          <select disabled={inG.length > 0} value={edit.media_type} onChange={ed('media_type')}>{['movie', 'series', 'cartoon', 'anime'].map(t => <option key={t}>{t}</option>)}</select></label>
        <Field label="Genres (comma separated)" value={edit.genre} onChange={ed('genre')} />
        <Field label="Release date" type="date" value={edit.release_date} onChange={ed('release_date')} />
        <Field label="Poster image URL" value={edit.poster_url} onChange={ed('poster_url')} />
        <label className="fld"><span>Or upload a new poster</span><input type="file" accept="image/*" onChange={e => setFile(e.target.files[0] || null)} /></label>
        {edit.media_type === 'anime' && <Field label="MyAnimeList ID (optional, used for syncing)" type="number" min="1" value={edit.mal_id} onChange={ed('mal_id')} />}
        {(edit.media_type === 'movie' || edit.media_type === 'series') && <Field label="TMDB ID (optional, used for syncing)" type="number" min="1" value={edit.tmdb_id} onChange={ed('tmdb_id')} />}
        <label className="fld"><span>Description</span><textarea rows={4} value={edit.description} onChange={ed('description')} /></label>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button></form></Sheet>}
  </>);
}