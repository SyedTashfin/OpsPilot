import { z } from "zod";
import {
  LLMChatRequestSchema,
  LLMProviderError,
  type LLMChatRequest,
  type LLMChatResponse,
  type LLMClient,
  type LLMProviderHealth,
} from "./LLMClient.js";
import { buildEstimatedUsage } from "./tokenUsage.js";
import { createTimeoutSignal, isAbortError, normalizeTimeoutMs } from "./timeout.js";

const OllamaChatResponseSchema = z.object({
  model: z.string().optional(),
  message: z.object({ content: z.string() }).optional(),
  response: z.string().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  eval_count: z.number().int().nonnegative().optional(),
});

export type OllamaClientOptions = {
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
};

export class OllamaClient implements LLMClient {
  readonly provider = "ollama" as const;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, "");
    this.model = options.model;
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(input: LLMChatRequest): Promise<LLMChatResponse> {
    const request = LLMChatRequestSchema.parse(input);
    const model = request.model ?? this.model;

    let response: Response;
    const timeout = createTimeoutSignal(this.timeoutMs);
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: timeout.signal,
        body: JSON.stringify({
          model,
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
            stop: request.stop,
          },
        }),
      });
    } catch (error) {
      if (isAbortError(error) || timeout.signal.aborted) {
        throw new LLMProviderError(
          "ollama",
          "provider_timeout",
          `Ollama request to ${this.baseUrl} timed out after ${this.timeoutMs}ms.`,
          { cause: error },
        );
      }
      throw new LLMProviderError(
        "ollama",
        "provider_unavailable",
        `Ollama is unavailable at ${this.baseUrl}. Start Ollama or the Docker Compose ollama service and retry.`,
        { cause: error },
      );
    } finally {
      timeout.clear();
    }

    const text = await response.text();
    if (!response.ok) {
      throw this.errorFromOllamaResponse(response.status, text, model);
    }

    let parsed: z.infer<typeof OllamaChatResponseSchema>;
    try {
      parsed = OllamaChatResponseSchema.parse(JSON.parse(text));
    } catch (error) {
      throw new LLMProviderError(
        "ollama",
        "bad_response",
        "Ollama returned an unexpected chat response shape.",
        {
          cause: error,
          status: response.status,
        },
      );
    }

    const content = parsed.message?.content ?? parsed.response ?? "";
    const usage =
      parsed.prompt_eval_count !== undefined && parsed.eval_count !== undefined
        ? {
            promptTokens: parsed.prompt_eval_count,
            completionTokens: parsed.eval_count,
            totalTokens: parsed.prompt_eval_count + parsed.eval_count,
            estimated: false,
          }
        : buildEstimatedUsage(request.messages, content);

    return {
      provider: "ollama",
      model: parsed.model ?? model,
      content,
      usage,
      raw: parsed,
    };
  }

  async health(): Promise<LLMProviderHealth> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return {
          provider: "ollama",
          configured: true,
          available: false,
          model: this.model,
          baseUrl: this.baseUrl,
          reason: `Ollama health check failed with HTTP ${response.status}.`,
        };
      }

      const payload = (await response.json()) as {
        readonly models?: readonly { readonly name?: string }[];
      };
      const models = payload.models ?? [];
      const hasModel = models.some(
        (entry) => entry.name === this.model || entry.name?.startsWith(`${this.model}:`),
      );
      return {
        provider: "ollama",
        configured: true,
        available: hasModel,
        model: this.model,
        baseUrl: this.baseUrl,
        reason: hasModel
          ? undefined
          : `Ollama is reachable, but model '${this.model}' is not installed. Run: ollama pull ${this.model}`,
      };
    } catch (error) {
      return {
        provider: "ollama",
        configured: true,
        available: false,
        model: this.model,
        baseUrl: this.baseUrl,
        reason: error instanceof Error ? error.message : "Ollama health check failed.",
      };
    }
  }

  private errorFromOllamaResponse(status: number, body: string, model: string): LLMProviderError {
    const lowerBody = body.toLowerCase();
    if (status === 404 || lowerBody.includes("model") || lowerBody.includes("not found")) {
      return new LLMProviderError(
        "ollama",
        "model_missing",
        `Ollama model '${model}' is not available. Pull it with: ollama pull ${model}`,
        { status },
      );
    }

    return new LLMProviderError(
      "ollama",
      "provider_unavailable",
      `Ollama chat failed with HTTP ${status}.`,
      {
        status,
      },
    );
  }
}
