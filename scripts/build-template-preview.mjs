// Builds preview-dist/template.html: the client website template on its own, filled from the
// example onboarding answers. Handy when changing the template design.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const r = await build({
  entryPoints: [join(root, 'preview/template-entry.tsx')],
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2020', jsx: 'automatic',
  tsconfig: join(root, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
const css = readFileSync(join(root, 'app/globals.css'), 'utf8') + readFileSync(join(root, 'components/site/template.css'), 'utf8');
const fonts = readFileSync(join(root, 'lib/fonts.ts'), 'utf8').match(/https:\/\/fonts\.googleapis\.com[^'"`]+/)[0];
mkdirSync(join(root, 'preview-dist'), { recursive: true });
writeFileSync(
  join(root, 'preview-dist/template.html'),
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Website template</title><link rel="stylesheet" href="${fonts}"><style>${css}</style></head><body style="background:#fff"><div id="root"></div><script>${r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`,
);
console.log('Template preview written to preview-dist/template.html');
