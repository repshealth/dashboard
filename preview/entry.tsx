// Entry for the single-file HTML preview. Uses the same screens and components as the
// Next.js app; only routing is swapped for the shims in ./shims.
import { createRoot } from 'react-dom/client';
import AppShell from '@/components/AppShell';
import LeadsView from '@/components/leads/LeadsView';
import WebsiteView from '@/components/website/WebsiteView';
import AgencyOverview from '@/components/agency/AgencyOverview';
import Approvals from '@/components/agency/Approvals';
import OnboardingAnswers from '@/components/agency/OnboardingAnswers';
import AgencyEmails from '@/components/agency/AgencyEmails';
import EmailsView from '@/components/emails/EmailsView';
import AgencyMeetings from '@/components/agency/AgencyMeetings';
import MeetingsView from '@/components/meetings/MeetingsView';
import LoginPage from '@/app/login/page';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import { usePathname } from './shims/navigation';

function Screen() {
  const path = usePathname();
  if (path === '/agency') return <AgencyOverview />;
  if (path === '/agency/approvals') return <Approvals />;
  if (path === '/agency/onboarding') return <OnboardingAnswers />;
  if (path === '/agency/emails') return <AgencyEmails />;
  if (path.startsWith('/emails')) return <EmailsView />;
  if (path === '/agency/meetings') return <AgencyMeetings />;
  if (path.startsWith('/meetings')) return <MeetingsView />;
  return path.startsWith('/website') ? <WebsiteView /> : <LeadsView />;
}

function App() {
  const path = usePathname();
  if (path === '/login') return <LoginPage />;
  if (path === '/onboarding') return <OnboardingScreen />;
  return (
    <AppShell>
      <Screen />
    </AppShell>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
