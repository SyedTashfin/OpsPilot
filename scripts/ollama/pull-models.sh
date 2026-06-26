#!/usr/bin/env bash
set -euo pipefail

OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
OLLAMA_CHAT_MODEL="${OLLAMA_CHAT_MODEL:-qwen2.5:7b-instruct}"
OLLAMA_EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"

export OLLAMA_HOST="$OLLAMA_BASE_URL"

echo "Pulling OpsPilot chat model: $OLLAMA_CHAT_MODEL"
ollama pull "$OLLAMA_CHAT_MODEL"

echo "Pulling OpsPilot embedding model: $OLLAMA_EMBEDDING_MODEL"
ollama pull "$OLLAMA_EMBEDDING_MODEL"

echo "Ollama models ready for OpsPilot."
