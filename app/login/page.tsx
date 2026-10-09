'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { isLive } from '@/lib/live';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error');
    if (err) { setState('error'); setMsg(err === 'expired' ? 'That sign-in link has expired or was already used. Send yourself a new one.' : 'Something went wrong signing you in. Please try again.'); }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    const res = await fetch('/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { setState('error'); setMsg(out.error || ''); return; }
    setState('sent');
  };

  return (
    <div className="login">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reps-logo.png" alt="REPS" />
        <h1>Sign in to Scaling OS</h1>
        {isLive ? (
          <>
            <p>Enter the email your REPS account is under and we&apos;ll send you a sign-in link.</p>
            <form onSubmit={submit}>
              <label className="field">
                <span>Email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button className="btn gold" type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
            {state === 'sent' && <div className="form-msg ok">If that email has a REPS account, a sign-in link is on its way. You can close this tab.</div>}
            {state === 'error' && <div className="form-msg err">{msg || 'Something went wrong. Please try again.'}</div>}
          </>
        ) : (
          <>
            <p>Sign-in switches on once the database is connected. Until then the dashboard runs on example data.</p>
            <Link className="btn gold" href="/agency" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Open the dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
