import type { TranscriptLine } from './types';

/**
 * Reads the text of a Google Meet "Notes by Gemini" doc and/or its transcript.
 * Both are plain Google Docs. The notes have Summary, Details and Suggested next steps
 * sections; the transcript (its own doc, or a "Transcript" tab in the notes) is a run of
 * timestamps and "Name: what they said" lines. The parser is forgiving, so a pasted
 * transcript from anywhere with "Name: text" lines also works.
 */
export interface ParsedMeeting {
  title: string; // "Strong With Dani onboarding"
  startedAt: string | null; // from the doc title, when present
  summary: string;
  details: string[];
  nextSteps: string[];
  transcript: TranscriptLine[];
  durationMins?: number;
}

const HEADINGS: Record<string, 'summary' | 'details' | 'next' | 'transcript' | 'skip'> = {
  summary: 'summary',
  details: 'details',
  'suggested next steps': 'next',
  'next steps': 'next',
  'action items': 'next',
  transcript: 'transcript',
  notes: 'skip',
  attachments: 'skip',
  'meeting records': 'skip',
  invited: 'skip',
  attendees: 'skip',
};

const TIME = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
const SPEAKER = /^\s*([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,3})\s*:\s+(.+)$/;
const BULLET = /^\s*(?:[-*•●▪◦]|\[\s?[xX]?\s?\]|\d+[.)])\s*/;

/** "Strong With Dani onboarding - 2026/10/08 14:00 BST - Notes by Gemini" -> title and date. */
export function parseDocTitle(name: string) {
  const m = name.match(/^(.*?)\s*[-–]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})(?:\s*\S+)?\s*(?:[-–]\s*(?:Notes by Gemini|Transcript).*)?$/i);
  if (!m) return { title: name.replace(/\s*[-–]\s*(Notes by Gemini|Transcript)\s*$/i, '').trim(), startedAt: null as string | null };
  const [, t, y, mo, d, h, mi] = m;
  return { title: t.trim(), startedAt: `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:00` };
}

const toSecs = (t: string) => t.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);

export function parseMeetingText(text: string, docTitle = ''): ParsedMeeting {
  const { title, startedAt } = parseDocTitle(docTitle);
  const lines = text.replace(/\r/g, '').split('\n');
  let mode: 'summary' | 'details' | 'next' | 'transcript' | 'skip' | 'none' = 'none';
  const summary: string[] = [];
  const details: string[] = [];
  const nextSteps: string[] = [];
  const transcript: TranscriptLine[] = [];
  let at: string | undefined;
  let lastTime = 0;

  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ').trimEnd();
    const bare = line.replace(/^#+\s*/, '').replace(/[:\s]+$/, '').trim().toLowerCase();
    if (bare in HEADINGS && line.trim().length < 40) { mode = HEADINGS[bare]; continue; }
    if (!line.trim()) continue;

    const time = line.match(TIME);
    if (time) { at = time[1]; lastTime = Math.max(lastTime, toSecs(time[1])); if (mode === 'none') mode = 'transcript'; continue; }

    const said = line.match(SPEAKER);
    if (said && (mode === 'transcript' || mode === 'none')) {
      mode = 'transcript';
      transcript.push({ speaker: said[1].trim(), text: said[2].trim(), at });
      continue;
    }
    switch (mode) {
      case 'summary': summary.push(line.trim()); break;
      case 'details': details.push(line.replace(BULLET, '').trim()); break;
      case 'next': nextSteps.push(line.replace(BULLET, '').trim()); break;
      case 'transcript':
        // A line without a name carries on what the last speaker was saying.
        if (transcript.length) transcript[transcript.length - 1].text += ` ${line.trim()}`;
        break;
      default:
        if (!transcript.length && !summary.length && line.trim().length > 60) summary.push(line.trim());
    }
  }

  return {
    title: title || 'Call',
    startedAt,
    summary: summary.join(' ').trim(),
    details: details.filter(Boolean),
    nextSteps: nextSteps.filter(Boolean),
    transcript,
    durationMins: lastTime ? Math.max(1, Math.round(lastTime / 60)) : undefined,
  };
}

/** Same call from two docs (notes and transcript) -> one key. */
export const meetingKey = (title: string, startedAt: string) => `${title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${startedAt.slice(0, 13)}`;
