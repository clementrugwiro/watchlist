'use client';
import { useState } from 'react';
import Papa from 'papaparse';
import { Sheet } from './ui';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/util';
const TYPES = ['movie', 'series', 'cartoon', 'anime'];
const key = h => String(h).trim().toLowerCase().replace(/\s+/g, '_');
const iso = v => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim(); if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  const d = new Date(s); return s && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
};
function clean(r) {
  const g = k => String(r[k] ?? '').trim();
  return { title: g('title') || g('name'), media_type: (g('type') || g('media_type')).toLowerCase(),
    genre: g('genre').split(/[,;|]/).map(s => s.trim()).filter(Boolean), release_date: iso(r.release_date ?? r.year),
    poster_url: g('poster_url') || null, description: g('description') || null, eps: Math.min(parseInt(g('episodes')) || 0, 1500) };
}
function template() {
  const csv = 'title,type,genre,release_date,episodes,poster_url,description\nOne Piece,anime,"Adventure, Action",1999-10-20,1100,,Pirate adventure\nDune,movie,Sci-Fi,2021-10-22,,,\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'media-template.csv'; a.click();
}
export default function ImportSheet({ user, existing, onClose, onDone }) {
  const [rows, setRows] = useState(null); const [busy, setBusy] = useState(false);
  async function pick(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      let objs;
      if (/\.csv$/i.test(file.name)) objs = await new Promise(res => Papa.parse(file, { header: true, skipEmptyLines: true, transformHeader: key, complete: r => res(r.data) }));
      else { const { default: readXlsx } = await import('read-excel-file'); const [h, ...b] = await readXlsx(file); objs = b.map(r => Object.fromEntries(h.map((k, i) => [key(k), r[i]]))); }
      setRows(objs.slice(0, 1000).map(clean));
    } catch { toast('Could not read that file. Use .csv or .xlsx', true); }
  }
  const seen = new Set(existing.map(i => `${i.title.toLowerCase()}|${i.media_type}`)); const ok = [], bad = [], dup = [];
  (rows || []).forEach(r => {
    const k = `${r.title.toLowerCase()}|${r.media_type}`;
    if (!r.title || !TYPES.includes(r.media_type)) bad.push(r); else if (seen.has(k)) dup.push(r); else { seen.add(k); ok.push(r); }
  });
  async function go() {
    setBusy(true); let n = 0;
    for (let i = 0; i < ok.length; i += 100) {
      const chunk = ok.slice(i, i + 100);
      const { data, error } = await supabase.from('media').insert(chunk.map(({ eps, ...m }) => ({ ...m, created_by: user.id }))).select('id');
      if (error) { toast(error.message, true); break; }
      const eps = chunk.flatMap((c, j) => Array.from({ length: c.eps }, (_, k) => ({ media_id: data[j].id, season_number: 1, episode_number: k + 1 })));
      for (let k = 0; k < eps.length; k += 1000) { const { error: e2 } = await supabase.from('episodes').insert(eps.slice(k, k + 1000)); if (e2) toast(e2.message, true); }
      n += chunk.length;
    }
    setBusy(false); toast(`Imported ${n} titles`); onDone();
  }
  return (
    <Sheet title="Import from CSV or Excel" onClose={onClose}>
      <p className="muted">Columns: title, type (movie / series / cartoon / anime), genre, release_date, episodes, poster_url, description. Only title and type are required. Accepts .csv and .xlsx.</p>
      <button className="btn sec sm" onClick={template}>Download CSV template</button>
      <label className="fld"><span>Choose a file</span><input type="file" accept=".csv,.xlsx" onChange={pick} /></label>
      {rows && <><p><b>{ok.length}</b> ready · {dup.length} already exist · {bad.length} skipped (title and valid type needed)</p>
        <button className="btn" style={{ width: '100%' }} disabled={!ok.length || busy} onClick={go}>{busy ? 'Importing...' : `Import ${ok.length} titles`}</button></>}
    </Sheet>);
}
