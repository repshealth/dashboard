import type { Metadata } from 'next';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';

export const metadata: Metadata = { title: 'Client onboarding' };

/**
 * Public onboarding form at /onboarding. No login needed, so it can be sent to a new
 * client before they have a dashboard account.
 */
export default function OnboardingPage() {
  return <OnboardingScreen />;
}
