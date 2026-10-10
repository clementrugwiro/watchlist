'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Film } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Empty } from './ui';
import { act, SECTIONS, LIST_STATUS } from '../lib/util';

// Anime / Movies / Series / Cartoons, each split into Planned / Watching / Completed / Dropped.
// Used on your own profile (editable) and on other people's profiles (read only).
export default function WatchLists({ userId, editable = false }) {
  const [rows, setRows] = useState(null); const [stars, setStars] = useState({}); const [sec, setSec] = useState('anime'); const [st, setSt] = useState('watching');
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('watchlist').select('status,updated_at,media(id,title,poster_url,media_type,release_date)').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('ratings').select('media_id,rating').eq('user_id', userId)]);
    setRows((a.data || []).filter(r => r.media));
    setStars(Object.fromEntries((b.data || []).map(r => [r.media_id, r.rating])));
  }, [userId]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const inSec = s => (rows || []).filter(r => r.media.media_type === s);
  const shown = inSec(sec).filter(r => r.status === st);
  const change = async (mid, v) => {
    const q = supabase.from('watchlist');
    const ok = v === '' ? await act(q.delete().eq('user_id', userId).eq('media_id', mid), 'Removed from your list')
      : await act(q.update({ status: v, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('media_id', mid), 'Moved to ' + v);
    if (ok) load();
  };

  return (<>
    <div className="seg" style={{ fontSize: 13 }}>{SECTIONS.map(([k, l]) =>
      <button key={k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}>{l}{rows && <span className="muted"> {inSec(k).length}</span>}</button>)}</div>
    <div className="chips">{LIST_STATUS.map(([k, l]) =>
      <button key={k} className={`chip ${st === k ? 'on' : ''}`} onClick={() => setSt(k)}>{l} {rows ? inSec(sec).filter(r => r.status === k).length : ''}</button>)}</div>
    {rows === null ? <div className="sk" /> : shown.length === 0
      ? <Empty icon={<Film size={36} />} text={editable
        ? `Nothing in ${LIST_STATUS.find(x => x[0] === st)[1].toLowerCase()} yet. Open a title in Discover and set its status.`
        : `Nothing in ${LIST_STATUS.find(x => x[0] === st)[1].toLowerCase()} yet.`} />
      : <div className="grid">{shown.map(({ media: m, status }) => (
        <div key={m.id} className="pc">
          <Link href={`/m/${m.id}`}><div className="im">{m.poster_url ? <img src={m.poster_url} alt="" /> : m.title[0]}</div></Link>
          {stars[m.id] > 0 && <span className="badge" title="Their rating"><Star size={11} fill="currentColor" />{stars[m.id]}</span>}
          <b>{m.title}</b>
          <span className="muted">{m.release_date ? m.release_date.slice(0, 4) : ' '}</span>
          {editable && <select className="mini" value={status} onChange={e => change(m.id, e.target.value)}>
            {LIST_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="">Remove from list</option></select>}
        </div>))}</div>}
  </>);
}