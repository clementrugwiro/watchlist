'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Compass, User, Clapperboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Auth from './Auth';
import NotifyProvider, { useNotify } from './Notify';
function Nav({ path }) {
  const { total } = useNotify(); // unread chat messages across all groups
  const tab = (href, Icon, label, on, n = 0) => <Link href={href} className={on(path) ? 'on' : ''}><span className="ic"><Icon size={22} />{n > 0 && <i className="dot">{n > 9 ? '9+' : n}</i>}</span><span>{label}</span></Link>;
  return (<nav><div className="brand"><Clapperboard size={22} /> Watchlist</div>
    {tab('/', Users, 'Groups', p => p === '/' || p.startsWith('/g/'), total)}
    {tab('/discover', Compass, 'Discover', p => p.startsWith('/discover') || p.startsWith('/m/'))}
    {tab('/profile', User, 'Profile', p => p.startsWith('/profile') || p.startsWith('/u/'))}</nav>);
}
export default function Shell({ children }) {
  const [s, setS] = useState(undefined); const [t, setT] = useState(null); const path = usePathname();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setS(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, x) => setS(x));
    const h = e => { setT(e.detail); clearTimeout(window.__t); window.__t = setTimeout(() => setT(null), 3500); };
    window.addEventListener('toast', h);
    return () => { subscription.unsubscribe(); window.removeEventListener('toast', h); };
  }, []);
  const uid = s?.user?.id;
  useEffect(() => { // make sure this user always has a profile row
    if (!s?.user) return; const u = s.user;
    supabase.from('profiles').upsert({ id: u.id, username: u.user_metadata?.username || u.email.split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true });
  }, [uid]);
  useEffect(() => { if (!path.startsWith('/g/')) document.documentElement.style.removeProperty('--accent'); }, [path]);
  const toastEl = t && <div className={`toast ${t.bad ? 'bad' : ''}`}>{t.m}</div>;
  if (s === undefined) return <div className="boot"><Clapperboard size={40} /></div>;
  if (!s) return <><Auth />{toastEl}</>;
  return (<NotifyProvider user={s.user}>
    <Nav path={path} />
    <main className="wrap">{children(s.user)}
      <p className="muted" style={{ textAlign: 'center', marginTop: 28 }}>Anime data from AniList. Movie and series data from TMDB.</p></main>{toastEl}</NotifyProvider>);
}