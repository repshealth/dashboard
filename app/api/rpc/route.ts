import { context, errorReply } from '@/lib/server/backend';
import type { Backend } from '@/lib/backend/types';

// Writing a site or 12 emails with Claude can take a couple of minutes.
export const maxDuration = 300;

/** Every dashboard action the browser can call. Each one checks who is asking (lib/backend/core.ts). */
const METHODS = new Set<keyof Backend>([
  'getViewer', 'listClients', 'listLeads', 'moveLead', 'saveNotes',
  'getSite', 'addComment', 'setCommentResolved', 'approveSite', 'submitOnboarding', 'sendSiteToClient',
  'listAllLeads', 'listSites', 'requestChanges', 'approveVersion', 'rejectVersion', 'listSubmissions',
  'getEmails', 'listEmailCampaigns', 'addEmailComment', 'setEmailCommentResolved', 'sendEmailsToClient',
  'requestEmailChanges', 'approveEmails', 'scheduleEmails', 'approveEmailVersion', 'rejectEmailVersion',
  'saveEmailEdits', 'saveLaunchSettings', 'getMailerLite', 'saveMailerLite', 'rewriteEmails',
  'listMeetings', 'addMeeting', 'updateMeeting', 'deleteMeeting', 'getVoice', 'refreshVoice', 'saveVoice',
]);

/**
 * POST /api/rpc  { method: "listLeads", args: ["client-id"] }
 * The browser's live backend (lib/backend/live.ts) sends every call here.
 */
export async function POST(req: Request) {
  try {
    const { method, args } = (await req.json()) as { method: keyof Backend; args: unknown[] };
    if (!METHODS.has(method) || !Array.isArray(args)) return Response.json({ error: 'Unknown action.' }, { status: 400 });
    const { backend } = context(req);
    const fn = backend[method] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn(...args);
    return Response.json({ result: result ?? null });
  } catch (e) {
    return errorReply(e);
  }
}
