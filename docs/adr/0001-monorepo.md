# ADR 0001: TypeScript pnpm monorepo

## Status

Accepted

## Context

OpsPilot V1 contains a web dashboard, API, synthetic demo service, and shared packages for domain types, contracts, LLM providers, RAG, telemetry, and database access.

## Decision

Use a `pnpm` workspace monorepo managed with Turborepo.

## Rationale

A monorepo keeps API contracts, domain types, and LLM/telemetry interfaces synchronized while preserving clean service boundaries.
