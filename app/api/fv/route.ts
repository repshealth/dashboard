/**
 * POST /api/fv  The same as /api/track under a plainer name, which ad blockers leave alone.
 * New tracking snippets send here; older ones still post to /api/track.
 */
export { OPTIONS, POST } from '../track/route';
