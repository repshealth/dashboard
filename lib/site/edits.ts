import type { AnySpec } from './prereg';
import type { SiteChange } from '../types';

/** Fields that are never edited by an amend: identifiers and images. */
const LOCKED = /(^slug$|^kind$|^launchDate$|(^|\.)(image|logoUrl|before|after|screens(\.\d+)?)$|^brand\.(ground|ink)$)/;
const IMAGE_VALUE = /^(data:|https?:\/\/|\/)/;

/**
 * Every editable piece of text on a site, keyed by its path, e.g.
 * { "hero.headline.bold": "self starts here.", "features.items.2.title": "Meal plans", ... }
 */
export function flattenSpec(spec: AnySpec): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (v: unknown, path: string) => {
    if (v == null) return;
    if (typeof v === 'string') {
      if (!LOCKED.test(path) && !IMAGE_VALUE.test(v)) out[path] = v;
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, path ? `${path}.${i}` : String(i)));
    } else if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    }
  };
  walk(spec, '');
  return out;
}

const SECTION: Record<string, string> = {
  brand: 'Brand', nav: 'Menu', hero: 'Hero', band: 'Highlights band', about: 'Intro section', features: 'Feature cards',
  app: 'App section', pricing: 'Pricing', programmes: 'Programmes', results: 'Results', coach: 'Meet the coach',
  faq: 'FAQ', capture: 'Free guide', footer: 'Footer', form: 'Sign-up form', benefits: 'Reasons to join',
};
const FIELD: Record<string, string> = {
  headline: 'headline', sub: 'intro text', intro: 'intro text', p1: 'first paragraph', p2: 'second paragraph',
  ctaPrimary: 'main button', ctaSecondary: 'second button', cta: 'button', smallPrint: 'small print', proof: 'reviews badge',
  title: 'title', body: 'text', name: 'name', price: 'price', period: 'billing line', perDay: 'price per day',
  includes: 'what’s included', q: 'question', a: 'answer', quote: 'quote', badge: 'credential sticker', eyebrow: 'label',
  primary: 'main colour', secondary: 'second colour', font: 'headline style', button: 'button', small: 'small print',
  blurb: 'text', perk: 'offer line', banner: 'banner', meta: 'details', value: 'stat', label: 'stat label', tag: 'tag', pills: 'feature pill',
};

/** "features.items.2.title" -> "Feature cards · card 3 title" */
export function labelFor(path: string) {
  const parts = path.split('.');
  const section = SECTION[parts[0]] ?? parts[0];
  const idx = parts.find((p) => /^\d+$/.test(p));
  const field = [...parts].reverse().find((p) => !/^\d+$/.test(p) && p !== 'light' && p !== 'bold') ?? '';
  const nice = FIELD[field] ?? field;
  const item = idx !== undefined
    ? ` · ${parts[0] === 'faq' ? 'question' : parts[0] === 'pricing' ? 'plan' : parts[0] === 'band' ? 'item' : 'card'} ${Number(idx) + 1}`
    : '';
  return `${section}${item}${nice && nice !== parts[0] ? ` ${nice}` : ''}`.trim();
}

const FONTS = ['bold', 'modern', 'elegant'];

/** Applies text edits to a copy of the spec. Unknown or locked paths are skipped. */
export function applyEdits<T extends AnySpec>(spec: T, edits: { path: string; value: string; commentId?: string }[]) {
  const next = JSON.parse(JSON.stringify(spec)) as T;
  const editable = flattenSpec(spec);
  const changes: SiteChange[] = [];
  for (const e of edits) {
    if (!(e.path in editable)) continue;
    const before = editable[e.path];
    let value = String(e.value ?? '').trim();
    // A headline's lighter first line may be cleared, so the new words can sit on one line.
    if ((!value && !e.path.endsWith('.light')) || value === before) continue;
    if (e.path === 'brand.font' && !FONTS.includes(value.toLowerCase())) continue;
    if (/^brand\.(primary|secondary)$/.test(e.path) && !/^#[0-9a-f]{6}$/i.test(value)) continue;
    if (e.path === 'brand.font') value = value.toLowerCase();
    // Walk to the parent object and set the field.
    const parts = e.path.split('.');
    let node: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (const p of parts.slice(0, -1)) node = node[p] as Record<string, unknown>;
    node[parts[parts.length - 1]] = value;
    changes.push({ path: e.path, label: labelFor(e.path), before, after: value, commentId: e.commentId });
  }
  return { spec: next, changes };
}
