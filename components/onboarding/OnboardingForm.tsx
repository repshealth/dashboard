'use client';

import Link from 'next/link';
import { useState } from 'react';
import { backend } from '@/lib/backend';
import { rememberClient } from '../DataProvider';
import { emptyAnswers, exampleIntake } from '@/lib/site/onboarding';
import { CLIENT_STEPS as STEPS, type Draft } from './steps';

export default function OnboardingForm({ dashboardLink = true }: { dashboardLink?: boolean }) {
  const [a, setA] = useState<Draft>(emptyAnswers);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'sending' | 'done'>('form');
  const [result, setResult] = useState<{ clientId: string; copyBy: string } | null>(null);
  const demo = backend.mode === 'demo';

  const set = (fn: (d: Draft) => void) => setA((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const go = (to: number) => {
    if (to > step) {
      for (let i = step; i < to; i++) {
        const msg = STEPS[i].check?.(a);
        if (msg) { setStep(i); setError(msg); return; }
      }
    }
    setError(null);
    setStep(to);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i++) {
      const msg = STEPS[i].check?.(a);
      if (msg) { setStep(i); setError(msg); return; }
    }
    setPhase('sending'); setError(null);
    try {
      const r = await backend.submitOnboarding(a);
      rememberClient(r.clientId);
      setResult(r);
      setPhase('done');
    } catch (e) {
      setPhase('form');
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  if (phase === 'sending') {
    return (
      <div className="ob-card ob-center">
        <div className="ob-spinner" aria-hidden="true" />
        <h1 className="ob-title">Setting up your account</h1>
        <p className="ob-intro">Creating your account and building the first draft of your website from your answers. This takes up to a minute.</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="ob-card ob-center">
        <div className="ob-tick" aria-hidden="true">✓</div>
        <h1 className="ob-title">Thanks, {a.business.coachName || a.contact.name.split(' ')[0]}!</h1>
        <p className="ob-intro">
          We&apos;ve got everything we need. The REPS team will now plan your launch and finish your website, then email you at <b>{a.contact.email}</b> with
          your login so you can review it and leave comments.
        </p>
        {demo && dashboardLink && (
          <div className="ob-demo-done">
            <p>Example mode: the account and draft site were created. Open the dashboard to see them as the REPS team would.</p>
            <Link className="btn gold" href="/website">Open {a.business.brandName} in the dashboard</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ob-card">
      <ol className="ob-steps" aria-label="Progress">
        {STEPS.map((x, i) => (
          <li key={x.title} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} title={x.title}>
              <span className="ob-dot">{i < step ? '✓' : i + 1}</span>
              <span className="ob-step-t">{x.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="ob-head">
        <div className="ob-count">Step {step + 1} of {STEPS.length}</div>
        <h1 className="ob-title">{s.title}</h1>
        <p className="ob-intro">{s.intro}</p>
        {demo && step === 0 && (
          <button type="button" className="ob-link" onClick={() => { setA(exampleIntake()); setError(null); }}>Fill with example answers</button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (last) submit(); else go(step + 1); }}>
        {s.body(a, set)}
        {error && <div className="ob-error" role="alert">{error}</div>}
        <div className="ob-nav">
          {step > 0 ? <button type="button" className="btn" onClick={() => go(step - 1)}>Back</button> : <span />}
          <button type="submit" className="btn gold">{last ? 'Send my answers' : 'Continue'}</button>
        </div>
      </form>
    </div>
  );
}
