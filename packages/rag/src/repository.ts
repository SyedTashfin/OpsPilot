import type pg from "pg";
import { chunkRunbook } from "./chunking.js";
import { assertEmbeddingDimension, toPgVectorLiteral, type EmbeddingClient } from "./embedding.js";

export type RunbookRow = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly body: string;
  readonly service_name: string | null;
};

export type RunbookSearchResult = {
  readonly chunkId: string;
  readonly runbookId: string;
  readonly serviceName: string | null;
  readonly title: string;
  readonly slug: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
};

export type IngestRunbooksResult = {
  readonly runbooks: number;
  readonly chunks: number;
};

export class RunbookRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listRunbooks(): Promise<RunbookRow[]> {
    const result = await this.pool.query<RunbookRow>(
      `SELECT r.id, r.title, r.slug, r.body, s.name AS service_name
       FROM runbooks r
       LEFT JOIN beautycorp_services s ON s.id = r.service_id
       ORDER BY r.slug ASC`,
    );
    return result.rows;
  }

  async ingestRunbooks(embeddingClient: EmbeddingClient): Promise<IngestRunbooksResult> {
    const runbooks = await this.listRunbooks();
    let chunkCount = 0;

    for (const runbook of runbooks) {
      const chunkInput = {
        id: runbook.id,
        title: runbook.title,
        slug: runbook.slug,
        body: runbook.body,
      };
      const chunks = chunkRunbook(
        runbook.service_name ? { ...chunkInput, serviceName: runbook.service_name } : chunkInput,
      );

      for (const chunk of chunks) {
        const embedding = await embeddingClient.embed({ text: chunk.content });
        assertEmbeddingDimension(embedding);
        const vector = toPgVectorLiteral(embedding);

        await this.pool.query(
          `INSERT INTO runbook_chunks (runbook_id, chunk_index, content, embedding, metadata)
           VALUES ($1, $2, $3, $4::vector, $5::jsonb)
           ON CONFLICT (runbook_id, chunk_index)
           DO UPDATE SET
             content = EXCLUDED.content,
             embedding = EXCLUDED.embedding,
             metadata = EXCLUDED.metadata`,
          [
            chunk.runbookId,
            chunk.chunkIndex,
            chunk.content,
            vector,
            JSON.stringify(chunk.metadata),
          ],
        );
        chunkCount += 1;
      }
    }

    return { runbooks: runbooks.length, chunks: chunkCount };
  }

  async search(queryEmbedding: readonly number[], limit = 5): Promise<RunbookSearchResult[]> {
    assertEmbeddingDimension(queryEmbedding);
    const vector = toPgVectorLiteral(queryEmbedding);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL enable_indexscan = off");
      await client.query("SET LOCAL enable_bitmapscan = off");

      const result = await client.query<{
        chunk_id: string;
        runbook_id: string;
        service_name: string | null;
        title: string;
        slug: string;
        chunk_index: number;
        content: string;
        distance: number;
        metadata: Record<string, unknown>;
      }>(
        `SELECT
           c.id AS chunk_id,
           r.id AS runbook_id,
           s.name AS service_name,
           r.title,
           r.slug,
           c.chunk_index,
           c.content,
           c.embedding <=> $1::vector AS distance,
           c.metadata
         FROM runbook_chunks c
         JOIN runbooks r ON r.id = c.runbook_id
         LEFT JOIN beautycorp_services s ON s.id = r.service_id
         WHERE c.embedding IS NOT NULL
         ORDER BY c.embedding <=> $1::vector ASC
         LIMIT $2`,
        [vector, limit],
      );
      await client.query("COMMIT");

      return result.rows.map((row) => ({
        chunkId: row.chunk_id,
        runbookId: row.runbook_id,
        serviceName: row.service_name,
        title: row.title,
        slug: row.slug,
        chunkIndex: row.chunk_index,
        content: row.content,
        score: 1 - Number(row.distance),
        metadata: row.metadata,
      }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
