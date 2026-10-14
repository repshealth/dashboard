/**
 * The deployed dashboard always runs live: real logins and data in Cloudflare D1.
 * Only the single-file preview (npm run preview, GitHub Pages) uses example data; it's built
 * with NEXT_PUBLIC_LIVE=false. Set that yourself to try example data with `npm run dev`.
 */
export const isLive = process.env.NEXT_PUBLIC_LIVE !== 'false';
