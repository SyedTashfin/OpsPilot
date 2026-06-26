import { describe, expect, it, vi } from "vitest";
import {
  GeminiClient,
  LLMProviderError,
  OllamaClient,
  buildEvaluationPrompt,
  buildIncidentInvestigationPrompt,
  createLLMClient,
  describePackage,
  estimatePromptTokens,
  estimateTokenCount,
  packageName,
} from "./index.js";

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("@opspilot/llm", () => {
  it("exposes package metadata", () => {
    expect(packageName).toBe("@opspilot/llm");
    expect(describePackage()).toContain("LLM");
  });

  it("calls Ollama chat and returns token usage", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        model: "qwen2.5:7b-instruct",
        message: { content: "The deployment likely changed timeout behavior." },
        prompt_eval_count: 42,
        eval_count: 9,
      }),
    );
    const client = new OllamaClient({
      baseUrl: "http://ollama:11434",
      model: "qwen2.5:7b-instruct",
      fetchImpl,
    });

    const response = await client.chat({
      messages: [{ role: "user", content: "Investigate recommendation-service latency." }],
      temperature: 0.1,
      maxTokens: 256,
    });

    expect(response).toMatchObject({
      provider: "ollama",
      model: "qwen2.5:7b-instruct",
      content: "The deployment likely changed timeout behavior.",
      usage: { promptTokens: 42, completionTokens: 9, totalTokens: 51, estimated: false },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://ollama:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("raises a useful Ollama unavailable error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED"));
    const client = new OllamaClient({
      baseUrl: "http://localhost:11434",
      model: "missing-model",
      fetchImpl,
    });

    await expect(
      client.chat({ messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toMatchObject({
      provider: "ollama",
      code: "provider_unavailable",
    });
  });

  it("raises a useful Ollama model missing error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("model not found", { status: 404 }));
    const client = new OllamaClient({
      baseUrl: "http://localhost:11434",
      model: "missing-model",
      fetchImpl,
    });

    await expect(client.chat({ messages: [{ role: "user", content: "hello" }] })).rejects.toThrow(
      "ollama pull missing-model",
    );
  });

  it("keeps Gemini disabled when GEMINI_API_KEY is missing", async () => {
    const client = new GeminiClient({ model: "gemini-1.5-flash" });
    await expect(
      client.chat({ messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toBeInstanceOf(LLMProviderError);
    await expect(
      client.chat({ messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toMatchObject({
      provider: "gemini",
      code: "provider_disabled",
    });
    await expect(client.health()).resolves.toMatchObject({ configured: false, available: false });
  });

  it("calls Gemini without putting credentials in the URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "Likely feature-store timeout." }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6, totalTokenCount: 18 },
      }),
    );
    const client = new GeminiClient({
      credential: "test-credential",
      model: "gemini-1.5-flash",
      fetchImpl,
    });

    const response = await client.chat({
      messages: [
        { role: "system", content: "Use evidence only." },
        { role: "user", content: "Investigate the latency incident." },
      ],
    });

    expect(response).toMatchObject({
      provider: "gemini",
      model: "gemini-1.5-flash",
      content: "Likely feature-store timeout.",
      usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18, estimated: false },
    });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    );
    expect(init).toMatchObject({ method: "POST" });
    expect(init?.headers).toMatchObject({
      "x-goog-api-key": "test-credential",
    });
  });

  it("selects providers from config", () => {
    expect(
      createLLMClient({
        provider: "ollama",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen",
        geminiModel: "gemini",
      }),
    ).toBeInstanceOf(OllamaClient);
    expect(
      createLLMClient({
        provider: "gemini",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen",
        credential: "test-key",
        geminiModel: "gemini-1.5-flash",
      }),
    ).toBeInstanceOf(GeminiClient);
  });

  it("estimates token usage and builds prompts", () => {
    expect(estimateTokenCount("feature store timeout recommendation latency")).toBeGreaterThan(4);
    expect(estimatePromptTokens([{ role: "user", content: "short prompt" }])).toBeGreaterThan(0);
    expect(
      buildIncidentInvestigationPrompt({
        incidentSummary: "latency",
        evidence: ["p95 high"],
        runbookContext: [],
      }),
    ).toHaveLength(2);
    expect(
      buildEvaluationPrompt({ expectedFinding: "timeout", actualFinding: "latency" })[1]?.content,
    ).toContain("Expected finding");
  });
});
