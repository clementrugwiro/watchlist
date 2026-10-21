'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink, Pencil, Trash2, ChevronLeft } from 'lucide-react';
import Shell from '../../components/Shell';
import { Sheet, Field } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { act, toast } from '../../lib/util';
import { LANGS, SITE_TYPES, SUGGESTED, siteHost } from '../../lib/sites';
const blank = { name: '', url: '', language: 'both', types: [...SITE_TYPES] };
const langName = l => LANGS.find(x => x[0] === l)?.[1];
export default function Page() { return <Shell>{u => <Sites user={u} />}</Shell>; }
function Sites({ user }) {
  const [rows, setRows] = useState(null); const [f, setF] = useState(null);
  const load = async () => { const { data } = await supabase.from('watch_sites').select('*').order('name'); setRows(data || []); };
  useEffect(() => { load(); }, []);
  async function save(e) {
    e.preventDefault();
    if (!f.types.length) return toast('Pick at least one type', true);
    const url = /^https?:\/\//i.test(f.url.trim()) ? f.url.trim() : 'https://' + f.url.trim();
    const row = { name: f.name.trim(), url, language: f.language, types: f.types };
    if (await act(f.id ? supabase.from('watch_sites').update(row).eq('id', f.id) : supabase.from('watch_sites').insert({ ...row, created_by: user.id }), 'Saved')) { setF(null); load(); }
  }
  const del = async s => { if (confirm(`Remove ${s.name}?`) && await act(supabase.from('watch_sites').delete().eq('id', s.id), 'Removed')) load(); };
  const addSug = async s => { if (await act(supabase.from('watch_sites').insert({ ...s, created_by: user.id }), `${s.name} added`)) load(); };
  const have = new Set((rows || []).map(r => siteHost(r.url)));
  const tog = t => setF({ ...f, types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t] });
  return (<>
    <Link href="/profile" className="muted"><ChevronLeft size={14} style={{ verticalAlign: -2 }} />Profile</Link>
    <div className="row sp"><h1>Where to watch</h1><button className="btn sm" onClick={() => setF({ ...blank })}><Plus size={16} /> Add site</button></div>
    <p className="muted">Your shared list of sites. Each title page shows the ones that match its type.</p>
    {rows?.length === 0 && <p className="muted">No sites yet. Add one, or pick from the suggestions below.</p>}
    {rows?.map(s => (<div key={s.id} className="card">
      <div className="row sp"><b>{s.name}</b><span className="pill">{langName(s.language)}</span></div>
      <div className="muted">{siteHost(s.url)} · {(s.types || []).join(', ')}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <a className="btn sec sm" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open</a>
        <button className="btn sec sm" onClick={() => setF({ ...s })}><Pencil size={14} /> Edit</button>
        {s.created_by === user.id && <button className="btn bad sm" onClick={() => del(s)}><Trash2 size={14} /></button>}</div></div>))}
    <h2 style={{ fontSize: 17, marginTop: 24 }}>Suggested</h2>
    <p className="muted">Legal streaming services. What you can watch depends on your country.</p>
    {SUGGESTED.filter(s => !have.has(siteHost(s.url))).map(s => (<div key={s.url} className="card row sp">
      <span><b>{s.name}</b><div className="muted">{langName(s.language)} · {s.types.join(', ')}</div></span>
      <button className="btn sm" onClick={() => addSug(s)}><Plus size={14} /> Add</button></div>))}
    {f && <Sheet title={f.id ? 'Edit site' : 'Add a site'} onClose={() => setF(null)}>
      <form onSubmit={save}>
        <Field label="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required autoFocus />
        <Field label="Website address" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://..." required />
        <label className="fld"><span>Language</span><select value={f.language} onChange={e => setF({ ...f, language: e.target.value })}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <div className="fld"><span>Good for</span><div className="row">{SITE_TYPES.map(t => <button type="button" key={t} className={`chip ${f.types.includes(t) ? 'on' : ''}`} onClick={() => tog(t)}>{t}</button>)}</div></div>
        <button className="btn" style={{ width: '100%' }}>Save</button></form></Sheet>}
  </>);
}
