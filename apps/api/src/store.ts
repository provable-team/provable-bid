import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Durable state for the API. Every collection is an in-memory Map (so the contract logic stays
 * simple and synchronous) backed by one SQLite table of JSON documents. Commands mutate the maps
 * inside the API's serialized command queue, then `flush()` writes every changed or deleted
 * document in one transaction before the response is sent. On boot, `open()` reloads the maps.
 * Single process by design (one Render instance); the SQLite file survives process restarts.
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

export class Store {
  private db: Database.Database;
  private collections: Collection<any>[] = [];
  private upsert: Database.Statement;
  private remove: Database.Statement;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec('CREATE TABLE IF NOT EXISTS docs (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (kind, id)) WITHOUT ROWID');
    this.upsert = this.db.prepare('INSERT INTO docs (kind, id, json) VALUES (?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET json = excluded.json');
    this.remove = this.db.prepare('DELETE FROM docs WHERE kind = ? AND id = ?');
  }

  collection<V>(kind: string): Collection<V> {
    const c = new Collection<V>(kind);
    for (const row of this.db.prepare('SELECT id, json FROM docs WHERE kind = ?').all(kind) as { id: string; json: string }[]) {
      Map.prototype.set.call(c, row.id, JSON.parse(row.json));
      c.saved.set(row.id, row.json);
    }
    this.collections.push(c);
    return c;
  }

  /** Persist every changed document. Cheap at demo scale: unchanged documents are skipped by string compare. */
  flush() {
    const writes: [string, string, string][] = [];
    const deletes: [string, string][] = [];
    for (const c of this.collections) {
      for (const [id, value] of c) {
        const json = JSON.stringify(value);
        if (c.saved.get(id) !== json) writes.push([c.kind, id, json]);
      }
      for (const id of c.removed) if (!c.has(id)) deletes.push([c.kind, id]);
    }
    if (!writes.length && !deletes.length) return;
    this.db.transaction(() => {
      for (const w of writes) this.upsert.run(...w);
      for (const d of deletes) this.remove.run(...d);
    })();
    for (const c of this.collections) {
      for (const [id] of writes.filter(w => w[0] === c.kind).map(w => [w[1]])) c.saved.set(id, JSON.stringify(c.get(id)));
      for (const id of c.removed) { c.saved.delete(id); }
      c.removed.clear();
    }
  }

  close() { this.db.close(); }
}
