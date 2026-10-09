// Renders the website template on its own with the example onboarding answers (npm run preview:template).
import { createRoot } from 'react-dom/client';
import TemplateSite from '@/components/site/TemplateSite';
import { exampleAnswers } from '@/lib/site/onboarding';
import { fallbackCopy } from '@/lib/site/copy';
import { buildSpec } from '@/lib/site/compose';
const a = exampleAnswers();
const w = new URLSearchParams(location.search).get('w');
const spec = buildSpec(a, fallbackCopy(a), 'strong-with-dani');
createRoot(document.getElementById('root')!).render(<div style={{ width: w ? +w : undefined, margin: '0 auto' }}><TemplateSite spec={spec} /></div>);
