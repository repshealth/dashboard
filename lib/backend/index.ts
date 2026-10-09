import { isLive } from '../live';
import { demoBackend } from './demo';
import { liveBackend } from './live';
import type { Backend } from './types';

/** Live mode (Cloudflare D1 through /api/rpc) when NEXT_PUBLIC_LIVE=true, otherwise the example data. */
export const backend: Backend = isLive ? liveBackend : demoBackend;

export type { Backend, NewComment, NewEmailComment, LaunchSettings, Submission } from './types';
