import type { Meeting } from '../meetings/types';
import type { Assignee, FoundTask } from './types';

const WHO = ['sam', 'alyza', 'james', 'client', 'ai', 'unsure'] as const;

export const TASKS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tasks: {
      type: 'array',
      description: 'Every concrete action agreed or clearly needed from this call. Usually 2 to 8.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'Short action starting with a verb, e.g. "Send the beach shoot photos"' },
          detail: { type: 'string', description: 'One sentence of context, or empty' },
          quote: { type: 'string', description: 'The words from the notes or transcript this comes from, copied exactly and kept short' },
          who: { type: 'string', enum: [...WHO], description: 'Who it is for: a REPS team member by name, the client (the coach), "ai" for writing or admin work an AI could do, or "unsure"' },
        },
        required: ['title', 'detail', 'quote', 'who'],
      },
    },
  },
  required: ['tasks'],
} as const;

export const TASKS_SYSTEM = `You turn notes and transcripts of calls between REPS (a fitness marketing agency) and one of its clients (a coach) into a clear task list.
The REPS team is Sam, Alyza and James. The client is the coach named in the brief.
Only include real actions someone agreed to or clearly needs to do. Skip small talk and things already done on the call.
Keep each title short and practical. British English. No em dashes.`;

export function tasksPrompt(m: Meeting, client: string, coach: string) {
  return [
    `Client: ${client}. The coach is ${coach}.`,
    `Call: ${m.title} (${m.startedAt.slice(0, 10)})`,
    m.summary ? `Summary: ${m.summary}` : '',
    m.details.length ? `Details:\n${m.details.map((d) => `- ${d}`).join('\n')}` : '',
    m.nextSteps.length ? `Suggested next steps from the notes:\n${m.nextSteps.map((d) => `- ${d}`).join('\n')}` : '',
    m.transcript.length ? `Transcript:\n${m.transcript.map((l) => `${l.speaker}: ${l.text}`).join('\n').slice(0, 60000)}` : '',
  ].filter(Boolean).join('\n\n');
}

export const toAssignee = (who: string): Assignee | null => (['sam', 'alyza', 'james', 'client', 'ai'].includes(who) ? (who as Assignee) : null);

/** Who a line like "Dani will send the photos" is for. */
export function guessAssignee(line: string, clientNames: string[]): Assignee | null {
  const l = line.toLowerCase();
  for (const n of ['sam', 'alyza', 'james'] as const) if (new RegExp(`\\b${n}\\b`).test(l)) return n;
  if (clientNames.some((n) => n && new RegExp(`\\b${n.toLowerCase().split(/\s+/)[0]}\\b`).test(l))) return 'client';
  if (/\b(the client|client will)\b/.test(l)) return 'client';
  return null;
}

/** "Dani will send the beach shoot photos by Monday." -> "Send the beach shoot photos by Monday" */
function asAction(line: string) {
  const t = line.replace(/^\s*\[\s?\]\s*/, '').replace(/\.$/, '').trim();
  const m = t.match(/^[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?\s+(?:will|to|should|needs to|is going to)\s+(.+)$/);
  const out = m ? m[1] : t;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Tasks from Gemini's "Suggested next steps", for when Claude isn't connected. */
export function tasksFromNotes(m: Meeting, clientNames: string[]): FoundTask[] {
  return m.nextSteps.map((s) => ({ title: asAction(s), detail: '', quote: s, suggested: guessAssignee(s, clientNames) }));
}
