export const DEFAULT_LLM_TIMEOUT_MS = 90_000;

export function normalizeTimeoutMs(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return DEFAULT_LLM_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LLM_TIMEOUT_MS;
  return Math.trunc(value);
}

export function createTimeoutSignal(timeoutMs: number): {
  readonly signal: AbortSignal;
  readonly clear: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`LLM provider request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  if (error instanceof Error)
    return error.name === "AbortError" || error.message.includes("timed out");
  return false;
}
