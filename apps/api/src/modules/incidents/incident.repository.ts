import type pg from "pg";
import type { IncidentScenarioContract } from "@opspilot/contracts";

export class IncidentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT i.id, s.name AS "serviceName", i.title, i.severity, i.status, i.detected_at AS "detectedAt",
              i.started_at AS "startedAt", i.detection_reason AS "detectionReason", i.metadata
       FROM incidents i
       JOIN beautycorp_services s ON s.id = i.service_id
       ORDER BY i.detected_at DESC;`,
    );
    return result.rows as Record<string, unknown>[];
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(
      `SELECT i.id, s.name AS "serviceName", i.title, i.severity, i.status, i.detected_at AS "detectedAt",
              i.started_at AS "startedAt", i.detection_reason AS "detectionReason", i.metadata
       FROM incidents i
       JOIN beautycorp_services s ON s.id = i.service_id
       WHERE i.id = $1
       LIMIT 1;`,
      [id],
    );
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }

  async upsertScenario(scenario: IncidentScenarioContract): Promise<string | null> {
    const existing = await this.pool.query<{ id: string }>(
      "SELECT id FROM incidents WHERE metadata->>'scenarioId' = $1 LIMIT 1;",
      [scenario.id],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const result = await this.pool.query<{ id: string }>(
      `WITH service AS (SELECT id FROM beautycorp_services WHERE name = $1)
       INSERT INTO incidents (service_id, title, severity, status, detected_at, started_at, detection_reason, metadata)
       SELECT id, $2, $3, 'detected', $4, $5, $6, $7::jsonb FROM service
       RETURNING id;`,
      [
        scenario.serviceName,
        scenario.title,
        scenario.severity,
        scenario.detectedAt,
        scenario.startedAt,
        scenario.detectionReason,
        JSON.stringify({
          scenarioId: scenario.id,
          affectedSignals: scenario.affectedSignals,
          synthetic: true,
        }),
      ],
    );
    return result.rows[0]?.id ?? null;
  }

  async detectLatest(): Promise<{ incidentId: string | null; detected: boolean; reason: string }> {
    const result = await this.pool.query<{
      service_name: string;
      max_latency: number;
      errors: string;
    }>(
      `SELECT s.name AS service_name,
              MAX(m.metric_value)::float AS max_latency,
              COUNT(l.id)::text AS errors
       FROM beautycorp_services s
       LEFT JOIN metric_points m ON m.service_id = s.id AND m.metric_name = 'p95_latency_ms'
       LEFT JOIN log_entries l ON l.service_id = s.id AND l.level IN ('error', 'fatal')
       WHERE s.name = 'recommendation-service'
       GROUP BY s.name;`,
    );
    const signal = result.rows[0];
    const maxLatency = signal?.max_latency ?? 0;
    const errorCount = Number(signal?.errors ?? 0);

    if (maxLatency < 1200 || errorCount === 0) {
      return { incidentId: null, detected: false, reason: "No V1 incident threshold exceeded." };
    }

    const incidentId = await this.upsertScenario({
      id: "beautycorp-rec-latency-2026-06-26",
      title: "Recommendation latency spike after feature-store timeout deployment",
      serviceName: "recommendation-service",
      severity: "sev2",
      startedAt: "2026-06-26T09:47:00.000Z",
      detectedAt: "2026-06-26T09:58:00.000Z",
      detectionReason:
        "recommendation-service p95 latency exceeded 1200ms and feature-store timeout errors increased after deployment rec-2026.06.1.",
      affectedSignals: [
        "p95_latency_ms",
        "http_error_rate",
        "feature_store_timeout",
        "retry_count",
      ],
    });

    return {
      incidentId,
      detected: incidentId !== null,
      reason:
        "recommendation-service p95 latency exceeded threshold after deployment rec-2026.06.1",
    };
  }
}
