# LLM provider abstraction

Issue #7 introduces the `@opspilot/llm` package as the only provider-facing boundary for chat model calls.

## Providers

- `ollama` is the default local provider.
- `gemini` is optional and disabled unless `GEMINI_API_KEY` is configured.

## Environment

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b-instruct
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

For host-local development outside Compose, set `OLLAMA_BASE_URL=http://localhost:11434` and pull the configured model:

```bash
ollama pull qwen2.5:7b-instruct
```

## Contract

`LLMClient` exposes:

- `provider`
- `model`
- `chat(request)`
- `health()`

Request/response contracts use Zod schemas exported by `@opspilot/llm`.

## Scope exclusions

This issue intentionally does not implement the investigation agent, Langfuse tracing, dashboard UI, evaluation service, multi-agent orchestration, cloud deployment, Kubernetes, or auto-remediation.
