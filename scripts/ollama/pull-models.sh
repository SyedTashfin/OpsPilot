#!/usr/bin/env sh
set -eu

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
CHAT_MODEL="${OLLAMA_CHAT_MODEL:-qwen2.5:7b-instruct}"
EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"

printf 'Pulling OpsPilot Ollama chat model: %s\n' "$CHAT_MODEL"
OLLAMA_HOST="$OLLAMA_HOST" ollama pull "$CHAT_MODEL"

printf 'Pulling OpsPilot Ollama embedding model: %s\n' "$EMBEDDING_MODEL"
OLLAMA_HOST="$OLLAMA_HOST" ollama pull "$EMBEDDING_MODEL"
