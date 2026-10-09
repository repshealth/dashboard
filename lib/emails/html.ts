import type { EmailCampaign, LaunchEmail } from './types';

/** "strongwithdani.co.uk" -> "https://strongwithdani.co.uk". */
export const siteHref = (url: string) => (!url.trim() ? '' : /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`);

/** Whether this email shows the discount code box. */
export const showsCode = (c: Pick<EmailCampaign, 'discountCode'>, e: LaunchEmail) => Boolean(c.discountCode && e.list === 'prereg' && e.stage === 'launch');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The email as HTML for MailerLite: one centred column, inline styles, the brand colours.
 * {$name} and {$unsubscribe} are MailerLite merge tags.
 */
export function emailHtml(c: EmailCampaign, e: LaunchEmail) {
  const b = c.brand;
  const font = b.font === 'elegant' ? "Georgia, 'Times New Roman', serif" : "'Helvetica Neue', Arial, sans-serif";
  const logo = b.logoUrl && /^https?:\/\//.test(b.logoUrl)
    ? `<img src="${esc(b.logoUrl)}" alt="${esc(b.name)}" height="36" style="display:block;height:36px;width:auto;border:0">`
    : `<span style="font:700 22px ${font};color:${b.ink};text-transform:${b.font === 'elegant' ? 'none' : 'uppercase'}">${esc(b.name)}</span>`;
  const p = (t: string) => `<p style="margin:0 0 16px;font:16px/1.6 'Helvetica Neue',Arial,sans-serif;color:${b.ink}">${esc(t)}</p>`;
  const href = siteHref(c.websiteUrl);
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5">
<div style="display:none;max-height:0;overflow:hidden">${esc(e.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 32px;border-bottom:4px solid ${b.primary}">${logo}</td></tr>
<tr><td style="padding:32px 32px 8px">
<h1 style="margin:0 0 20px;font:700 28px/1.15 ${font};color:${b.ink}">${esc(e.heading)}</h1>
${p("Hi {$name|default:'there'},")}
${e.body.map(p).join('\n')}
${showsCode(c, e) ? `<table role="presentation" width="100%" style="margin:4px 0 20px"><tr><td align="center" style="border:2px dashed ${b.primary};border-radius:10px;padding:14px;font:700 13px Arial,sans-serif;letter-spacing:.12em;color:${b.ink}">YOUR CODE: <span style="font-size:20px;color:${b.primary}">${esc(c.discountCode)}</span></td></tr></table>` : ''}
${e.button && href ? `<table role="presentation" style="margin:8px 0 24px"><tr><td style="background:${b.primary};border-radius:999px"><a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font:700 14px Arial,sans-serif;color:#ffffff;text-decoration:none;letter-spacing:.06em;text-transform:uppercase">${esc(e.button)}</a></td></tr></table>` : ''}
${p(b.coach)}
${e.ps ? `<p style="margin:0 0 16px;font:italic 15px/1.6 Arial,sans-serif;color:#555">P.S. ${esc(e.ps)}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 32px;background:${b.secondary};font:12px/1.5 Arial,sans-serif;color:${b.ink}">${esc(b.name)} · <a href="{$unsubscribe}" style="color:${b.ink}">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
}
