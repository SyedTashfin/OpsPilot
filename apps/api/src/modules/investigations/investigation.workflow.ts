import type { LLMClient, LLMChatResponse } from "@opspilot/llm";
import {
  NoopInvestigationObserver,
  type InvestigationObserver,
  type InvestigationTraceContext,
} from "@opspilot/telemetry";
import type { RunbookSearchResult } from "@opspilot/rag";
import { INVESTIGATION_PROMPT_VERSION, buildInvestigationPrompt } from "./investigation.prompt.js";
import type { InvestigationRepository } from "./investigation.repository.js";
import { InvestigationReportSchema, type InvestigationResult } from "./investigation.types.js";

export type RunbookSearchService = {
  search(query: string, limit?: number): Promise<RunbookSearchResult[]>;
};

export class InvestigationWorkflow {
  constructor(
    private readonly repository: InvestigationRepository,
    private readonly runbooks: RunbookSearchService,
    private readonly llm: LLMClient,
    private readonly observer: InvestigationObserver = new NoopInvestigationObserver(),
  ) {}

  async investigate(incidentId: string): Promise<InvestigationResult> {
    const incident = await this.repository.getIncident(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    const startedAt = Date.now();
    const investigationId = await this.repository.createInvestigation({
      incidentId,
      provider: this.llm.provider,
      model: this.llm.model,
      promptVersion: INVESTIGATION_PROMPT_VERSION,
    });
    const trace = await this.observer.startInvestigation({
      investigationId,
      incidentId,
      serviceName: incident.serviceName,
      provider: this.llm.provider,
      model: this.llm.model,
      promptVersion: INVESTIGATION_PROMPT_VERSION,
    });
    if (trace.traceId) await this.repository.setLangfuseTraceId(investigationId, trace.traceId);

    try {
      const logs = await this.runTool(trace, investigationId, 1, "query_logs", { incidentId }, () =>
        this.repository.queryLogs(incident),
      );
      const metrics = await this.runTool(
        trace,
        investigationId,
        2,
        "query_metrics",
        { incidentId },
        () => this.repository.queryMetrics(incident),
      );
      const deployments = await this.runTool(
        trace,
        investigationId,
        3,
        "get_deployments",
        { incidentId },
        () => this.repository.getDeployments(incident),
      );
      const runbookQuery = [incident.title, incident.detectionReason, incident.serviceName].join(
        " ",
      );
      const runbooks = await this.runTool(
        trace,
        investigationId,
        4,
        "search_runbooks",
        { query: runbookQuery },
        () => this.runbooks.search(runbookQuery, 5),
      );

      const prompt = buildInvestigationPrompt({
        incident,
        logs,
        metrics,
        deployments,
        runbooks: runbooks.map((runbook) => ({
          chunkId: runbook.chunkId,
          title: runbook.title,
          slug: runbook.slug,
          content: runbook.content,
          score: runbook.score,
        })),
      });

      await this.repository.recordStep({
        investigationId,
        stepIndex: 5,
        stepType: "prompt",
        title: "Build structured investigation prompt",
        content: prompt.map((message) => `${message.role}: ${message.content}`).join("\n\n"),
        metadata: { promptVersion: INVESTIGATION_PROMPT_VERSION },
      });

      const generationStartedAt = Date.now();
      const generationStartTime = new Date(generationStartedAt);
      let response: LLMChatResponse;
      try {
        response = await this.llm.chat({
          messages: [...prompt],
          temperature: 0.1,
          maxTokens: 1200,
        });
      } catch (error) {
        await this.recordGeneration(trace, {
          investigationId,
          provider: this.llm.provider,
          model: this.llm.model,
          prompt,
          completion: null,
          latencyMs: Date.now() - generationStartedAt,
          startedAt: generationStartTime,
          endedAt: new Date(),
          temperature: 0.1,
          tokenUsage: undefined,
          structuredOutputSuccess: false,
          errorMessage: error instanceof Error ? error.message : "LLM generation failed.",
        });
        throw error;
      }

      let report;
      try {
        report = await this.parseReportOrPersistFailure(investigationId, response.content);
      } catch (error) {
        await this.recordGeneration(trace, {
          investigationId,
          provider: response.provider,
          model: response.model,
          prompt,
          completion: response.content,
          latencyMs: Date.now() - generationStartedAt,
          startedAt: generationStartTime,
          endedAt: new Date(),
          temperature: 0.1,
          tokenUsage: response.usage,
          structuredOutputSuccess: false,
          errorMessage:
            error instanceof Error ? error.message : "Structured output validation failed.",
        });
        throw error;
      }
      await this.recordGeneration(trace, {
        investigationId,
        provider: response.provider,
        model: response.model,
        prompt,
        completion: response.content,
        latencyMs: Date.now() - generationStartedAt,
        startedAt: generationStartTime,
        endedAt: new Date(),
        temperature: 0.1,
        tokenUsage: response.usage,
        structuredOutputSuccess: true,
      });

      await this.repository.recordStep({
        investigationId,
        stepIndex: 6,
        stepType: "final",
        title: "Investigation report",
        content: JSON.stringify(report, null, 2),
        metadata: { usage: response.usage, model: response.model, provider: response.provider },
      });
      const durationMs = Date.now() - startedAt;
      await this.repository.completeInvestigation({
        investigationId,
        report,
        latencyMs: durationMs,
      });
      await this.observer.completeInvestigation(trace, {
        investigationId,
        durationMs,
        success: true,
        status: "completed",
        confidenceScore: report.confidence,
        citedRunbooks: report.citedRunbooks.map((runbook) => ({
          title: runbook.title,
          slug: runbook.slug,
          ...(runbook.chunkId ? { chunkId: runbook.chunkId } : {}),
        })),
        evidenceCount: report.evidence.length,
      });
      await this.observer.flush();

      return { investigationId, report };
    } catch (error) {
      await this.repository.failInvestigation({
        investigationId,
        error: error instanceof Error ? error.message : "Investigation failed.",
      });
      await this.observer.completeInvestigation(trace, {
        investigationId,
        durationMs: Date.now() - startedAt,
        success: false,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Investigation failed.",
      });
      await this.observer.flush();
      throw error;
    }
  }

  private async parseReportOrPersistFailure(investigationId: string, rawResponse: string) {
    try {
      return InvestigationReportSchema.parse(JSON.parse(rawResponse));
    } catch (error) {
      const parserError = error instanceof Error ? error.message : "Invalid investigation JSON.";
      await this.repository.recordInvalidModelResponse({
        investigationId,
        rawResponse,
        parserError,
      });
      throw error;
    }
  }

  private async runTool<T>(
    trace: InvestigationTraceContext,
    investigationId: string,
    stepIndex: number,
    toolName: "query_logs" | "query_metrics" | "get_deployments" | "search_runbooks",
    toolInput: Record<string, unknown>,
    execute: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const toolStartTime = new Date(startedAt);
    try {
      const output = await execute();
      const latencyMs = Date.now() - startedAt;
      await this.repository.recordToolCall({
        investigationId,
        toolName,
        toolInput,
        output,
        status: "success",
        latencyMs,
      });
      await this.observer.recordTool(trace, {
        investigationId,
        toolName,
        latencyMs,
        startedAt: toolStartTime,
        endedAt: new Date(),
        success: true,
        metadata: this.summarizeToolOutput(output),
      });
      await this.repository.recordStep({
        investigationId,
        stepIndex,
        stepType: "tool_call",
        title: toolName,
        content: JSON.stringify(output, null, 2),
        metadata: { toolName, latencyMs },
      });
      return output;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      await this.repository.recordToolCall({
        investigationId,
        toolName,
        toolInput,
        output: { error: error instanceof Error ? error.message : "Tool failed." },
        status: "error",
        latencyMs,
      });
      await this.observer.recordTool(trace, {
        investigationId,
        toolName,
        latencyMs,
        startedAt: toolStartTime,
        endedAt: new Date(),
        success: false,
        metadata: { errorName: error instanceof Error ? error.name : "unknown" },
      });
      throw error;
    }
  }

  private recordGeneration(
    trace: InvestigationTraceContext,
    event: Parameters<InvestigationObserver["recordGeneration"]>[1],
  ): Promise<void> {
    return this.observer.recordGeneration(trace, event);
  }

  private summarizeToolOutput(output: unknown): Record<string, unknown> {
    if (Array.isArray(output)) return { resultCount: output.length };
    if (output && typeof output === "object") return { resultType: "object" };
    return { resultType: typeof output };
  }
}
