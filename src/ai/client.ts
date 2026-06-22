/**
 * LLM client abstraction (§18: all Anthropic usage behind an interface with a
 * deterministic mock, so the whole project builds/runs/tests WITHOUT an API key).
 *
 * Both the AI Director (§15) and the task-deck generator (§7.2) depend only on
 * this interface. The real Anthropic adapter is constructed lazily and only when
 * an API key is present; otherwise callers inject a `MockLLMClient`.
 */

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  /** Lower = more deterministic. Director/deck use low temperature. */
  temperature?: number;
}

export interface LLMResponse {
  text: string;
}

export interface LLMClient {
  readonly name: string;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

/** Suggested models (§15.6). Overridable per call. */
export const MODELS = {
  director: "claude-sonnet-4-6",
  directorFastPoll: "claude-haiku-4-5",
  deck: "claude-sonnet-4-6",
} as const;

/**
 * Deterministic mock. Given a `responder(req) => string`, it returns that string
 * as the model's text — letting each module inject canned, reproducible output.
 * No network, no key. This is the default in all tests and offline runs.
 */
export class MockLLMClient implements LLMClient {
  readonly name = "mock";
  constructor(private readonly responder: (req: LLMRequest) => string) {}
  async complete(req: LLMRequest): Promise<LLMResponse> {
    return { text: this.responder(req) };
  }
}

/**
 * Real Anthropic adapter. Imported lazily so the SDK is never required on the
 * offline/test path. Constructed only by `createLLMClient` when a key exists.
 */
export class AnthropicLLMClient implements LLMClient {
  readonly name = "anthropic";
  private clientPromise: Promise<any> | null = null;
  constructor(private readonly apiKey: string) {}

  private async client(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = import("@anthropic-ai/sdk").then((mod) => {
        const Anthropic = (mod as any).default ?? mod;
        return new Anthropic({ apiKey: this.apiKey });
      });
    }
    return this.clientPromise;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const anthropic = await this.client();
    const msg = await anthropic.messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.2,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = (msg.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    return { text };
  }
}

/**
 * Factory: returns a real client if ANTHROPIC_API_KEY is set, else `null` so the
 * caller falls back to its deterministic mock. Never throws on a missing key.
 */
export function createLLMClient(env: NodeJS.ProcessEnv = process.env): LLMClient | null {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new AnthropicLLMClient(key);
}

/** Extract the first balanced JSON object from arbitrary model text. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
