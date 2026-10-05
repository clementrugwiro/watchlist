'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sheet } from './ui';
import { supabase } from '../lib/supabase';
import { syncMedia } from '../lib/jikan';
const recent = m => m.synced_at && Date.now() - new Date(m.synced_at) < 6 * 3600e3;            // checked in the last 6 hours
const settled = m => m.mal_id && m.mal_status === 'Finished Airing' && m.synced_at;            // finished shows no longer change
export default function SyncSheet({ onClose, onDone }) {
  const [run, setRun] = useState(false); const [pg, setPg] = useState({ i: 0, n: 0 }); const [res, setRes] = useState(null);
  async function go() {
    setRun(true);
    const { data } = await supabase.from('media')
      .select('id,title,release_date,poster_url,description,genre,mal_id,mal_status,synced_at,episodes(id,season_number,episode_number)')
      .eq('media_type', 'anime').order('title');
    const todo = data.filter(m => !settled(m) && !recent(m));
    const out = { updated: [], ok: data.length - todo.length, review: [], denied: 0, error: [] };
    setPg({ i: 0, n: todo.length }); let fails = 0;
    for (let i = 0; i < todo.length; i++) {
      const m = todo[i]; setPg({ i: i + 1, n: todo.length });
      try {
        const r = await syncMedia(m, m.episodes); fails = 0;
        if (r.status === 'updated') out.updated.push(`${m.title} (+${r.added})`);
        else if (r.status === 'ok') out.ok++;
        else if (r.status === 'review') out.review.push(m);
        else if (r.status === 'denied') out.denied++;
        else out.error.push(`${m.title}: ${r.msg}`);
      } catch (e) { out.error.push(`${m.title}: ${e.message}`); fails++; if (fails >= 3 || /rate limit/i.test(e.message)) break; }
    }
    setRes(out); setRun(false); onDone();
  }
  return (
    <Sheet title="Sync anime from MyAnimeList" onClose={onClose}>
      <p className="muted">The public Jikan API allows about one request per second, so the first run over 100 titles takes a few minutes. After that, finished shows are skipped and only shows still airing (or not matched yet) are checked. Each title is saved as it is done, so if you stop, the next run continues where this one stopped. Nothing is overwritten or removed.</p>
      {!res && <button className="btn" style={{ width: '100%' }} disabled={run} onClick={go}>{run ? `Syncing ${pg.i} / ${pg.n}...` : 'Start sync'}</button>}
      {run && <><div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pg.n ? pg.i / pg.n * 100 : 0}%`, background: 'var(--accent)' }} /></div>
        <p className="muted">About {Math.max(1, Math.ceil((pg.n - pg.i) * 1.4 / 60))} min left</p></>}
      {res && <>
        <p><b>{res.updated.length}</b> updated · {res.ok} up to date or skipped · {res.review.length} need a MAL ID · {res.denied} not editable by you · {res.error.length} errors</p>
        {res.updated.length > 0 && <p className="muted">{res.updated.join(', ')}</p>}
        {res.review.length > 0 && <><b>No confident match. Open each and add its MAL ID in Edit:</b>
          {res.review.map(m => <div key={m.id}><Link href={`/m/${m.id}`}>{m.title}</Link></div>)}</>}
        {res.error.map((e, i) => <p key={i} className="err">{e}</p>)}
      </>}
    </Sheet>);
}
