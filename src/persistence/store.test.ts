import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FileStore } from "./fileStore.js";
import { InMemoryStore, type Store } from "./store.js";

interface Doc {
  n: number;
  tag: string;
}

function suite(name: string, make: () => Store<Doc>) {
  describe(name, () => {
    it("saves, loads, lists, and deletes", async () => {
      const store = make();
      expect(await store.load("a")).toBeNull();
      await store.save("a", { n: 1, tag: "x" });
      await store.save("b", { n: 2, tag: "y" });
      expect(await store.load("a")).toEqual({ n: 1, tag: "x" });
      expect((await store.list()).sort()).toEqual(["a", "b"]);
      await store.delete("a");
      expect(await store.load("a")).toBeNull();
    });

    it("stores a copy (no mutation by reference)", async () => {
      const store = make();
      const doc = { n: 1, tag: "z" };
      await store.save("c", doc);
      doc.n = 999;
      expect((await store.load("c"))!.n).toBe(1);
    });
  });
}

const tmpDir = path.join(os.tmpdir(), `sdg-store-${Date.now()}`);

suite("InMemoryStore", () => new InMemoryStore<Doc>());
suite("FileStore", () => new FileStore<Doc>(tmpDir));

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});
