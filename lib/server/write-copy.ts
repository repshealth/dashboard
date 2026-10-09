import { setting } from './env';
import { COPY_SCHEMA, COPY_SYSTEM, answersForPrompt, fallbackCopy, type SiteCopy } from '../site/copy';
import type { OnboardingAnswers } from '../site/onboarding';

/**
 * Writes the website copy with Claude, using JSON-schema output so the reply always
 * matches SiteCopy. Falls back to the built-in sentence patterns if no API key is set
 * or the call fails, so a submission never gets stuck.
 */
export async function writeCopy(a: OnboardingAnswers): Promise<{ copy: SiteCopy; by: 'claude' | 'template'; error?: string }> {
  const fallback = fallbackCopy(a);
  const key = setting('ANTHROPIC_API_KEY');
  if (!key) return { copy: fallback, by: 'template' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: setting('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
        max_tokens: 6000,
        system: COPY_SYSTEM,
        messages: [{ role: 'user', content: `Write the website copy for this coach.\n\n${answersForPrompt(a)}` }],
        output_config: { format: { type: 'json_schema', schema: COPY_SCHEMA } },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Claude API returned ${res.status}`);
    if (data.stop_reason !== 'end_turn') throw new Error(`Claude stopped early (${data.stop_reason})`);
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text;
    const parsed = JSON.parse(text) as Partial<SiteCopy>;

    // Keep any field Claude left empty from the fallback, and make sure lists have enough items.
    const merged = { ...fallback } as SiteCopy;
    for (const k of Object.keys(fallback) as (keyof SiteCopy)[]) {
      const v = parsed[k];
      if (typeof v === 'string' ? v.trim() : Array.isArray(v) && v.length) (merged as unknown as Record<string, unknown>)[k] = v;
    }
    if (merged.features.length < 6) merged.features = [...merged.features, ...fallback.features].slice(0, 6);
    return { copy: merged, by: 'claude' };
  } catch (e) {
    console.error('writeCopy failed, using fallback copy:', e);
    return { copy: fallback, by: 'template', error: e instanceof Error ? e.message : String(e) };
  }
}
