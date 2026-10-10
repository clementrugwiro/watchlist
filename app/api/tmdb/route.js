import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
// Only title search and movie/tv detail requests can go through this proxy.
const OK = /^\/(search\/(movie|tv)\?query=[^&#]{1,200}|(movie|tv)\/\d+)$/;
export async function GET(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  if (!process.env.TMDB_TOKEN) return Response.json({ error: 'TMDB_TOKEN is not set on the server' }, { status: 500 });
  const path = new URL(req.url).searchParams.get('path') || '';
  if (!OK.test(path)) return Response.json({ error: 'Path not allowed' }, { status: 400 });
  try {
    const r = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}language=en-US`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}`, Accept: 'application/json' }, cache: 'no-store' });
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return Response.json({ error: `The server could not reach TMDB (${e.message})` }, { status: 502 });
  }
}