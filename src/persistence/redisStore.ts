/**
 * Upstash Redis-backed Store adapter: one Redis key per id, plus a SET of ids.
 * Durable across container restarts (unlike FileStore on ephemeral filesystems).
 * Swappable with InMemoryStore and FileStore behind `Store<T>`.
 *
 * Uses Upstash's REST client, which works in any runtime (no TCP socket needed).
 */

import { Redis } from "@upstash/redis";
import type { Store } from "./store.js";

const RECORD_PREFIX = "sundown:game:";
const INDEX_KEY = "sundown:games";

/** Key layout for one kind of record. Defaults to games; the waitlist uses its own. */
export type RedisNamespace = { recordPrefix: string; indexKey: string };

export class RedisStore<T> implements Store<T> {
  private readonly redis: Redis;
  private readonly ns: RedisNamespace;

  constructor(url?: string, token?: string, ns: RedisNamespace = { recordPrefix: RECORD_PREFIX, indexKey: INDEX_KEY }) {
    this.ns = ns;
    const restUrl = url ?? process.env.UPSTASH_REDIS_REST_URL;
    const restToken = token ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!restUrl || !restToken) {
      throw new Error(
        "RedisStore requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or explicit url/token args).",
      );
    }
    this.redis = new Redis({ url: restUrl, token: restToken });
  }

  private key(id: string): string {
    return `${this.ns.recordPrefix}${id}`;
  }

  async save(id: string, value: T): Promise<void> {
    // JSON.stringify to match FileStore/InMemoryStore behavior; the client would
    // also auto-serialize, but storing a string keeps the round-trip explicit.
    await this.redis.set(this.key(id), JSON.stringify(value));
    await this.redis.sadd(this.ns.indexKey, id);
  }

  async load(id: string): Promise<T | null> {
    const raw = await this.redis.get<unknown>(this.key(id));
    if (raw === null || raw === undefined) return null;
    // The Upstash client may auto-deserialize JSON into an object. Handle both:
    // a string (parse it) and an already-parsed object/value (use as-is).
    if (typeof raw === "string") {
      return JSON.parse(raw) as T;
    }
    return raw as T;
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(this.key(id));
    await this.redis.srem(this.ns.indexKey, id);
  }

  async list(): Promise<string[]> {
    const ids = await this.redis.smembers(this.ns.indexKey);
    return ids.map((id) => String(id));
  }
}
