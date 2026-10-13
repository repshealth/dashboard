/**
 * Turns a generated page (SiteSpec or PreRegSpec) into one standalone HTML file: the page's
 * markup, only the styles its design needs, the fonts, and a small script for the moving parts.
 * This file is bundled on its own by scripts/build-renderer.mjs (React included), so the
 * Cloudflare worker and the browser preview can both call it.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import SpecSite from '@/components/site/SpecSite';
import { isPreReg, type AnySpec } from '@/lib/site/prereg';
import { FONTS_URL } from '@/lib/fonts';
import template from '@/components/site/template.css';
import pulse from '@/components/site/pulse.css';
import kit from '@/components/site/kit.css';
import arena from '@/components/site/arena.css';
import studio from '@/components/site/studio.css';
import runtime from './runtime.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface RenderOptions {
  /** The page <title>. */
  title: string;
  /** Where the page's forms send leads, e.g. https://dashboard.example.com/api/forms */
  formEndpoint?: string;
  /** Turns relative image links (/api/files/...) into full ones, so the file works anywhere. */
  origin?: string;
  description?: string;
}

export function renderPage(spec: AnySpec, o: RenderOptions): string {
  const design = isPreReg(spec) ? 'template' : spec.design ?? 'shapeup';
  const css = design === 'arena' ? [kit, arena] : design === 'studio' ? [kit, studio] : design === 'pulse' ? [kit, pulse] : [template];
  let body = renderToStaticMarkup(<SpecSite spec={spec} formEndpoint={o.formEndpoint} />);
  if (o.origin) body = body.replace(/(src|href)="\/api\/files\//g, `$1="${o.origin.replace(/\/$/, '')}/api/files/`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_URL}">
<style>
html,body{margin:0;padding:0}
body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{max-width:100%}
${css.join('\n')}
</style>
</head>
<body>
${body}
<script>
${runtime}
</script>
</body>
</html>
`;
}
