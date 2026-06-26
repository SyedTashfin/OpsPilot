import type pg from "pg";
import { DeterministicEmbeddingClient, type EmbeddingClient } from "./embedding.js";
import { OllamaEmbeddingClient } from "./ollama-embedding-client.js";
import {
  RunbookRepository,
  type IngestRunbooksResult,
  type RunbookSearchResult,
} from "./repository.js";

export type RagConfig = {
  readonly provider: "ollama" | "deterministic";
  readonly ollamaBaseUrl: string;
  readonly ollamaEmbeddingModel: string;
};

export function loadRagConfig(env: NodeJS.ProcessEnv = process.env): RagConfig {
  return {
    provider: env.RAG_EMBEDDING_PROVIDER === "deterministic" ? "deterministic" : "ollama",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaEmbeddingModel: env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
  };
}

export function createEmbeddingClient(config: RagConfig): EmbeddingClient {
  if (config.provider === "deterministic") return new DeterministicEmbeddingClient();
  return new OllamaEmbeddingClient({
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaEmbeddingModel,
  });
}

export class RunbookRagService {
  private readonly repository: RunbookRepository;

  constructor(
    pool: pg.Pool,
    private readonly embeddingClient: EmbeddingClient,
  ) {
    this.repository = new RunbookRepository(pool);
  }

  async ingest(): Promise<IngestRunbooksResult> {
    return this.repository.ingestRunbooks(this.embeddingClient);
  }

  async search(query: string, limit = 5): Promise<RunbookSearchResult[]> {
    const embedding = await this.embeddingClient.embed({ text: query });
    return this.repository.search(embedding, limit);
  }
}
