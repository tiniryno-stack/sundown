/* On-device persistence (localStorage). The server is authoritative; we only
   stash identity + small UI prefs so closing/reopening the app loses nothing. */

import type { Identity } from "./types";

const K = {
  identity: "sundown.identity",
  hostId: "sundown.hostId",
  hostGames: "sundown.hostGames",
  tutorialSeen: "sundown.tutorialSeen",
  theme: "sundown.theme",
  votePick: (gameId: string, index: number) => `sundown.vote.${gameId}.${index}`,
  archive: (gameId: string, playerId: string) => `sundown.archive.${gameId}.${playerId}`,
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export const store = {
  getIdentity: () => read<Identity>(K.identity),
  setIdentity: (id: Identity) => write(K.identity, id),
  clearIdentity: () => localStorage.removeItem(K.identity),

  // A stable per-device host id so the same browser can manage games it created.
  getHostId(): string {
    let id = read<string>(K.hostId);
    if (!id) {
      id = `host_${Math.random().toString(36).slice(2, 10)}`;
      write(K.hostId, id);
    }
    return id;
  },

  // Games this device has hosted: { gameId }[] (most recent first).
  getHostGames: () => read<{ gameId: string; createdAt: number }[]>(K.hostGames) ?? [],
  addHostGame(gameId: string) {
    const list = store.getHostGames().filter((g) => g.gameId !== gameId);
    list.unshift({ gameId, createdAt: Date.now() });
    write(K.hostGames, list.slice(0, 10));
  },

  getTutorialSeen: () => read<boolean>(K.tutorialSeen) ?? false,
  setTutorialSeen: (v: boolean) => write(K.tutorialSeen, v),

  getTheme: () => read<"light" | "dark">(K.theme),
  setTheme: (t: "light" | "dark") => write(K.theme, t),

  getVotePick: (gameId: string, index: number) => read<string>(K.votePick(gameId, index)),
  setVotePick: (gameId: string, index: number, targetId: string) =>
    write(K.votePick(gameId, index), targetId),

  getArchive: (gameId: string, playerId: string) =>
    read<{ prompt: string; tier: string; kind: string; answer: string | null; at: number }[]>(K.archive(gameId, playerId)) ?? [],
  setArchive: (gameId: string, playerId: string, items: { prompt: string; tier: string; kind: string; answer: string | null; at: number }[]) =>
    write(K.archive(gameId, playerId), items),
};
