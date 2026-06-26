import type {
  LLMChatRequest,
  LLMChatResponse,
  LLMClient,
  LLMProvider,
  LLMProviderHealth,
} from "./LLMClient.js";

export type LLMInstrumentationEvent = {
  readonly provider: LLMProvider;
  readonly model: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly usage?: LLMChatResponse["usage"];
  readonly errorName?: string;
};

export type LLMInstrumentationSink = (event: LLMInstrumentationEvent) => void | Promise<void>;

export class InstrumentedLLMClient implements LLMClient {
  readonly provider: LLMProvider;
  readonly model: string;
  private readonly inner: LLMClient;
  private readonly sink: LLMInstrumentationSink;

  constructor(inner: LLMClient, sink: LLMInstrumentationSink) {
    this.inner = inner;
    this.sink = sink;
    this.provider = inner.provider;
    this.model = inner.model;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const startedAt = Date.now();
    try {
      const response = await this.inner.chat(request);
      await this.sink({
        provider: this.provider,
        model: response.model,
        durationMs: Date.now() - startedAt,
        success: true,
        usage: response.usage,
      });
      return response;
    } catch (error) {
      await this.sink({
        provider: this.provider,
        model: this.model,
        durationMs: Date.now() - startedAt,
        success: false,
        errorName: error instanceof Error ? error.name : "unknown",
      });
      throw error;
    }
  }

  health(): Promise<LLMProviderHealth> {
    return this.inner.health();
  }
}
