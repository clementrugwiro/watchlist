import { supabase } from './supabase';
import { sortEps } from './util';
const URL = 'https://graphql.anilist.co';
const F = `id idMal format status episodes title { romaji english native } synonyms genres description(asHtml: false)
  coverImage { extraLarge large } startDate { year month day } nextAiringEpisode { episode }`;
const Q = {
  id: `query($v:Int){ Media(id:$v, type:ANIME){ ${F} } }`,
  idMal: `query($v:Int){ Media(idMal:$v, type:ANIME){ ${F} } }`,
  search: `query($v:String){ Page(perPage:10){ media(search:$v, type:ANIME){ ${F} } } }`,
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0, gap = 800; // AniList allows about 90 requests/min (its docs mention 30/min when degraded)
async function gql(kind, v) {
  for (let i = 0; i < 4; i++) {
    const w = last + gap - Date.now(); if (w > 0) await sleep(w); last = Date.now();
    let r;
    try {
      r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: Q[kind], variables: { v } }) });
    } catch { throw new Error('Could not reach AniList. Check your connection or disable ad blockers for this site.'); }
    if (r.status === 429) { gap = 2200; await sleep(i === 0 ? 20000 : 60000); continue; } // 1-minute timeout after the limit
    if (r.status === 404) return kind === 'search' ? [] : null;
    if (!r.ok) throw new Error(`AniList error ${r.status}`);
    const j = await r.json();
    return kind === 'search' ? j.data?.Page?.media || [] : j.data?.Media || null;
  }
  throw new Error('AniList rate limit reached, try again in a minute');
}
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const FMT = { TV: 0, MOVIE: 1, ONA: 2, TV_SHORT: 3, OVA: 4 };
function pick(list, m) { // exact title match only (romaji, English, native or synonym), close year when both known
  const t = norm(m.title), y = m.release_date ? +m.release_date.slice(0, 4) : null;
  return list.filter(a => [a.title.romaji, a.title.english, a.title.native, ...(a.synonyms || [])].some(n => norm(n) === t)
    && (!y || !a.startDate?.year || Math.abs(a.startDate.year - y) <= 1))
    .sort((a, b) => (FMT[a.format] ?? 9) - (FMT[b.format] ?? 9))[0] || null;
}
// Adds newly aired episodes and fills EMPTY fields only. Never lowers or overwrites anything.
export async function syncMedia(m, eps) {
  let a;
  if (m.anilist_id) a = await gql('id', m.anilist_id);
  else if (m.mal_id) a = await gql('idMal', m.mal_id);
  else a = pick(await gql('search', m.title), m);
  if (!a) return { status: 'review' };
  const patch = { anilist_id: a.id, mal_status: a.status === 'FINISHED' ? 'Finished Airing' : a.status, synced_at: new Date().toISOString() };
  if (a.idMal && !m.mal_id) patch.mal_id = a.idMal;
  const poster = a.coverImage?.extraLarge || a.coverImage?.large; const d = a.startDate;
  if (!m.poster_url && poster) patch.poster_url = poster;
  if (!m.description && a.description) patch.description = a.description;
  if (!m.release_date && d?.year) patch.release_date = `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}`;
  if (!m.genre?.length && a.genres?.length) patch.genre = a.genres;
  const aired = a.status === 'FINISHED' ? a.episodes || 0 : a.nextAiringEpisode ? a.nextAiringEpisode.episode - 1 : 0;
  const add = Math.min(Math.max(aired - eps.length, 0), 2000);
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
