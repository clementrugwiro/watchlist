'use client';
import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { act, MEDIA_TYPES, SITE_LANGS } from '../lib/util';
import { Field, Pill, Sheet } from './ui';

const blank = { name: '', url: '', language: 'both', kinds: ['anime', 'movie', 'series'] };

export default function WatchSites({ suggestFor }) {
  const [rows, setRows] = useState(null); const [edit, setEdit] = useState(null);
  const load = () => supabase.from('watch_sites').select('*').order('name').then(({ data, error }) => setRows(error ? [] : (data || [])));
  useEffect(() => { load(); }, []);
  const shown = suggestFor ? (rows || []).filter(s => (s.kinds || []).includes(suggestFor)) : (rows || []);
  const save = async e => {
    e.preventDefault();
    const f = { name: edit.name.trim(), url: edit.url.trim(), language: edit.language, kinds: edit.kinds, updated_at: new Date().toISOString() };
    if (!f.name || !f.url || !f.kinds.length) return;
    if (!/^https?:\/\//i.test(f.url)) f.url = 'https://' + f.url;
    const q = edit.id
      ? supabase.from('watch_sites').update(f).eq('id', edit.id)
      : supabase.from('watch_sites').insert({ ...f, created_by: (await supabase.auth.getUser()).data.user?.id });
    if (await act(q, edit.id ? 'Site updated' : 'Site added')) { setEdit(null); load(); }
  };
  const del = async id => { if (confirm('Remove this site from the list?') && await act(supabase.from('watch_sites').delete().eq('id', id), 'Site removed')) load(); };
  const tog = t => setEdit({ ...edit, kinds: edit.kinds.includes(t) ? edit.kinds.filter(x => x !== t) : [...edit.kinds, t] });

  return (<>
    <div className="row sp"><b>{suggestFor ? 'Where to watch' : 'Watch sites'}</b>
      <button className="btn sm sec" onClick={() => setEdit(blank)}><Plus size={14} /> Add site</button></div>
    {suggestFor && <p className="muted" style={{ margin: '4px 0 8px' }}>Suggestions for this {suggestFor}. Add more sites anytime from your profile.</p>}
    {!suggestFor && <p className="muted" style={{ margin: '4px 0 8px' }}>Shared list for the group. Mark whether a site is in French, English, or both.</p>}
    {rows === null ? <div className="sk" style={{ height: 60 }} /> : shown.length === 0
      ? <p className="muted">No sites yet for this type. Tap Add site.</p>
      : shown.map(s => (
        <div key={s.id} className="row sp" style={{ margin: '10px 0', flexWrap: 'nowrap' }}>
          <div style={{ minWidth: 0 }}>
            <a href={s.url} target="_blank" rel="noopener noreferrer"><b>{s.name}</b> <ExternalLink size={12} style={{ verticalAlign: -1 }} /></a>
            <div className="row" style={{ gap: 4, marginTop: 4 }}><Pill s={s.language} />{(s.kinds || []).map(k => <Pill key={k} s={k} />)}</div>
            <div className="muted">{s.url.replace(/^https?:\/\//, '')}</div></div>
          <span className="row" style={{ flex: 'none' }}>
            <button className="ib" aria-label="Edit site" onClick={() => setEdit({ ...s, kinds: s.kinds || [] })}><Pencil size={16} /></button>
            <button className="ib" aria-label="Remove site" onClick={() => del(s.id)}><Trash2 size={16} /></button></span></div>))}
    {edit && <Sheet title={edit.id ? 'Edit site' : 'Add a watch site'} onClose={() => setEdit(null)}>
      <form onSubmit={save}>
        <Field label="Name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Crunchyroll" required autoFocus />
        <Field label="URL" value={edit.url} onChange={e => setEdit({ ...edit, url: e.target.value })} placeholder="https://" required />
        <label className="fld"><span>Audio / subtitles</span>
          <select value={edit.language} onChange={e => setEdit({ ...edit, language: e.target.value })}>
            {SITE_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <span className="fld"><span>Good for</span>
          <div className="chips">{MEDIA_TYPES.map(t =>
            <button type="button" key={t} className={`chip ${edit.kinds.includes(t) ? 'on' : ''}`} onClick={() => tog(t)}>{t}</button>)}</div></span>
        <button className="btn" style={{ width: '100%' }} disabled={!edit.kinds.length}>{edit.id ? 'Save changes' : 'Add site'}</button></form></Sheet>}
  </>);
}
