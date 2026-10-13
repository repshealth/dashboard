'use client';

import TemplateSite from './TemplateSite';
import PreRegSite from './PreRegSite';
import PulseSite from './PulseSite';
import ArenaSite from './ArenaSite';
import StudioSite from './StudioSite';
import { isPreReg, type AnySpec } from '@/lib/site/prereg';

/** Draws a generated page, whichever design it uses. */
export default function SpecSite({ spec, formEndpoint }: { spec: AnySpec; formEndpoint?: string }) {
  if (isPreReg(spec)) return <PreRegSite spec={spec} formEndpoint={formEndpoint} />;
  switch (spec.design) {
    case 'pulse': return <PulseSite spec={spec} formEndpoint={formEndpoint} />;
    case 'arena': return <ArenaSite spec={spec} formEndpoint={formEndpoint} />;
    case 'studio': return <StudioSite spec={spec} formEndpoint={formEndpoint} />;
    default: return <TemplateSite spec={spec} formEndpoint={formEndpoint} />;
  }
}
