import { supabase } from './supabase';
import { sortEps } from './util';
const GAP = +process.env.NEXT_PUBLIC_JIKAN_DELAY_MS || 1100; // public API: 3 req/s, 60 req/min
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function jget(path) { // goes through our own /api/jikan route, so the browser never calls Jikan directly
  const { data: { session } } = await supabase.auth.getSession();
  for (let i = 0; i < 4; i++) {
    const w = last + GAP - Date.now(); if (w > 0) await sleep(w); last = Date.now();
    const r = await fetch('/api/jikan?path=' + encodeURIComponent(path), { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (r.status === 429) { await sleep(3000); continue; }
    if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || `Jikan error ${r.status}`); }
    return r.json();
  }
  throw new Error('Jikan rate limit reached, try again in a minute');
}
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const yr = d => (d ? +String(d).slice(0, 4) : null);
function pick(list, m) { // only accept an exact title match (and a close year when both are known)
  const t = norm(m.title), y = yr(m.release_date);
  return list.find(a => [a.title, a.title_english, ...(a.titles || []).map(x => x.title)].some(n => norm(n) === t)
    && (!y || !a.aired?.from || Math.abs(yr(a.aired.from) - y) <= 1)) || null;
}
async function airedCount(id) { // for shows still airing, MAL has no total yet
  const p1 = await jget(`/anime/${id}/episodes?page=1`);
  const lastPage = p1.pagination?.last_visible_page || 1;
  if (lastPage === 1) return p1.data.length;
  const pl = await jget(`/anime/${id}/episodes?page=${lastPage}`);
  return (lastPage - 1) * p1.data.length + pl.data.length;
}
// Adds missing episodes and fills EMPTY fields only. Never lowers or overwrites anything.
export async function syncMedia(m, eps) {
  let a;
  if (m.mal_id) a = (await jget(`/anime/${m.mal_id}`)).data;
  else { a = pick((await jget(`/anime?q=${encodeURIComponent(m.title)}&limit=10`)).data || [], m); if (!a) return { status: 'review' }; }
  const patch = { mal_id: a.mal_id, mal_status: a.status || null, synced_at: new Date().toISOString() };
  if (!m.poster_url && a.images?.jpg?.large_image_url) patch.poster_url = a.images.jpg.large_image_url;
  if (!m.description && a.synopsis) patch.description = a.synopsis;
  if (!m.release_date && a.aired?.from) patch.release_date = a.aired.from.slice(0, 10);
  if (!m.genre?.length && a.genres?.length) patch.genre = a.genres.map(g => g.name);
  const total = a.episodes ?? (a.status === 'Currently Airing' ? await airedCount(a.mal_id) : 0);
  const add = Math.min(Math.max(total - eps.length, 0), 2000);
  const { data: up, error } = await supabase.from('media').update(patch).eq('id', m.id).select('id');
  if (error) return { status: 'error', msg: error.message };
  if (!up?.length) return { status: 'denied' };
  if (add > 0) {
    const l = sortEps(eps).pop(); const s = l?.season_number || 1, n0 = l?.episode_number || 0;
    const rows = Array.from({ length: add }, (_, i) => ({ media_id: m.id, season_number: s, episode_number: n0 + i + 1 }));
    for (let k = 0; k < rows.length; k += 500) {
      const { error: e2 } = await supabase.from('episodes').insert(rows.slice(k, k + 500));
      if (e2) return { status: 'error', msg: e2.message };
    }
  }
  return { status: add > 0 ? 'updated' : 'ok', added: add };
}
