'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { backend } from '@/lib/backend';
import { isLive } from '@/lib/live';
import { DEMO_AGENCY } from '@/lib/backend/demo';

/** The first page anyone sees: email and password, then on to their dashboard. */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error');
    if (err) setMsg(err === 'expired' ? 'That sign-in link has expired or was already used. Sign in with your email and password instead.' : 'Something went wrong signing you in. Please try again.');
    // Already signed in: straight to the dashboard.
    backend.getViewer().then((v) => { if (v) router.replace('/'); }).catch(() => {});
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await backend.signIn(email.trim(), password);
      router.replace('/');
    } catch (x) {
      setMsg(x instanceof Error ? x.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reps-logo.png" alt="REPS" />
        <h1>Sign in to Scaling OS</h1>
        <p>Use the email and password the REPS team set up for you.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input type="email" required autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <span className="pw">
              <input type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-show" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <button className="btn gold" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        {msg && <div className="form-msg err" role="alert">{msg}</div>}
        <p className="login-help">Forgotten your password? Ask the REPS team to reset it.</p>
        {!isLive && (
          <div className="login-demo">
            <b>Preview:</b> sign in as the agency with <code>{DEMO_AGENCY.email}</code> and <code>{DEMO_AGENCY.password}</code>. Logins you make in Agency, Logins work here too until the page is reloaded.
          </div>
        )}
      </div>
    </div>
  );
}
