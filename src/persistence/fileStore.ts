/**
 * File-backed Store adapter: one JSON file per id under a data directory.
 * Swappable with InMemoryStore (and a future SQLite adapter) behind `Store<T>`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Store } from "./store.js";

export class FileStore<T> implements Store<T> {
  constructor(private readonly dir: string) {}

  private file(id: string): string {
    // Sanitize id to a safe filename.
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.dir, `${safe}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(id: string, value: T): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.file(id), JSON.stringify(value, null, 2), "utf8");
  }

  async load(id: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.file(id), "utf8");
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.file(id));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dir);
      return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}
