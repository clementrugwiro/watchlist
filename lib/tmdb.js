import { supabase } from './supabase';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function tget(path) { // goes through our own /api/tmdb route, which keeps the TMDB token on the server
  const { data: { session } } = await supabase.auth.getSession();
  for (let i = 0; i < 3; i++) {
    const w = last + 150 - Date.now(); if (w > 0) await sleep(w); last = Date.now();
    const r = await fetch('/api/tmdb?path=' + encodeURIComponent(path), { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
    if (r.status === 404) return null;
    if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.status_message || b.error || `TMDB error ${r.status}`); }
    return r.json();
  }
  throw new Error('TMDB rate limit reached, try again in a minute');
}
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const yr = r => +(r.release_date || r.first_air_date || '').slice(0, 4) || null;
function pick(list, m) { // exact title match only, close year when both are known, most popular first
  const t = norm(m.title), y = m.release_date ? +m.release_date.slice(0, 4) : null;
  return list.filter(r => [r.title, r.original_title, r.name, r.original_name].some(n => norm(n) === t)
    && (!y || !yr(r) || Math.abs(yr(r) - y) <= 1)).sort((a, b) => b.popularity - a.popularity)[0] || null;
}
// Movies and series. Adds newly aired episodes (with real season numbers) and fills EMPTY fields only.
export async function syncTmdb(m, eps) {
  const kind = m.media_type === 'movie' ? 'movie' : 'tv';
  let id = m.tmdb_id;
  if (!id) {
    const res = await tget(`/search/${kind}?query=${encodeURIComponent(m.title)}`);
    const hit = pick(res?.results || [], m); if (!hit) return { status: 'review' }; id = hit.id;
  }
  const a = await tget(`/${kind}/${id}`);
  if (!a) return { status: 'review' };
  const done = kind === 'movie' ? a.status === 'Released' : a.status === 'Ended' || a.status === 'Canceled';
  const patch = { tmdb_id: a.id, mal_status: done ? 'Finished Airing' : a.status, synced_at: new Date().toISOString() };
  const date = a.release_date || a.first_air_date;
  if (!m.poster_url && a.poster_path) patch.poster_url = `https://image.tmdb.org/t/p/w500${a.poster_path}`;
  if (!m.description && a.overview) patch.description = a.overview;
  if (!m.release_date && date) patch.release_date = date;
  if (!m.genre?.length && a.genres?.length) patch.genre = a.genres.map(g => g.name);
  let rows = [];
  if (kind === 'tv') { // list every episode that has aired, in order, then add the ones beyond what we already have
    const lastEp = a.last_episode_to_air, aired = [];
    for (const s of (a.seasons || []).filter(s => s.season_number > 0).sort((x, y) => x.season_number - y.season_number)) {
      let n = s.episode_count || 0;
      if (lastEp) { if (s.season_number > lastEp.season_number) n = 0; else if (s.season_number === lastEp.season_number) n = lastEp.episode_number; }
      else if (!done) n = 0;
      for (let e = 1; e <= n; e++) aired.push([s.season_number, e]);
    }
    rows = aired.slice(eps.length, eps.length + 2000).map(([s, e]) => ({ media_id: m.id, season_number: s, episode_number: e }));
  }
  const { data: up, error } = await supabase.from('media').update(patch).eq('id', m.id).select('id');
  if (error) return { status: 'error', msg: error.message };
  if (!up?.length) return { status: 'denied' };
  for (let k = 0; k < rows.length; k += 500) {
    const { error: e2 } = await supabase.from('episodes').upsert(rows.slice(k, k + 500),
      { onConflict: 'media_id,season_number,episode_number', ignoreDuplicates: true });
    if (e2) return { status: 'error', msg: e2.message };
  }
  return { status: rows.length ? 'updated' : 'ok', added: rows.length };
}