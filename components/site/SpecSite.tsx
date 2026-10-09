'use client';

import TemplateSite from './TemplateSite';
import PreRegSite from './PreRegSite';
import { isPreReg, type AnySpec } from '@/lib/site/prereg';

/** Draws a generated page, whichever template it uses. */
export default function SpecSite({ spec, formEndpoint }: { spec: AnySpec; formEndpoint?: string }) {
  return isPreReg(spec) ? <PreRegSite spec={spec} formEndpoint={formEndpoint} /> : <TemplateSite spec={spec} formEndpoint={formEndpoint} />;
}
