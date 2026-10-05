import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
// Only these Jikan paths can be requested through this proxy.
const OK = /^\/anime(\?q=[^&#]{1,200}&limit=\d{1,2}|\/\d+(\/episodes\?page=\d+)?)$/;
export async function GET(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const path = new URL(req.url).searchParams.get('path') || '';
  if (!OK.test(path)) return Response.json({ error: 'Path not allowed' }, { status: 400 });
  const base = process.env.JIKAN_URL || 'https://api.jikan.moe/v4';
  try {
    const r = await fetch(base + path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return Response.json({ error: `The server could not reach Jikan at ${base} (${e.message})` }, { status: 502 });
  }
}
