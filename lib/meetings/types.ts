/** One call, from Google Meet's Gemini notes and/or transcript. */
export interface TranscriptLine {
  speaker: string;
  text: string;
  at?: string; // "00:12:40"
}

export interface Meeting {
  id: string;
  clientId: string | null; // null = not matched to a client yet
  title: string;
  startedAt: string; // ISO
  durationMins?: number;
  attendees: string[]; // emails, when known
  docUrl?: string;
  summary: string;
  details: string[];
  nextSteps: string[];
  transcript: TranscriptLine[];
  /** Clients see their calls unless the REPS team hides one. */
  visibleToClient: boolean;
  source: 'gemini' | 'pasted';
  /** Tasks have been pulled from this call (so it's only done once). */
  tasksFound?: boolean;
}

/** How a client actually talks, built from their calls. Used when writing their emails. */
export interface VoiceProfile {
  clientId: string;
  summary: string;
  traits: string[];
  phrases: string[]; // words and phrases they really use
  avoid: string[]; // things that would not sound like them
  meetingsUsed: number;
  updatedAt: string;
  by: 'claude' | 'rules' | 'reps';
}

/** The text of a voice profile for a writing brief. */
export function voiceForPrompt(v: VoiceProfile | null | undefined) {
  if (!v) return '';
  return [
    `How the coach actually speaks, from ${v.meetingsUsed} call transcript${v.meetingsUsed === 1 ? '' : 's'}: ${v.summary}`,
    v.traits.length ? `Traits: ${v.traits.join('; ')}.` : '',
    v.phrases.length ? `Words and phrases they use (use some naturally, do not overdo it): ${v.phrases.join(', ')}.` : '',
    v.avoid.length ? `Avoid: ${v.avoid.join('; ')}.` : '',
  ].filter(Boolean).join('\n');
}

export const fmtDuration = (m?: number) => (!m ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`);
