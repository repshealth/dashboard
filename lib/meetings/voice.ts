import type { Meeting, VoiceProfile } from './types';

const str = (description: string) => ({ type: 'string', description });
const list = (description: string) => ({ type: 'array', items: { type: 'string' }, description });

export const VOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: str('Two or three sentences on how this coach talks: energy, warmth, directness, humour, how they address their audience'),
    traits: list('4 to 6 short traits, e.g. "Short sentences, gets to the point"'),
    phrases: list('6 to 12 words or short phrases they actually said and repeat, copied exactly from the transcript'),
    avoid: list('3 to 5 things that would not sound like them, e.g. "Corporate words like leverage"'),
  },
  required: ['summary', 'traits', 'phrases', 'avoid'],
} as const;

export const VOICE_SYSTEM = `You study call transcripts between a fitness coach (the client) and their marketing agency, REPS.
Describe how the coach speaks, so their emails can be written in their voice. Only describe the coach, never the REPS team.
Base everything on what they actually said. Quote phrases exactly. British English. No em dashes.`;

/** Lines spoken by the client: anyone whose name matches the coach's, or failing that, anyone not on the REPS team. */
export function clientLines(meetings: Meeting[], names: string[], repsNames: string[] = []) {
  const firsts = names.map((n) => n.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const reps = repsNames.map((n) => n.toLowerCase());
  const lines = meetings.flatMap((m) => m.transcript);
  const theirs = lines.filter((l) => firsts.includes(l.speaker.split(/\s+/)[0].toLowerCase()));
  return theirs.length ? theirs : lines.filter((l) => !reps.some((r) => l.speaker.toLowerCase().includes(r)));
}

/** The brief sent to Claude: the transcripts, newest first, trimmed to a sensible size. */
export function voicePrompt(meetings: Meeting[], coach: string, brand: string) {
  const parts: string[] = [`The coach is ${coach}, of ${brand}. Describe how ${coach} speaks.`, ''];
  let size = 0;
  for (const m of meetings) {
    const body = m.transcript.map((l) => `${l.speaker}: ${l.text}`).join('\n');
    if (!body) continue;
    if (size + body.length > 120000) break;
    size += body.length;
    parts.push(`CALL: ${m.title} (${m.startedAt.slice(0, 10)})`, body, '');
  }
  return parts.join('\n');
}

const NUMBERS = new Set('one two three four five six seven eight nine ten twenty thirty forty fifty hundred first second third percent'.split(' '));
const STOP = new Set('the a an and or but so to of in on at for with is it its it\'s i i\'m im you your we our they them that this was be are have has had do does did not just like um uh yeah yes no oh ok okay really very get got go going can will would could what when how if then there their about from as me my'.split(' '));

/** A simple profile without Claude: the client's most repeated phrases and sentence length. */
export function voiceFromRules(clientId: string, meetings: Meeting[], names: string[]): VoiceProfile {
  const lines = clientLines(meetings, names);
  const text = lines.map((l) => l.text).join(' ');
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  const words = text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const g = words.slice(i, i + n);
      if (STOP.has(g[0]) || STOP.has(g[n - 1]) || g.some((w) => NUMBERS.has(w))) continue;
      const k = g.join(' ');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const phrases = [...counts.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).map(([k]) => k)
    .filter((k, i, arr) => !arr.slice(0, i).some((p) => p.includes(k) || k.includes(p))).slice(0, 10);
  const avg = sentences.length ? Math.round(words.length / sentences.length) : 0;
  return {
    clientId,
    summary: lines.length
      ? `Built from ${lines.length} things ${names[0] || 'the client'} said across ${meetings.length} call${meetings.length === 1 ? '' : 's'}. Connect Claude for a full description of their tone.`
      : 'No transcript lines from the client yet.',
    traits: avg ? [avg <= 12 ? 'Short, punchy sentences' : avg <= 20 ? 'Medium-length, conversational sentences' : 'Long, flowing sentences'] : [],
    phrases,
    avoid: [],
    meetingsUsed: meetings.length,
    updatedAt: new Date().toISOString(),
    by: 'rules',
  };
}
