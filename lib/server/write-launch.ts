import { claudeJson } from './claude';
import { answersForPrompt } from '../site/copy';
import { launchOf, type OnboardingAnswers } from '../site/onboarding';
import { PREREG_SCHEMA, PREREG_SYSTEM, fallbackPreRegCopy, type PreRegCopy } from '../site/prereg';
import { EMAILS_SCHEMA, EMAILS_SYSTEM, emailsPrompt, fallbackEmails, toEmails, type EmailCopy } from '../emails/copy';
import { fmtLaunch, sequenceSlots } from '../emails/schedule';
import type { EmailListId, LaunchEmail } from '../emails/types';

/** Pre-registration page copy, written by Claude, with the fallback filling any gaps. */
export async function writePreRegCopy(a: OnboardingAnswers): Promise<{ copy: PreRegCopy; by: 'claude' | 'template' }> {
  const fallback = fallbackPreRegCopy(a);
  try {
    const l = launchOf(a);
    const out = await claudeJson<PreRegCopy>(
      PREREG_SYSTEM,
      `Write the pre-registration page for this coach's app.\n\n${answersForPrompt(a)}\nLaunch date: ${fmtLaunch(l.date) || 'to be confirmed'}.\nPre-registration offer: ${l.offer || 'none, early access only'}.`,
      PREREG_SCHEMA,
      3000,
    );
    if (!out) return { copy: fallback, by: 'template' };
    const merged = { ...fallback } as PreRegCopy;
    for (const k of Object.keys(fallback) as (keyof PreRegCopy)[]) {
      const v = out[k];
      if (typeof v === 'string' ? v.trim() : Array.isArray(v) && v.length) (merged as unknown as Record<string, unknown>)[k] = v;
    }
    if (merged.benefits.length < 3) merged.benefits = [...merged.benefits, ...fallback.benefits].slice(0, 3);
    return { copy: merged, by: 'claude' };
  } catch (e) {
    console.error('writePreRegCopy failed, using fallback:', e);
    return { copy: fallback, by: 'template' };
  }
}

/** Both 6-email launch sequences, written by Claude in the coach's tone. */
export async function writeLaunchEmails(a: OnboardingAnswers, voice = ''): Promise<{ emails: LaunchEmail[]; by: 'claude' | 'template' }> {
  const fallback = fallbackEmails(a);
  const slots = sequenceSlots(launchOf(a).offerDays);
  try {
    const out = await claudeJson<Record<EmailListId, EmailCopy[]>>(EMAILS_SYSTEM, emailsPrompt(a, voice), EMAILS_SCHEMA, 12000);
    if (!out) return { emails: toEmails(fallback, slots, fallback), by: 'template' };
    return { emails: toEmails(out, slots, fallback), by: 'claude' };
  } catch (e) {
    console.error('writeLaunchEmails failed, using fallback:', e);
    return { emails: toEmails(fallback, slots, fallback), by: 'template' };
  }
}
