import { setting } from './env';
/**
 * One structured call to the Claude API: the reply always matches `schema`.
 * Returns null without an API key; throws if the call fails, so callers can fall back.
 */
export async function claudeJson<T>(system: string, user: string, schema: object, maxTokens = 6000): Promise<T | null> {
  const key = setting('ANTHROPIC_API_KEY');
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: setting('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema } },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Claude API returned ${res.status}`);
  if (data.stop_reason !== 'end_turn') throw new Error(`Claude stopped early (${data.stop_reason})`);
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text;
  return JSON.parse(text) as T;
}
