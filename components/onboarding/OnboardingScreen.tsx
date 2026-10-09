'use client';

import { backend } from '@/lib/backend';
import OnboardingForm from './OnboardingForm';

/**
 * The public onboarding page: REPS header, the form and nothing from the dashboard.
 * `standalone` hides the "open in the dashboard" shortcut shown after a test submission.
 */
export default function OnboardingScreen({ standalone = false }: { standalone?: boolean }) {
  return (
    <div className="ob-page">
      <header className="ob-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reps-logo.png" alt="REPS" />
        <span>Client onboarding</span>
      </header>
      {backend.mode === 'demo' && (
        <div className="ob-preview" role="note">
          <b>Preview.</b> Answers aren&apos;t saved anywhere yet. Send clients the live link once the dashboard is online.
        </div>
      )}
      <OnboardingForm dashboardLink={!standalone} />
      <p className="ob-foot">Your answers are only used to build your website, pre-registration page and launch emails, and to set up your REPS account.</p>
    </div>
  );
}
