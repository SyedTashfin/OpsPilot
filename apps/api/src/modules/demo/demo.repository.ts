import type pg from "pg";
import type {
  BeautyCorpServiceContract,
  DeploymentContract,
  IncidentScenarioContract,
  MetricPointContract,
} from "@opspilot/contracts";
import { runSeed } from "@opspilot/database";

export class DemoRepository {
  constructor(private readonly pool: pg.Pool) {}

  async seedBase(): Promise<void> {
    await runSeed(this.pool);
  }

  async upsertServices(services: readonly BeautyCorpServiceContract[]): Promise<void> {
    for (const service of services) {
      await this.pool.query(
        `INSERT INTO beautycorp_services (name, display_name, description, owner_team, runtime, criticality)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           owner_team = EXCLUDED.owner_team,
           runtime = EXCLUDED.runtime,
           criticality = EXCLUDED.criticality;`,
        [
          service.name,
          service.displayName,
          service.description,
          service.ownerTeam,
          service.runtime,
          service.criticality,
        ],
      );
    }
  }

  async upsertDeployments(deployments: readonly DeploymentContract[]): Promise<void> {
    for (const deployment of deployments) {
      await this.pool.query(
        `WITH service AS (SELECT id FROM beautycorp_services WHERE name = $1)
         INSERT INTO deployments (service_id, version, commit_sha, deployed_by, environment, status, deployed_at, metadata)
         SELECT id, $2, $3, $4, $5, $6, $7, $8::jsonb FROM service
         ON CONFLICT (service_id, version, environment) DO UPDATE SET
           commit_sha = EXCLUDED.commit_sha,
           deployed_by = EXCLUDED.deployed_by,
           status = EXCLUDED.status,
           deployed_at = EXCLUDED.deployed_at,
           metadata = EXCLUDED.metadata;`,
        [
          deployment.serviceName,
          deployment.version,
          deployment.commitSha,
          deployment.deployedBy,
          deployment.environment,
          deployment.status,
          deployment.deployedAt,
          JSON.stringify(deployment.metadata),
        ],
      );
    }
  }

  async insertMetrics(metrics: readonly MetricPointContract[]): Promise<number> {
    let inserted = 0;
    for (const metric of metrics) {
      const result = await this.pool.query(
        `WITH service AS (SELECT id FROM beautycorp_services WHERE name = $1)
         INSERT INTO metric_points (service_id, timestamp, metric_name, metric_value, unit, attributes)
         SELECT id, $2, $3, $4, $5, $6::jsonb FROM service;`,
        [
          metric.serviceName,
          metric.timestamp,
          metric.metricName,
          metric.metricValue,
          metric.unit,
          JSON.stringify(metric.attributes),
        ],
      );
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  }

  async upsertIncidents(incidents: readonly IncidentScenarioContract[]): Promise<number> {
    let count = 0;
    for (const incident of incidents) {
      const existing = await this.pool.query(
        "SELECT id FROM incidents WHERE metadata->>'scenarioId' = $1 LIMIT 1;",
        [incident.id],
      );
      if ((existing.rowCount ?? 0) > 0) {
        count += 1;
        continue;
      }
      const result = await this.pool.query(
        `WITH service AS (SELECT id FROM beautycorp_services WHERE name = $1)
         INSERT INTO incidents (service_id, title, severity, status, detected_at, started_at, detection_reason, suspected_root_cause, metadata)
         SELECT id, $2, $3, 'detected', $4, $5, $6, $7, $8::jsonb FROM service;`,
        [
          incident.serviceName,
          incident.title,
          incident.severity,
          incident.detectedAt,
          incident.startedAt,
          incident.detectionReason,
          incident.suspectedRootCause,
          JSON.stringify({
            scenarioId: incident.id,
            affectedSignals: incident.affectedSignals,
            synthetic: true,
          }),
        ],
      );
      count += result.rowCount ?? 0;
    }
    return count;
  }
}
