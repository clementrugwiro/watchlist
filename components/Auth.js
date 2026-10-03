'use client';
import { useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/util';
import { Field } from './ui';
export default function Auth() {
  const [mode, setMode] = useState('login'); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: '', password: '', username: '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const { data, error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      : await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { username: f.username.trim() } } });
    setBusy(false);
    if (error) toast(error.message, true);
    else if (mode === 'signup' && !data.session) toast('Account created. Confirm your email, then sign in.');
  }
  async function forgot() {
    if (!f.email) return toast('Enter your email first', true);
    const { error } = await supabase.auth.resetPasswordForEmail(f.email);
    toast(error ? error.message : 'Reset link sent', !!error);
  }
  return (
    <div className="auth">
      <div className="logo"><Clapperboard size={32} /></div>
      <h1>Watch together.<br />Rate together.</h1>
      <p className="muted">Movies, series and anime, shared with your friends.</p>
      <form className="card" onSubmit={submit} style={{ textAlign: 'left' }}>
        <div className="seg">{[['login', 'Sign in'], ['signup', 'Create account']].map(([k, l]) =>
          <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
        {mode === 'signup' && <Field label="Username" value={f.username} onChange={set('username')} required />}
        <Field label="Email" type="email" value={f.email} onChange={set('email')} required />
        <Field label="Password" type="password" minLength={6} value={f.password} onChange={set('password')} required />
        <button className="btn" style={{ width: '100%', marginTop: 8 }} disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        {mode === 'login' && <p style={{ textAlign: 'center' }}><button type="button" className="ib" onClick={forgot}>Forgot password?</button></p>}
      </form>
    </div>);
}
