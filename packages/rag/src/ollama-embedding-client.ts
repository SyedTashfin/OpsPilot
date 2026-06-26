import {
  assertEmbeddingDimension,
  type EmbeddingClient,
  type EmbeddingInput,
} from "./embedding.js";

export type OllamaEmbeddingClientConfig = {
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs?: number;
};

type OllamaEmbedResponse = {
  readonly embedding?: readonly number[];
  readonly embeddings?: readonly (readonly number[])[];
};

export class OllamaEmbeddingClient implements EmbeddingClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: OllamaEmbeddingClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/u, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async embed(input: EmbeddingInput): Promise<readonly number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: input.text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Ollama embedding request failed with ${response.status}: ${text || response.statusText}. ` +
            `Ensure model '${this.model}' is pulled and Ollama is reachable at ${this.baseUrl}.`,
        );
      }

      const payload = (await response.json()) as OllamaEmbedResponse;
      const embedding = payload.embedding ?? payload.embeddings?.[0];
      if (!embedding) {
        throw new Error("Ollama embedding response did not include an embedding vector.");
      }

      assertEmbeddingDimension(embedding);
      return embedding;
    } finally {
      clearTimeout(timeout);
    }
  }
}
