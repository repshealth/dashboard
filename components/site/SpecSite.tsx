'use client';

import TemplateSite from './TemplateSite';
import PreRegSite from './PreRegSite';
import PulseSite from './PulseSite';
import { isPreReg, type AnySpec } from '@/lib/site/prereg';

/** Draws a generated page, whichever template it uses. */
export default function SpecSite({ spec, formEndpoint }: { spec: AnySpec; formEndpoint?: string }) {
  if (isPreReg(spec)) return <PreRegSite spec={spec} formEndpoint={formEndpoint} />;
  return spec.design === 'pulse' ? <PulseSite spec={spec} formEndpoint={formEndpoint} /> : <TemplateSite spec={spec} formEndpoint={formEndpoint} />;
}
