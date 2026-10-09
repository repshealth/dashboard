import type { DocStore } from '../backend/store';
import type { Services } from '../backend/core';
import type { MailerLiteSettings } from '../emails/types';
import { claudeJson } from './claude';
import { writeCopy } from './write-copy';
import { writeLaunchEmails, writePreRegCopy } from './write-launch';
import { amendWithClaude } from './amend';
import { amendEmailsWithClaude } from './amend-emails';
import { addSubscriber, scheduleLaunch } from './mailerlite';
import { linkEmail, sendEmail, signInLink } from './auth';
import { setting } from './env';
import { VOICE_SCHEMA, VOICE_SYSTEM, voiceFromRules, voicePrompt } from '../meetings/voice';
import type { VoiceProfile } from '../meetings/types';
import { TASKS_SCHEMA, TASKS_SYSTEM, tasksFromNotes, tasksPrompt, toAssignee } from '../tasks/extract';

/** Production services: Claude for writing, MailerLite for scheduling, Resend for sign-in emails. */
export function liveServices(store: DocStore, origin: string): Services {
  const ml = (clientId: string) => store.get<MailerLiteSettings>('mailerlite', clientId);
  return {
    newId: () => crypto.randomUUID(),
    claude: Boolean(setting('ANTHROPIC_API_KEY')),
    writeSiteCopy: async (a) => {
      const r = await writeCopy(a);
      return { copy: r.copy, by: r.by };
    },
    writePreRegCopy,
    writeLaunchEmails,
    amendSite: amendWithClaude,
    amendEmails: amendEmailsWithClaude,
    async buildVoice(clientId, meetings, names, coach, brand, existing) {
      try {
        const out = await claudeJson<Pick<VoiceProfile, 'summary' | 'traits' | 'phrases' | 'avoid'>>(VOICE_SYSTEM, voicePrompt(meetings, coach, brand), VOICE_SCHEMA, 2500);
        if (out) return { ...out, clientId, meetingsUsed: meetings.length, updatedAt: new Date().toISOString(), by: 'claude' };
      } catch (e) {
        console.error('Voice profile with Claude failed, using rules:', e);
      }
      // A rules-only profile never replaces one from Claude or one the team edited.
      return existing && existing.by !== 'rules' ? null : voiceFromRules(clientId, meetings, names);
    },
    async findTasks(m, clientName, coach, names) {
      try {
        const out = await claudeJson<{ tasks: { title: string; detail: string; quote: string; who: string }[] }>(TASKS_SYSTEM, tasksPrompt(m, clientName, coach), TASKS_SCHEMA, 3000);
        if (out) return out.tasks.map((t) => ({ title: t.title, detail: t.detail, quote: t.quote, suggested: toAssignee(t.who) }));
      } catch (e) {
        console.error('Finding tasks with Claude failed, using the notes:', e);
      }
      return tasksFromNotes(m, names);
    },
    scheduleLaunch: async (c, emails) => scheduleLaunch(await ml(c.clientId), c, emails),
    addSubscriber: async (clientId, p) => addSubscriber(await ml(clientId), p),
    async sendInvite(u, clientName, what) {
      const link = await signInLink(store, origin, u.email, 7);
      const e = what === 'website'
        ? linkEmail(`Your ${clientName} website is ready to review`, 'The REPS team has your new website and pre-registration page ready. Open your dashboard to look through them, leave comments, and approve them when you are happy.', 'Open my dashboard', link)
        : linkEmail(`Your ${clientName} launch emails are ready to review`, 'Your 12 launch emails are ready. Open your dashboard to read them, leave comments on any line, and approve them when you are happy.', 'Review my emails', link);
      await sendEmail(u.email, what === 'website' ? 'Your website is ready to review' : 'Your launch emails are ready to review', e.html, e.text);
    },
  };
}
