export const RUNBOOK_EMBEDDING_DIMENSION = 768;

export type EmbeddingInput = {
  readonly text: string;
};

export interface EmbeddingClient {
  embed(input: EmbeddingInput): Promise<readonly number[]>;
}

export function assertEmbeddingDimension(
  embedding: readonly number[],
  expectedDimension = RUNBOOK_EMBEDDING_DIMENSION,
): void {
  if (embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expectedDimension}, received ${embedding.length}. ` +
        "Update the runbook_chunks vector dimension through a migration or configure a compatible embedding model.",
    );
  }
}

export function toPgVectorLiteral(embedding: readonly number[]): string {
  assertEmbeddingDimension(embedding);
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export class DeterministicEmbeddingClient implements EmbeddingClient {
  async embed(input: EmbeddingInput): Promise<readonly number[]> {
    await Promise.resolve();
    const vector = new Array<number>(RUNBOOK_EMBEDDING_DIMENSION).fill(0);
    const tokens = input.text.toLowerCase().match(/[a-z0-9]+/gu) ?? [];

    for (const token of tokens) {
      let hash = 0;
      for (let index = 0; index < token.length; index += 1) {
        hash = (hash * 33 + token.charCodeAt(index)) % RUNBOOK_EMBEDDING_DIMENSION;
      }
      vector[hash] = (vector[hash] ?? 0) + 1;
    }

    const norm = Math.hypot(...vector) || 1;
    return vector.map((value) => value / norm);
  }
}
