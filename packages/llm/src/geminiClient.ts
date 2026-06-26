import { z } from "zod";
import {
  LLMChatRequestSchema,
  LLMProviderError,
  type LLMChatRequest,
  type LLMChatResponse,
  type LLMClient,
  type LLMMessage,
  type LLMProviderHealth,
} from "./LLMClient.js";
import { buildEstimatedUsage } from "./tokenUsage.js";
import { createTimeoutSignal, isAbortError, normalizeTimeoutMs } from "./timeout.js";

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })).optional(),
        }),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
      totalTokenCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type GeminiClientOptions = {
  readonly credential?: string | undefined;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
};

export class GeminiClient implements LLMClient {
  readonly provider = "gemini" as const;
  readonly model: string;
  private readonly credential: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiClientOptions) {
    this.credential = options.credential;
    this.model = options.model;
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(input: LLMChatRequest): Promise<LLMChatResponse> {
    if (!this.credential) {
      throw new LLMProviderError(
        "gemini",
        "provider_disabled",
        "Gemini provider is disabled because GEMINI_API_KEY is not configured.",
      );
    }

    const request = LLMChatRequestSchema.parse(input);
    const model = request.model ?? this.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    let response: Response;
    const timeout = createTimeoutSignal(this.timeoutMs);
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.credential },
        signal: timeout.signal,
        body: JSON.stringify({
          systemInstruction: buildSystemInstruction(request.messages),
          contents: buildGeminiContents(request.messages),
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
            stopSequences: request.stop,
          },
        }),
      });
    } catch (error) {
      if (isAbortError(error) || timeout.signal.aborted) {
        throw new LLMProviderError(
          "gemini",
          "provider_timeout",
          `Gemini request timed out after ${this.timeoutMs}ms.`,
          { cause: error },
        );
      }
      throw new LLMProviderError("gemini", "provider_unavailable", "Gemini API request failed.", {
        cause: error,
      });
    } finally {
      timeout.clear();
    }

    const text = await response.text();
    if (!response.ok) {
      throw new LLMProviderError(
        "gemini",
        "provider_unavailable",
        `Gemini API failed with HTTP ${response.status}.`,
        {
          status: response.status,
        },
      );
    }

    let parsed: z.infer<typeof GeminiResponseSchema>;
    try {
      parsed = GeminiResponseSchema.parse(JSON.parse(text));
    } catch (error) {
      throw new LLMProviderError(
        "gemini",
        "bad_response",
        "Gemini returned an unexpected response shape.",
        {
          cause: error,
          status: response.status,
        },
      );
    }

    const content =
      parsed.candidates?.[0]?.content.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";
    const metadata = parsed.usageMetadata;
    const usage =
      metadata?.promptTokenCount !== undefined || metadata?.candidatesTokenCount !== undefined
        ? {
            promptTokens: metadata.promptTokenCount ?? 0,
            completionTokens: metadata.candidatesTokenCount ?? 0,
            totalTokens:
              metadata.totalTokenCount ??
              (metadata.promptTokenCount ?? 0) + (metadata.candidatesTokenCount ?? 0),
            estimated: false,
          }
        : buildEstimatedUsage(request.messages, content);

    return {
      provider: "gemini",
      model,
      content,
      usage,
      raw: parsed,
    };
  }

  health(): Promise<LLMProviderHealth> {
    return Promise.resolve({
      provider: "gemini",
      configured: Boolean(this.credential),
      available: Boolean(this.credential),
      model: this.model,
      reason: this.credential ? undefined : "GEMINI_API_KEY is not configured; Gemini is disabled.",
    });
  }
}

function buildSystemInstruction(
  messages: readonly LLMMessage[],
): { readonly parts: readonly { readonly text: string }[] } | undefined {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  return system ? { parts: [{ text: system }] } : undefined;
}

function buildGeminiContents(
  messages: readonly LLMMessage[],
): readonly { readonly role: string; readonly parts: readonly { readonly text: string }[] }[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}
