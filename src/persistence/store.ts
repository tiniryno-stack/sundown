/**
 * Persistence (§18 item 7) — simple and swappable.
 *
 * The service depends only on the `Store` interface. Two adapters ship:
 *  - InMemoryStore  (default; fast, ephemeral; great for tests + the sim)
 *  - FileStore      (one JSON file per game under a data dir; durable)
 * A SQLite adapter could implement the same interface without touching callers.
 */

export interface Store<T> {
  save(id: string, value: T): Promise<void>;
  load(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
  list(): Promise<string[]>;
}

export class InMemoryStore<T> implements Store<T> {
  private readonly map = new Map<string, string>();

  async save(id: string, value: T): Promise<void> {
    // Store a JSON copy so callers can't mutate persisted state by reference.
    this.map.set(id, JSON.stringify(value));
  }
  async load(id: string): Promise<T | null> {
    const raw = this.map.get(id);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async list(): Promise<string[]> {
    return [...this.map.keys()];
  }
}
