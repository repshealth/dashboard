/**
 * Password hashing with PBKDF2-SHA256 (Web Crypto), which runs the same in a Cloudflare Worker
 * and in the browser preview. Only the salted hash is stored, as "pbkdf2$<iterations>$<salt>$<hash>".
 * 100,000 rounds is the most a Cloudflare Worker allows.
 */
const ROUNDS = 100_000;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, rounds: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: rounds }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ROUNDS}$${b64(salt)}$${b64(await derive(password, salt, ROUNDS))}`;
}

/** Compares in constant time so the reply time gives nothing away. */
export const sameText = (a: string, b: string) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
};

export async function verifyPassword(password: string, stored?: string) {
  const [kind, rounds, salt, hash] = (stored || '').split('$');
  if (kind !== 'pbkdf2' || !salt || !hash) return false;
  const got = await derive(password, unb64(salt), Number(rounds) || ROUNDS);
  return sameText(b64(got), hash);
}

/** At least 10 characters: long beats complicated. */
export const passwordProblem = (p: string) => (p.length < 10 ? 'Passwords need at least 10 characters.' : p.length > 200 ? 'That password is too long.' : null);

/** A readable random password, e.g. "maple-orbit-7425-river". */
export function makePassword() {
  const words = ['maple', 'orbit', 'river', 'cedar', 'falcon', 'harbor', 'lumen', 'meadow', 'summit', 'velvet', 'ember', 'quartz', 'tidal', 'willow', 'atlas', 'comet', 'delta', 'glacier', 'nova', 'prism'];
  const r = crypto.getRandomValues(new Uint32Array(4));
  return `${words[r[0] % words.length]}-${words[r[1] % words.length]}-${1000 + (r[2] % 9000)}-${words[r[3] % words.length]}`;
}
