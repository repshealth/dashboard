/**
 * Where the dashboard keeps its data. Everything is stored as JSON documents of a few
 * kinds (client, lead, site, campaign, meeting, ...), each with optional index fields.
 *
 *   MemoryStore   example data in the browser (preview and example mode)
 *   D1Store       Cloudflare D1 in production (lib/server/d1-store.ts)
 *
 * The business logic in core.ts only ever talks to this interface.
 */
export type Kind =
  | 'client' | 'lead' | 'site' | 'campaign' | 'submission'
  | 'meeting' | 'meetingdoc' | 'voice' | 'mailerlite'
  | 'user' | 'session' | 'token';

export interface DocMeta {
  /** Which client the document belongs to, for listing and access. */
  clientId?: string | null;
  /** A unique lookup value within the kind, e.g. a client's slug or a user's email. */
  key?: string | null;
  /** Lists come back newest first by this value (usually an ISO date). */
  sort?: string | null;
}

export interface DocStore {
  get<T>(kind: Kind, id: string): Promise<T | null>;
  byKey<T>(kind: Kind, key: string): Promise<{ id: string; doc: T } | null>;
  /** clientId: undefined = every document of the kind, null = only ones with no client. */
  list<T>(kind: Kind, opts?: { clientId?: string | null; limit?: number }): Promise<T[]>;
  put<T>(kind: Kind, id: string, doc: T, meta?: DocMeta): Promise<void>;
  del(kind: Kind, id: string): Promise<void>;
  /**
   * Read, change and save one document safely: if someone else saved it in between,
   * the change is re-applied to the newer copy. Returns null when it doesn't exist.
   */
  mutate<T>(kind: Kind, id: string, fn: (doc: T) => void, meta?: (doc: T) => DocMeta): Promise<T | null>;
}

const clone = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

/** Keeps everything in memory. Used for the example data. */
export class MemoryStore implements DocStore {
  private data = new Map<string, Map<string, { doc: unknown; meta: DocMeta }>>();
  private bucket(kind: Kind) {
    if (!this.data.has(kind)) this.data.set(kind, new Map());
    return this.data.get(kind)!;
  }
  async get<T>(kind: Kind, id: string) {
    const r = this.bucket(kind).get(id);
    return r ? clone(r.doc as T) : null;
  }
  async byKey<T>(kind: Kind, key: string) {
    for (const [id, r] of this.bucket(kind)) if (r.meta.key === key) return { id, doc: clone(r.doc as T) };
    return null;
  }
  async list<T>(kind: Kind, opts: { clientId?: string | null; limit?: number } = {}) {
    const rows = [...this.bucket(kind).values()]
      .filter((r) => opts.clientId === undefined || (r.meta.clientId ?? null) === opts.clientId)
      .sort((a, b) => ((a.meta.sort ?? '') < (b.meta.sort ?? '') ? 1 : -1));
    return rows.slice(0, opts.limit ?? rows.length).map((r) => clone(r.doc as T));
  }
  async put<T>(kind: Kind, id: string, doc: T, meta: DocMeta = {}) {
    this.bucket(kind).set(id, { doc: clone(doc), meta: { ...meta } });
  }
  async del(kind: Kind, id: string) {
    this.bucket(kind).delete(id);
  }
  async mutate<T>(kind: Kind, id: string, fn: (doc: T) => void, meta?: (doc: T) => DocMeta) {
    const r = this.bucket(kind).get(id);
    if (!r) return null;
    const doc = clone(r.doc as T);
    fn(doc);
    this.bucket(kind).set(id, { doc: clone(doc), meta: meta ? meta(doc) : r.meta });
    return doc;
  }
}
