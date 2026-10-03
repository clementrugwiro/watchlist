'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sheet } from './ui';
import { supabase } from '../lib/supabase';
import { syncMedia } from '../lib/jikan';
export default function SyncSheet({ onClose, onDone }) {
  const [run, setRun] = useState(false); const [pg, setPg] = useState({ i: 0, n: 0 }); const [res, setRes] = useState(null);
  async function go() {
    setRun(true);
    const { data } = await supabase.from('media').select('*, episodes(*)').eq('media_type', 'anime').order('title');
    const out = { updated: [], ok: 0, review: [], denied: 0, error: [] };
    for (let i = 0; i < data.length; i++) {
      const m = data[i]; setPg({ i: i + 1, n: data.length });
      if (m.synced_at && Date.now() - new Date(m.synced_at) < 6 * 3600e3) { out.ok++; continue; } // synced recently
      try {
        const r = await syncMedia(m, m.episodes);
        if (r.status === 'updated') out.updated.push(`${m.title} (+${r.added})`);
        else if (r.status === 'ok') out.ok++;
        else if (r.status === 'review') out.review.push(m);
        else if (r.status === 'denied') out.denied++;
        else out.error.push(`${m.title}: ${r.msg}`);
      } catch (e) { out.error.push(`${m.title}: ${e.message}`); if (/rate limit/i.test(e.message)) break; }
    }
    setRes(out); setRun(false); onDone();
  }
  return (
    <Sheet title="Sync anime from MyAnimeList" onClose={onClose}>
      <p className="muted">Checks every anime against the Jikan API (about one request per second), adds newly aired episodes, and fills empty poster, description, date and genre fields. Nothing is overwritten or removed. Keep this window open until it finishes.</p>
      {!res && <button className="btn" style={{ width: '100%' }} disabled={run} onClick={go}>{run ? `Syncing ${pg.i} / ${pg.n}...` : 'Start sync'}</button>}
      {run && <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pg.n ? pg.i / pg.n * 100 : 0}%`, background: 'var(--accent)' }} /></div>}
      {res && <>
        <p><b>{res.updated.length}</b> updated · {res.ok} up to date · {res.review.length} need a MAL ID · {res.denied} not editable by you · {res.error.length} errors</p>
        {res.updated.length > 0 && <p className="muted">{res.updated.join(', ')}</p>}
        {res.review.length > 0 && <><b>No confident match. Open each and add its MAL ID in Edit:</b>
          {res.review.map(m => <div key={m.id}><Link href={`/m/${m.id}`}>{m.title}</Link></div>)}</>}
        {res.error.map((e, i) => <p key={i} className="err">{e}</p>)}
      </>}
    </Sheet>);
}
