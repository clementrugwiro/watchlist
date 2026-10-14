import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
// GIF search through GIPHY. The key stays on the server and only signed-in users can use it.
export async function GET(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const key = process.env.GIPHY_API_KEY;
  if (!key) return Response.json({ error: 'GIPHY_API_KEY is not set on the server' }, { status: 500 });
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 100);
  const url = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${key}&limit=24&rating=pg-13${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ error: j.message || `GIPHY error ${r.status}` }, { status: r.status });
    return Response.json({ results: (j.data || []).map(g => ({
      id: g.id, title: g.title,
      preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
      url: g.images?.fixed_width?.url || g.images?.original?.url })) });
  } catch (e) {
    return Response.json({ error: `Could not reach GIPHY (${e.message})` }, { status: 502 });
  }
}