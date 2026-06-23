/** Public entry point for the backend (no frontend — see API.md). */

export * from "./engine/index.js";
export * from "./sim/simulate.js";
export * from "./sim/strategy.js";

export * from "./ai/client.js";
export { Director } from "./director/director.js";
export type { DirectorTickResult } from "./director/director.js";
export { buildSnapshot } from "./director/snapshot.js";
export type { DirectorSnapshot } from "./director/snapshot.js";
export * from "./director/guardrails.js";
export { makeMockDirectorClient } from "./director/mockDirector.js";

export { DeckGenerator } from "./deck/generator.js";
export * from "./deck/types.js";
export { makeMockDeckClient } from "./deck/mockDeck.js";

export { GameService } from "./service/gameService.js";
export type { GameServiceOptions } from "./service/gameService.js";
export * from "./service/types.js";

export * from "./persistence/store.js";
export { FileStore } from "./persistence/fileStore.js";
