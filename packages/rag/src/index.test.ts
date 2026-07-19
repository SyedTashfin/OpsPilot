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

describe("runbook exact search", () => {
  it("uses exact cosine ordering without ANN index scans", async () => {
    const queries: string[] = [];
    const client = {
      query: (sql: string) => {
        queries.push(sql);
        if (sql.includes("FROM runbook_chunks")) {
          return Promise.resolve({
            rows: [
              {
                chunk_id: "chunk-timeout",
                runbook_id: "runbook-1",
                service_name: "recommendation-service",
                title: "Recommendation latency",
                slug: "recommendation-latency",
                chunk_index: 0,
                content: "feature store timeout",
                distance: 0.1,
                metadata: {},
              },
              {
                chunk_id: "chunk-cache",
                runbook_id: "runbook-2",
                service_name: "recommendation-service",
                title: "Cache latency",
                slug: "cache-latency",
                chunk_index: 0,
                content: "cache checks",
                distance: 0.4,
                metadata: {},
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      },
      release() {},
    };
    const { RunbookRepository } = await import("./repository.js");
    const repository = new RunbookRepository({ connect: () => Promise.resolve(client) } as never);
    const embedding = await new DeterministicEmbeddingClient().embed({ text: "feature timeout" });

    const results = await repository.search(embedding, 2);

    expect(queries).toContain("SET LOCAL enable_indexscan = off");
    expect(queries).toContain("SET LOCAL enable_bitmapscan = off");
    expect(queries.some((query) => query.includes("ORDER BY c.embedding <=> $1::vector ASC"))).toBe(
      true,
    );
    expect(results.map((result) => result.chunkId)).toEqual(["chunk-timeout", "chunk-cache"]);
    expect(results[0]?.score).toBeCloseTo(0.9);
  });
});
