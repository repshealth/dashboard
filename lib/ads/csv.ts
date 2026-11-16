import type { AdRowInput } from './types';

/** Split CSV (or tab/semicolon separated) text into rows, handling quotes. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', '\t', ';'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const num = (s?: string) => {
  if (!s) return 0;
  const n = Number(s.replace(/[£$€,\s]/g, ''));
  return isFinite(n) ? n : 0;
};
/** 2026-11-03, 03/11/2026 (UK) or 11/03/2026 when the day can't be a month. */
export function cleanDate(s?: string): string | null {
  const v = (s ?? '').trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) {
    let [d, mo] = [+m[1], +m[2]];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

export interface AdImport {
  rows: AdRowInput[];
  currency: string;
  from: string;
  to: string;
  campaigns: string[];
  daily: boolean;
  warnings: string[];
}

/**
 * Read an Ads Manager export. Works with campaign, ad set or ad level, and with or without
 * the "By day" breakdown. Unknown columns are ignored.
 */
export function readAdsExport(text: string): AdImport {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('That file has no rows. Export a report from Ads Manager as a CSV.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: (string | RegExp)[]) => {
    for (const n of names) {
      const i = head.findIndex((h) => (typeof n === 'string' ? h === n : n.test(h)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = {
    campaign: col('campaign name', 'campaign'),
    adset: col('ad set name', 'ad set'),
    ad: col('ad name', 'ad'),
    day: col('day', 'date'),
    start: col('reporting starts', 'reporting start'),
    end: col('reporting ends', 'reporting end'),
    spend: col(/^amount spent/, 'spend', /^cost$/),
    impressions: col('impressions'),
    reach: col('reach'),
    clicks: col('link clicks', 'clicks (all)', 'clicks'),
    results: col('results'),
    resultType: col('result indicator', 'result type'),
    leads: col('leads', /^website leads/, /^on-facebook leads/, /^meta leads/),
    purchases: col('purchases', /^website purchases$/),
    value: col(/^purchases? conversion value/, /^website purchases conversion value/),
    delivery: col('campaign delivery', 'ad set delivery', 'ad delivery', 'delivery'),
  };
  if (c.campaign < 0) throw new Error('Couldn’t find a "Campaign name" column. In Ads Manager, export from the Campaigns, Ad sets or Ads tab.');
  if (c.spend < 0) throw new Error('Couldn’t find an "Amount spent" column. Add it to the columns before exporting.');
  const cur = (rows[0][c.spend].match(/\(([A-Z]{3})\)/) ?? [])[1] ?? 'GBP';
  const out: AdRowInput[] = [];
  const warnings: string[] = [];
  let noDate = 0;
  const daily = c.day >= 0;
  for (const r of rows.slice(1)) {
    const campaign = (r[c.campaign] ?? '').trim();
    if (!campaign) continue; // Ads Manager's totals row
    const date = cleanDate(daily ? r[c.day] : r[c.start]) ?? cleanDate(r[c.end]);
    if (!date) { noDate++; continue; }
    const endDate = !daily && c.end >= 0 ? cleanDate(r[c.end]) ?? undefined : undefined;
    out.push({
      date, ...(endDate && endDate !== date ? { endDate } : {}),
      campaign: campaign.slice(0, 200),
      adset: c.adset >= 0 ? (r[c.adset] ?? '').trim().slice(0, 200) : '',
      ad: c.ad >= 0 ? (r[c.ad] ?? '').trim().slice(0, 200) : '',
      spend: num(r[c.spend]), impressions: num(r[c.impressions]), reach: num(r[c.reach]), clicks: num(r[c.clicks]),
      results: num(r[c.results]), resultType: c.resultType >= 0 ? (r[c.resultType] ?? '').trim().slice(0, 60) || undefined : undefined,
      metaLeads: num(r[c.leads]), purchases: num(r[c.purchases]), value: num(r[c.value]),
      delivery: c.delivery >= 0 ? (r[c.delivery] ?? '').trim().slice(0, 40) || undefined : undefined,
    });
  }
  if (!out.length) throw new Error(noDate ? 'The rows have no dates. Export with Breakdown > By time > Day, or include "Reporting starts".' : 'No campaign rows found in that file.');
  if (noDate) warnings.push(`${noDate} row${noDate === 1 ? '' : 's'} without a date were skipped.`);
  if (!daily) warnings.push('This export isn’t broken down by day, so each row is counted on its start date. For daily charts, export with Breakdown > By time > Day.');
  if (c.impressions < 0 || c.clicks < 0) warnings.push('Impressions or link clicks are missing, so CTR, CPC and CPM won’t show.');
  const dates = out.map((x) => x.date).sort();
  return { rows: out, currency: cur, from: dates[0], to: dates[dates.length - 1], campaigns: [...new Set(out.map((x) => x.campaign))], daily, warnings };
}
