import type { Metadata } from 'next';
import OnboardingAnswers from '@/components/agency/OnboardingAnswers';

export const metadata: Metadata = { title: 'Onboarding answers' };

/** REPS only: every onboarding form submitted, with all answers and photos. */
export default function OnboardingAnswersPage() {
  return <OnboardingAnswers />;
}
