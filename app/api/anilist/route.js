import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
// AniList lookups for the sync. Only these three fixed queries can be run, and only by signed-in users.
const F = `id idMal format status episodes title { romaji english native } synonyms genres description(asHtml: false)
  coverImage { extraLarge large } startDate { year month day } nextAiringEpisode { episode }`;
const Q = {
  id: `query($v:Int){ Media(id:$v, type:ANIME){ ${F} } }`,
  idMal: `query($v:Int){ Media(idMal:$v, type:ANIME){ ${F} } }`,
  search: `query($v:String){ Page(perPage:10){ media(search:$v, type:ANIME){ ${F} } } }`,
};
export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const { data } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).auth.getUser(token);
  if (!data?.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const { kind, v } = await req.json().catch(() => ({}));
  const okValue = kind === 'search' ? typeof v === 'string' && v.length > 0 && v.length <= 200 : Number.isInteger(v);
  if (!Q[kind] || !okValue) return Response.json({ error: 'Bad request' }, { status: 400 });
  try {
    const r = await fetch('https://graphql.anilist.co', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: Q[kind], variables: { v } }) });
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return Response.json({ error: `The server could not reach AniList (${e.message})` }, { status: 502 });
  }
}