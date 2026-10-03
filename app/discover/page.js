'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Star, Film, Upload } from 'lucide-react';
import Shell from '../../components/Shell';
import { Sheet, Field, Empty } from '../../components/ui';
import ImportSheet from '../../components/Import';
import { supabase } from '../../lib/supabase';
import { avg, act, toast, uploadImage, IMPORT_EMAIL } from '../../lib/util';
const TYPES = ['movie', 'series', 'cartoon', 'anime'];
const blank = { title: '', media_type: 'anime', genre: '', release_date: '', poster_url: '', description: '', episodes: '' };
export default function Page() { return <Shell>{u => <Discover user={u} />}</Shell>; }
function Discover({ user }) {
  const [items, setItems] = useState(null); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [genre, setGenre] = useState('');
  const [open, setOpen] = useState(false); const [f, setF] = useState(blank); const [imp, setImp] = useState(false); const [file, setFile] = useState(null);
  const load = async () => {
    const { data } = await supabase.from('media').select('*, ratings(rating)').order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function add(e) {
    e.preventDefault();
    let poster = f.poster_url.trim() || null;
    if (file) { poster = await uploadImage('posters', user.id, file, 600); if (!poster) return; }
    const { data, error } = await supabase.from('media').insert({
      created_by: user.id, title: f.title.trim(), media_type: f.media_type,
      genre: f.genre.split(',').map(s => s.trim()).filter(Boolean),
      release_date: f.release_date || null, poster_url: poster, description: f.description.trim() || null }).select('id').single();
    if (error) return toast(error.message, true);
    const n = Math.min(+f.episodes || 0, 1500);
    if (n > 0) await act(supabase.from('episodes').insert(Array.from({ length: n }, (_, i) => ({ media_id: data.id, season_number: 1, episode_number: i + 1 }))));
    toast('Media added'); setFile(null); setF(blank); setOpen(false); load();
  }
  const genres = [...new Set((items || []).flatMap(i => i.genre || []))];
  const shown = (items || []).filter(i => i.title.toLowerCase().includes(q.toLowerCase())
    && (!type || i.media_type === type) && (!genre || (i.genre || []).includes(genre)));
  return (<>
    <div className="row sp"><h1>Discover</h1>{user.email?.toLowerCase() === IMPORT_EMAIL && <button className="btn sec sm" onClick={() => setImp(true)}><Upload size={15} /> Import CSV / Excel</button>}</div>
    <div style={{ position: 'relative' }}><Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
      <input style={{ paddingLeft: 38 }} placeholder="Search movies, anime, series..." value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="chips" style={{ marginTop: 10 }}>{['', ...TYPES].map(t =>
      <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{t ? t[0].toUpperCase() + t.slice(1) : 'All'}</button>)}</div>
    {genres.length > 0 && <div className="chips">{genres.map(g =>
      <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(genre === g ? '' : g)}>{g}</button>)}</div>}
    {items === null ? <div className="sk" /> : shown.length === 0
      ? <Empty icon={<Film size={44} />} text="Nothing here yet. Tap + to add the first title." />
      : <div className="grid">{shown.map(i => (
        <Link key={i.id} href={`/m/${i.id}`} className="pc">
          <div className="im">{i.poster_url ? <img src={i.poster_url} alt="" /> : i.title[0]}</div>
          <span className="badge"><Star size={11} fill="currentColor" />{avg(i.ratings)}</span>
          <b>{i.title}</b><span className="muted">{i.media_type}{i.release_date && ` · ${i.release_date.slice(0, 4)}`}</span>
        </Link>))}</div>}
    <button className="fab" aria-label="Add media" onClick={() => setOpen(true)}><Plus size={26} /></button>
    {imp && <ImportSheet user={user} existing={items || []} onClose={() => setImp(false)} onDone={() => { setImp(false); load(); }} />}
    {open && <Sheet title="Add media" onClose={() => setOpen(false)}>
      <form onSubmit={add}>
        <Field label="Title" value={f.title} onChange={set('title')} required autoFocus />
        <label className="fld"><span>Type</span><select value={f.media_type} onChange={set('media_type')}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
        <Field label="Genres (comma separated)" placeholder="Action, Fantasy" value={f.genre} onChange={set('genre')} />
        <Field label="Release date" type="date" value={f.release_date} onChange={set('release_date')} />
        <Field label="Number of episodes (leave empty for a movie)" type="number" min="0" value={f.episodes} onChange={set('episodes')} />
        <Field label="Poster image URL (optional)" value={f.poster_url} onChange={set('poster_url')} />
        <label className="fld"><span>Or upload a poster image</span><input type="file" accept="image/*" onChange={e => setFile(e.target.files[0] || null)} /></label>
        <label className="fld"><span>Description</span><textarea rows={3} value={f.description} onChange={set('description')} /></label>
        <button className="btn" style={{ width: '100%' }}>Save media</button></form></Sheet>}
  </>);
}
