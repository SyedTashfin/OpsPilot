import type { LLMClient } from "@opspilot/llm";
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

    try {
      const logs = await this.runTool(investigationId, 1, "query_logs", { incidentId }, () =>
        this.repository.queryLogs(incident),
      );
      const metrics = await this.runTool(investigationId, 2, "query_metrics", { incidentId }, () =>
        this.repository.queryMetrics(incident),
      );
      const deployments = await this.runTool(
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

      const response = await this.llm.chat({
        messages: [...prompt],
        temperature: 0.1,
        maxTokens: 1200,
      });
      const report = InvestigationReportSchema.parse(JSON.parse(response.content));

      await this.repository.recordStep({
        investigationId,
        stepIndex: 6,
        stepType: "final",
        title: "Investigation report",
        content: JSON.stringify(report, null, 2),
        metadata: { usage: response.usage, model: response.model, provider: response.provider },
      });
      await this.repository.completeInvestigation({
        investigationId,
        report,
        latencyMs: Date.now() - startedAt,
      });

      return { investigationId, report };
    } catch (error) {
      await this.repository.failInvestigation({
        investigationId,
        error: error instanceof Error ? error.message : "Investigation failed.",
      });
      throw error;
    }
  }

  private async runTool<T>(
    investigationId: string,
    stepIndex: number,
    toolName: "query_logs" | "query_metrics" | "get_deployments" | "search_runbooks",
    toolInput: Record<string, unknown>,
    execute: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
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
      throw error;
    }
  }
}
