import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

/**
 * Durable state for the API. Every collection is an in-memory Map (so the contract logic stays
 * simple and synchronous) backed by one table of JSON documents. Commands mutate the maps inside
 * the API's serialized command queue, then `await flush()` writes every changed or deleted document
 * in one transaction before the response is sent (and before any PayPal call whose request ID it
 * records). On boot the maps are reloaded from the table.
 *
 * Two backends, same table and semantics:
 *  - `PgStore`: Postgres (Neon) when DATABASE_URL is set. Survives restarts and redeploys.
 *  - `Store`: SQLite for tests and local dev (':memory:' or a file).
 * Single API process by design (one Render instance), so the in-memory maps are the only writer.
 */
export class Collection<V> extends Map<string, V> {
  saved = new Map<string, string>();
  removed = new Set<string>();
  constructor(readonly kind: string) { super(); }
  override delete(key: string): boolean {
    if (this.saved.has(key)) this.removed.add(key);
    return super.delete(key);
  }
}

export interface DocStore {
  collection<V>(kind: string): Collection<V>;
  /** Persist every changed document in one transaction. Resolves once it is durable. */
  flush(): Promise<void>;
  close(): void | Promise<void>;
}

type Row = { kind: string; id: string; json: string };
type Pending = { writes: Row[]; deletes: { kind: string; id: string }[] };

/** Change tracking shared by both backends: a document is written when its JSON differs from what was last saved. */
abstract class DocStoreBase implements DocStore {
  protected collections: Collection<any>[] = [];
  protected abstract load(kind: string): Row[];

  collection<V>(kind: string): Collection<V> {
    const c = new Collection<V>(kind);
    for (const row of this.load(kind)) {
      Map.prototype.set.call(c, row.id, JSON.parse(row.json));
      c.saved.set(row.id, row.json);
    }
    this.collections.push(c);
    return c;
  }

  /** Snapshot what needs writing now. The JSON captured here is what gets marked saved after commit. */
  protected pending(): Pending {
    const writes: Row[] = [];
    const deletes: { kind: string; id: string }[] = [];
    for (const c of this.collections) {
      for (const [id, value] of c) {
        const json = JSON.stringify(value);
        if (c.saved.get(id) !== json) writes.push({ kind: c.kind, id, json });
      }
      for (const id of c.removed) if (!c.has(id)) deletes.push({ kind: c.kind, id });
    }
    return { writes, deletes };
  }

  /** After a commit: record exactly what was written, so changes made during an async commit still count as dirty. */
  protected committed({ writes, deletes }: Pending) {
    const byKind = new Map(this.collections.map(c => [c.kind, c]));
    for (const w of writes) byKind.get(w.kind)?.saved.set(w.id, w.json);
    for (const d of deletes) {
      const c = byKind.get(d.kind);
      if (!c) continue;
      c.saved.delete(d.id);
      c.removed.delete(d.id);
    }
  }

  abstract flush(): Promise<void>;
  abstract close(): void | Promise<void>;
}

/** SQLite: tests and local development. */
export class Store extends DocStoreBase {
  private db: Database.Database;
  private upsert: Database.Statement;
  private remove: Database.Statement;

  constructor(path: string) {
    super();
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS docs (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (kind, id)) WITHOUT ROWID');
    this.upsert = this.db.prepare('INSERT INTO docs (kind, id, json) VALUES (?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET json = excluded.json');
    this.remove = this.db.prepare('DELETE FROM docs WHERE kind = ? AND id = ?');
  }

  protected load(kind: string): Row[] {
    return this.db.prepare('SELECT kind, id, json FROM docs WHERE kind = ?').all(kind) as Row[];
  }

  /** Synchronous under the hood: durable by the time the returned promise exists. */
  flush(): Promise<void> {
    const p = this.pending();
    if (!p.writes.length && !p.deletes.length) return Promise.resolve();
    this.db.transaction(() => {
      for (const w of p.writes) this.upsert.run(w.kind, w.id, w.json);
      for (const d of p.deletes) this.remove.run(d.kind, d.id);
    })();
    this.committed(p);
    return Promise.resolve();
  }

  close() { this.db.close(); }
}

// Schema as code. JSON is kept as TEXT (not JSONB) so the stored string round-trips byte for byte,
// which is what change tracking compares against.
const SCHEMA = 'CREATE TABLE IF NOT EXISTS docs (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (kind, id))';

/**
 * Postgres (Neon) via node-postgres: a long-running server reuses one small pool. The app uses the
 * pooled connection string; the schema statement runs over the direct (unpooled) one when given.
 */
export class PgStore extends DocStoreBase {
  private chain: Promise<void> = Promise.resolve();

  private constructor(private pool: pg.Pool, private rows: Map<string, Row[]>) { super(); }

  static async open(url: string, directUrl?: string): Promise<PgStore> {
    if (directUrl) {
      const direct = new pg.Client({ connectionString: directUrl, connectionTimeoutMillis: 20_000 });
      await direct.connect();
      try { await direct.query(SCHEMA); } finally { await direct.end(); }
    }
    const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 20_000 });
    pool.on('error', e => console.error('[store] idle client error', e.message));
    if (!directUrl) await pool.query(SCHEMA);
    const all = (await pool.query<Row>('SELECT kind, id, json FROM docs')).rows;
    const rows = new Map<string, Row[]>();
    for (const r of all) rows.set(r.kind, [...(rows.get(r.kind) ?? []), r]);
    return new PgStore(pool, rows);
  }

  protected load(kind: string): Row[] {
    const r = this.rows.get(kind) ?? [];
    this.rows.delete(kind); // the collection owns these from now on
    return r;
  }

  /** Flushes run one after another, in call order; a failed flush rejects its caller but doesn't block later ones. */
  flush(): Promise<void> {
    const next = this.chain.catch(() => {}).then(() => this.write());
    this.chain = next;
    return next;
  }

  private async write() {
    const p = this.pending();
    if (!p.writes.length && !p.deletes.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (p.writes.length) {
        await client.query(
          `INSERT INTO docs (kind, id, json)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
           ON CONFLICT (kind, id) DO UPDATE SET json = EXCLUDED.json`,
          [p.writes.map(w => w.kind), p.writes.map(w => w.id), p.writes.map(w => w.json)]);
      }
      for (const d of p.deletes) await client.query('DELETE FROM docs WHERE kind = $1 AND id = $2', [d.kind, d.id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    this.committed(p);
  }

  async close() {
    await this.chain.catch(() => {});
    await this.pool.end();
  }
}
