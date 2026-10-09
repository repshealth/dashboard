// Entry for the onboarding-only preview: the public form page on its own, as a new client sees it.
import { createRoot } from 'react-dom/client';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';

createRoot(document.getElementById('root')!).render(<OnboardingScreen standalone />);
