import type { DocMeta, DocStore, Kind } from '../backend/store';
import type { D1Database } from './env';

interface Row { id: string; data: string; rev: number; client_id: string | null; key: string | null; sort: string | null }

/**
 * Stores every document in one D1 table (see migrations/0001_init.sql):
 *   docs(kind, id, client_id, key, sort, rev, data)
 * `rev` goes up on every save, so two people changing the same thing at once
 * never overwrite each other (see mutate).
 */
const SCHEMA = [
  `create table if not exists docs (kind text not null, id text not null, client_id text, key text, sort text,
   rev integer not null default 1, data text not null, primary key (kind, id))`,
  'create index if not exists docs_by_client on docs (kind, client_id, sort)',
  'create unique index if not exists docs_by_key on docs (kind, key) where key is not null',
];
// Workers can't share a promise between requests, so each request checks once until it has worked.
let schemaReady = false;

export class D1Store implements DocStore {
  private db: D1Database;
  constructor(db: D1Database) {
    // The table is created the first time the app runs, so a new database needs no setup.
    const wait = schemaReady ? Promise.resolve() : (async () => {
      for (const q of SCHEMA) await db.prepare(q).run();
      schemaReady = true;
    })();
    wait.catch(() => {});
    this.db = { prepare: (q: string) => lazy(wait, db, q) };
  }

  async get<T>(kind: Kind, id: string) {
    const r = await this.db.prepare('select data from docs where kind = ? and id = ?').bind(kind, id).first<{ data: string }>();
    return r ? (JSON.parse(r.data) as T) : null;
  }

  async byKey<T>(kind: Kind, key: string) {
    const r = await this.db.prepare('select id, data from docs where kind = ? and key = ?').bind(kind, key).first<{ id: string; data: string }>();
    return r ? { id: r.id, doc: JSON.parse(r.data) as T } : null;
  }

  async list<T>(kind: Kind, opts: { clientId?: string | null; limit?: number } = {}) {
    let q = 'select data from docs where kind = ?';
    const args: unknown[] = [kind];
    if (opts.clientId === null) q += ' and client_id is null';
    else if (opts.clientId !== undefined) { q += ' and client_id = ?'; args.push(opts.clientId); }
    q += ' order by sort desc';
    if (opts.limit) { q += ' limit ?'; args.push(opts.limit); }
    const { results } = await this.db.prepare(q).bind(...args).all<{ data: string }>();
    return results.map((r) => JSON.parse(r.data) as T);
  }

  async put<T>(kind: Kind, id: string, doc: T, meta: DocMeta = {}) {
    await this.db.prepare(
      `insert into docs (kind, id, client_id, key, sort, rev, data) values (?, ?, ?, ?, ?, 1, ?)
       on conflict (kind, id) do update set client_id = excluded.client_id, key = excluded.key, sort = excluded.sort,
       data = excluded.data, rev = docs.rev + 1`,
    ).bind(kind, id, meta.clientId ?? null, meta.key ?? null, meta.sort ?? null, JSON.stringify(doc)).run();
  }

  async del(kind: Kind, id: string) {
    await this.db.prepare('delete from docs where kind = ? and id = ?').bind(kind, id).run();
  }

  async mutate<T>(kind: Kind, id: string, fn: (doc: T) => void, meta?: (doc: T) => DocMeta) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = await this.db.prepare('select * from docs where kind = ? and id = ?').bind(kind, id).first<Row>();
      if (!r) return null;
      const doc = JSON.parse(r.data) as T;
      fn(doc);
      const m = meta ? meta(doc) : { clientId: r.client_id, key: r.key, sort: r.sort };
      const res = await this.db.prepare(
        'update docs set data = ?, client_id = ?, key = ?, sort = ?, rev = rev + 1 where kind = ? and id = ? and rev = ?',
      ).bind(JSON.stringify(doc), m.clientId ?? null, m.key ?? null, m.sort ?? null, kind, id, r.rev).run();
      if (res.meta.changes === 1) return doc;
      // Someone else saved it in between: try again on the newer copy.
    }
    throw new Error('This was being changed by someone else at the same time. Please try again.');
  }
}

/** A statement that waits for the table to exist before running. */
function lazy(wait: Promise<void>, db: D1Database, q: string, args: unknown[] = []): import('./env').D1Statement {
  const go = async () => { await wait; return db.prepare(q).bind(...args); };
  return {
    bind: (...v: unknown[]) => lazy(wait, db, q, v),
    first: async <T,>() => (await go()).first<T>(),
    all: async <T,>() => (await go()).all<T>(),
    run: async () => (await go()).run(),
  };
}
