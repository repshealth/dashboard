import { getCloudflareContext } from '@opennextjs/cloudflare';

/* Minimal types for the Cloudflare bindings this app uses. */
export interface D1Result<T> { results: T[]; meta: { changes: number } }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}
export interface D1Database { prepare(query: string): D1Statement }
export interface R2Object { body: ReadableStream; httpMetadata?: { contentType?: string } }
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
}

interface Bindings {
  DB?: D1Database;
  UPLOADS?: R2Bucket;
  [name: string]: unknown;
}

/** The Worker's bindings (D1, R2) and secrets. Empty when running outside Cloudflare. */
export function cf(): Bindings {
  try {
    return getCloudflareContext().env as unknown as Bindings;
  } catch {
    return {};
  }
}

/** A setting or secret, from the Cloudflare dashboard (or .dev.vars locally). */
export function setting(name: string): string {
  const v = cf()[name] ?? process.env[name];
  return typeof v === 'string' ? v : '';
}

export const list = (name: string) => setting(name).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
