export type RunbookForChunking = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly body: string;
  readonly serviceName?: string;
};

export type RunbookChunk = {
  readonly runbookId: string;
  readonly chunkIndex: number;
  readonly title: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
};

export type ChunkRunbookOptions = {
  readonly maxCharacters?: number;
};

const DEFAULT_MAX_CHARACTERS = 900;

function normalizeWhitespace(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function splitLongSection(section: string, maxCharacters: number): string[] {
  if (section.length <= maxCharacters) return [section];

  const sentences = section.split(/(?<=[.!?])\s+/u);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxCharacters && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function chunkRunbook(
  runbook: RunbookForChunking,
  options: ChunkRunbookOptions = {},
): RunbookChunk[] {
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const normalizedBody = normalizeWhitespace(runbook.body);

  if (!normalizedBody) return [];

  const roughSections = normalizedBody
    .split(/\n(?=(?:#{1,3}\s+|[A-Z][A-Za-z0-9 /-]{2,}:))/u)
    .map((section) => section.trim())
    .filter(Boolean);

  const sections = roughSections.flatMap((section) => splitLongSection(section, maxCharacters));

  return sections.map((content, index) => ({
    runbookId: runbook.id,
    chunkIndex: index,
    title: runbook.title,
    content,
    metadata: {
      slug: runbook.slug,
      serviceName: runbook.serviceName ?? null,
      contentLength: content.length,
    },
  }));
}
