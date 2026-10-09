import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// Lets `npm run dev` use the local D1 database and R2 bucket from wrangler.jsonc.
initOpenNextCloudflareForDev();
