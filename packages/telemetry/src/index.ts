import { Langfuse } from "langfuse";

export const packageName = "@opspilot/telemetry" as const;

export function describePackage(): string {
  return "Langfuse and OpenTelemetry helpers.";
}

export type InvestigationTraceContext = {
  readonly traceId?: string;
};

export type InvestigationTraceStart = {
  readonly investigationId: string;
  readonly incidentId: string;
  readonly serviceName: string;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
};

export type InvestigationToolObservation = {
  readonly investigationId: string;
  readonly toolName: "query_logs" | "query_metrics" | "get_deployments" | "search_runbooks";
  readonly latencyMs: number;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
  readonly success: boolean;
  readonly metadata: Record<string, unknown>;
};

export type InvestigationGenerationObservation = {
  readonly investigationId: string;
  readonly provider: string;
  readonly model: string;
  readonly prompt: readonly { readonly role: string; readonly content: string }[];
  readonly completion: string | null;
  readonly latencyMs: number;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
  readonly temperature: number | undefined;
  readonly tokenUsage:
    | {
        readonly promptTokens?: number;
        readonly completionTokens?: number;
        readonly totalTokens?: number;
        readonly estimated?: boolean;
      }
    | undefined;
  readonly structuredOutputSuccess: boolean;
  readonly errorMessage?: string;
};

export type InvestigationCompletionObservation = {
  readonly investigationId: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly status: "completed" | "failed";
  readonly confidenceScore?: number;
  readonly citedRunbooks?: readonly {
    readonly title: string;
    readonly slug: string;
    readonly chunkId?: string;
  }[];
  readonly evidenceCount?: number;
  readonly errorMessage?: string;
};

export interface InvestigationObserver {
  startInvestigation(event: InvestigationTraceStart): Promise<InvestigationTraceContext>;
  recordTool(
    context: InvestigationTraceContext,
    event: InvestigationToolObservation,
  ): Promise<void>;
  recordGeneration(
    context: InvestigationTraceContext,
    event: InvestigationGenerationObservation,
  ): Promise<void>;
  completeInvestigation(
    context: InvestigationTraceContext,
    event: InvestigationCompletionObservation,
  ): Promise<void>;
  flush(): Promise<void>;
}

export class NoopInvestigationObserver implements InvestigationObserver {
  startInvestigation(): Promise<InvestigationTraceContext> {
    return Promise.resolve({});
  }

  recordTool(): Promise<void> {
    return Promise.resolve();
  }

  recordGeneration(): Promise<void> {
    return Promise.resolve();
  }

  completeInvestigation(): Promise<void> {
    return Promise.resolve();
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }
}

export type TelemetryWarningHandler = (error: unknown, action: string) => void;

export class SafeInvestigationObserver implements InvestigationObserver {
  constructor(
    private readonly inner: InvestigationObserver,
    private readonly warn: TelemetryWarningHandler = () => undefined,
  ) {}

  async startInvestigation(event: InvestigationTraceStart): Promise<InvestigationTraceContext> {
    try {
      return await this.inner.startInvestigation(event);
    } catch (error) {
      this.warn(error, "start_investigation_trace");
      return {};
    }
  }

  async recordTool(
    context: InvestigationTraceContext,
    event: InvestigationToolObservation,
  ): Promise<void> {
    try {
      await this.inner.recordTool(context, event);
    } catch (error) {
      this.warn(error, "record_tool_observation");
    }
  }

  async recordGeneration(
    context: InvestigationTraceContext,
    event: InvestigationGenerationObservation,
  ): Promise<void> {
    try {
      await this.inner.recordGeneration(context, event);
    } catch (error) {
      this.warn(error, "record_generation_observation");
    }
  }

  async completeInvestigation(
    context: InvestigationTraceContext,
    event: InvestigationCompletionObservation,
  ): Promise<void> {
    try {
      await this.inner.completeInvestigation(context, event);
    } catch (error) {
      this.warn(error, "complete_investigation_trace");
    }
  }

  async flush(): Promise<void> {
    try {
      await this.inner.flush();
    } catch (error) {
      this.warn(error, "flush_telemetry");
    }
  }
}

type LangfuseTraceHandle = {
  update(body: Record<string, unknown>): unknown;
};

type LangfuseObservationHandle = {
  end?(body?: Record<string, unknown>): unknown;
  update?(body: Record<string, unknown>): unknown;
};

export type LangfuseClientLike = {
  trace(body: Record<string, unknown>): LangfuseTraceHandle;
  span(body: Record<string, unknown>): LangfuseObservationHandle;
  generation(body: Record<string, unknown>): LangfuseObservationHandle;
  flushAsync(): Promise<void>;
};

export type LangfuseObserverOptions = {
  readonly client: LangfuseClientLike;
  readonly environment?: string;
};

export class LangfuseInvestigationObserver implements InvestigationObserver {
  private readonly traces = new Map<string, LangfuseTraceHandle>();

  constructor(private readonly options: LangfuseObserverOptions) {}

  startInvestigation(event: InvestigationTraceStart): Promise<InvestigationTraceContext> {
    const traceId = event.investigationId;
    const trace = this.options.client.trace({
      id: traceId,
      name: "investigation.workflow",
      environment: this.options.environment,
      metadata: {
        investigationId: event.investigationId,
        incidentId: event.incidentId,
        serviceName: event.serviceName,
        provider: event.provider,
        model: event.model,
        promptVersion: event.promptVersion,
      },
      tags: ["opspilot", "investigation", event.provider],
    });
    this.traces.set(traceId, trace);
    return Promise.resolve({ traceId });
  }

  recordTool(
    context: InvestigationTraceContext,
    event: InvestigationToolObservation,
  ): Promise<void> {
    if (!context.traceId) return Promise.resolve();
    this.options.client.span({
      traceId: context.traceId,
      name: event.toolName,
      startTime: event.startedAt,
      endTime: event.endedAt,
      metadata: {
        investigationId: event.investigationId,
        toolName: event.toolName,
        latencyMs: event.latencyMs,
        success: event.success,
        ...event.metadata,
      },
      level: event.success ? "DEFAULT" : "ERROR",
      statusMessage: event.success ? undefined : "Tool call failed.",
    });
    return Promise.resolve();
  }

  recordGeneration(
    context: InvestigationTraceContext,
    event: InvestigationGenerationObservation,
  ): Promise<void> {
    if (!context.traceId) return Promise.resolve();
    this.options.client.generation({
      traceId: context.traceId,
      name: "investigation.llm_generation",
      model: event.model,
      input: event.prompt,
      output: event.completion,
      startTime: event.startedAt,
      endTime: event.endedAt,
      usageDetails: this.toLangfuseUsageDetails(event.tokenUsage),
      metadata: {
        investigationId: event.investigationId,
        provider: event.provider,
        latencyMs: event.latencyMs,
        temperature: event.temperature,
        structuredOutputSuccess: event.structuredOutputSuccess,
        errorMessage: event.errorMessage,
      },
      level: event.structuredOutputSuccess ? "DEFAULT" : "ERROR",
      statusMessage: event.structuredOutputSuccess
        ? undefined
        : (event.errorMessage ?? "Structured output failed."),
    });
    return Promise.resolve();
  }

  private toLangfuseUsageDetails(
    eventUsage: InvestigationGenerationObservation["tokenUsage"],
  ): Record<string, number> | undefined {
    if (!eventUsage) return undefined;
    const usage: Record<string, number> = {};
    if (typeof eventUsage.promptTokens === "number") usage.input = eventUsage.promptTokens;
    if (typeof eventUsage.completionTokens === "number") usage.output = eventUsage.completionTokens;
    if (typeof eventUsage.totalTokens === "number") usage.total = eventUsage.totalTokens;
    return Object.keys(usage).length > 0 ? usage : undefined;
  }

  completeInvestigation(
    context: InvestigationTraceContext,
    event: InvestigationCompletionObservation,
  ): Promise<void> {
    if (!context.traceId) return Promise.resolve();
    const trace = this.traces.get(context.traceId);
    trace?.update({
      metadata: {
        investigationId: event.investigationId,
        durationMs: event.durationMs,
        success: event.success,
        investigationStatus: event.status,
        confidenceScore: event.confidenceScore,
        citedRunbooks: event.citedRunbooks,
        evidenceCount: event.evidenceCount,
        errorMessage: event.errorMessage,
      },
      output: {
        status: event.status,
        confidenceScore: event.confidenceScore,
        evidenceCount: event.evidenceCount,
      },
    });
    return Promise.resolve();
  }

  flush(): Promise<void> {
    return this.options.client.flushAsync();
  }
}

export type LangfuseTelemetryConfig = {
  readonly enabled: boolean;
  readonly publicKey?: string;
  readonly secretKey?: string;
  readonly baseUrl?: string;
  readonly environment?: string;
};

export function loadLangfuseTelemetryConfig(
  env: NodeJS.ProcessEnv = process.env,
): LangfuseTelemetryConfig {
  const publicKey = env.LANGFUSE_PUBLIC_KEY || undefined;
  const secretKey = env.LANGFUSE_SECRET_KEY || undefined;
  const explicitEnabled = env.LANGFUSE_ENABLED?.toLowerCase();
  const enabled = explicitEnabled === "false" ? false : Boolean(publicKey && secretKey);
  return {
    enabled,
    ...(publicKey ? { publicKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(env.LANGFUSE_BASE_URL ? { baseUrl: env.LANGFUSE_BASE_URL } : {}),
    environment: env.LANGFUSE_ENVIRONMENT || env.NODE_ENV || "development",
  };
}

export function createInvestigationObserver(
  config: LangfuseTelemetryConfig = loadLangfuseTelemetryConfig(),
): InvestigationObserver {
  if (!config.enabled || !config.publicKey || !config.secretKey)
    return new NoopInvestigationObserver();
  const client = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  }) as unknown as LangfuseClientLike;
  return new LangfuseInvestigationObserver({
    client,
    ...(config.environment ? { environment: config.environment } : {}),
  });
}
