import { describe, expect, it } from "vitest";
import {
  DeterministicEmbeddingClient,
  RUNBOOK_EMBEDDING_DIMENSION,
  assertEmbeddingDimension,
  chunkRunbook,
  toPgVectorLiteral,
} from "./index.js";

describe("runbook RAG primitives", () => {
  it("chunks runbooks into deterministic chunks with metadata", () => {
    const chunks = chunkRunbook({
      id: "runbook-1",
      title: "Recommendation latency",
      slug: "recommendation-latency",
      body: "Overview: Check latency.\nDiagnosis: Inspect feature store timeout logs.",
      serviceName: "recommendation-service",
    });

    expect(chunks).toHaveLength(2);
    const firstChunk = chunks[0];
    if (!firstChunk) throw new Error("Expected at least one chunk.");
    expect(firstChunk.runbookId).toBe("runbook-1");
    expect(firstChunk.chunkIndex).toBe(0);
    expect(firstChunk.metadata["serviceName"]).toBe("recommendation-service");
  });

  it("validates the pgvector dimension", () => {
    expect(() => assertEmbeddingDimension([1, 2, 3])).toThrow(/Embedding dimension mismatch/u);
  });

  it("formats pgvector literals with a stable dimension", async () => {
    const embedding = await new DeterministicEmbeddingClient().embed({
      text: "feature store timeout",
    });

    expect(embedding).toHaveLength(RUNBOOK_EMBEDDING_DIMENSION);
    expect(toPgVectorLiteral(embedding)).toMatch(/^\[[0-9.,-]+\]$/u);
  });
});
