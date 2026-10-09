// Builds single-file previews on example data, which open by double-clicking with no
// server or install needed:
//   preview-dist/reps-scaling-os.html  the whole dashboard
//   preview-dist/onboarding.html       the public onboarding form on its own
// The matching *-artifact.html files are the same pages without the outer <html> wrapper.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'preview-dist');
mkdirSync(outDir, { recursive: true });

const css0 = readFileSync(join(root, 'app/globals.css'), 'utf8') + '\n' + readFileSync(join(root, 'components/site/template.css'), 'utf8');
const fontsUrl = readFileSync(join(root, 'lib/fonts.ts'), 'utf8').match(/https:\/\/fonts\.googleapis\.com[^'"`]+/)[0];

// Inline images from /public so each file works on its own.
const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };
const inline = (text) =>
  text.replace(/\/(?:demo\/)?[\w.-]+\.(png|jpe?g|svg|webp)/g, (m, ext) => {
    try {
      return `data:${mime[ext]};base64,${readFileSync(join(root, 'public', m)).toString('base64')}`;
    } catch {
      return m;
    }
  });

async function bundle({ entry, title, file, artifact }) {
  const result = await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    tsconfig: join(root, 'tsconfig.json'),
    alias: {
      'next/link': join(root, 'preview/shims/link.tsx'),
      'next/navigation': join(root, 'preview/shims/navigation.ts'),
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      // Always example data in the preview.
      'process.env.NEXT_PUBLIC_LIVE': '"false"',
    },
    logLevel: 'warning',
  });
  const js = inline(result.outputFiles[0].text);
  const css = inline(css0);
  const head = `<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsUrl}">
<style>
${css}
</style>
`;
  const body = `<div id="root"></div>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
  writeFileSync(
    join(outDir, file),
    `<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}</head>\n<body>\n${body}</body>\n</html>\n`,
  );
  writeFileSync(join(outDir, artifact), head + body);
  console.log(`Preview written to preview-dist/${file} (${((head.length + body.length) / 1024 / 1024).toFixed(1)} MB)`);
}

await bundle({ entry: 'preview/entry.tsx', title: 'REPS Scaling OS', file: 'reps-scaling-os.html', artifact: 'artifact.html' });
await bundle({ entry: 'preview/onboarding-entry.tsx', title: 'REPS Client Onboarding', file: 'onboarding.html', artifact: 'onboarding-artifact.html' });

// A copy for GitHub Pages: in the repo's settings, publish from the "docs" folder.
// docs/index.html is the dashboard, docs/onboarding.html the form on its own.
import { copyFileSync } from 'node:fs';
const docs = join(root, 'docs');
mkdirSync(docs, { recursive: true });
copyFileSync(join(outDir, 'reps-scaling-os.html'), join(docs, 'index.html'));
copyFileSync(join(outDir, 'onboarding.html'), join(docs, 'onboarding.html'));
writeFileSync(join(docs, '.nojekyll'), '');
console.log('GitHub Pages copy written to docs/');
