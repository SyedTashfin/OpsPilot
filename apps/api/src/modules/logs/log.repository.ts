import type pg from "pg";
import type { LogEntryContract } from "@opspilot/contracts";

export type LogFilters = {
  readonly service?: string;
  readonly level?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
};

export class LogRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(filters: LogFilters): Promise<Record<string, unknown>[]> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (filters.service) {
      values.push(filters.service);
      where.push(`s.name = $${values.length}`);
    }
    if (filters.level) {
      values.push(filters.level);
      where.push(`l.level = $${values.length}`);
    }
    if (filters.from) {
      values.push(filters.from);
      where.push(`l.timestamp >= $${values.length}`);
    }
    if (filters.to) {
      values.push(filters.to);
      where.push(`l.timestamp <= $${values.length}`);
    }

    values.push(Math.min(filters.limit ?? 100, 500));
    const limitPlaceholder = `$${values.length}`;
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const result = await this.pool.query(
      `SELECT l.id, s.name AS "serviceName", l.timestamp, l.level, l.message, l.trace_id AS "traceId", l.span_id AS "spanId", l.attributes
       FROM log_entries l
       JOIN beautycorp_services s ON s.id = l.service_id
       ${whereSql}
       ORDER BY l.timestamp DESC
       LIMIT ${limitPlaceholder};`,
      values,
    );
    return result.rows as Record<string, unknown>[];
  }

  async insertBatch(logs: readonly LogEntryContract[]): Promise<number> {
    let inserted = 0;
    for (const log of logs) {
      const result = await this.pool.query(
        `WITH service AS (
           SELECT id FROM beautycorp_services WHERE name = $1
         ), deployment AS (
           SELECT d.id FROM deployments d JOIN service s ON s.id = d.service_id WHERE d.version = $2 LIMIT 1
         )
         INSERT INTO log_entries (service_id, deployment_id, timestamp, level, message, trace_id, span_id, attributes)
         SELECT service.id, deployment.id, $3, $4, $5, $6, $7, $8::jsonb FROM service LEFT JOIN deployment ON true;`,
        [
          log.serviceName,
          log.deploymentVersion ?? null,
          log.timestamp,
          log.level,
          log.message,
          log.traceId ?? null,
          log.spanId ?? null,
          JSON.stringify(log.attributes),
        ],
      );
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  }
}
