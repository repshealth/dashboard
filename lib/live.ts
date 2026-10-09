/**
 * Live mode is switched on by setting NEXT_PUBLIC_LIVE=true when the app is built
 * (a build variable in Cloudflare). Without it the dashboard runs on example data,
 * which is handy for a preview link before the database is set up.
 */
export const isLive = process.env.NEXT_PUBLIC_LIVE === 'true';
