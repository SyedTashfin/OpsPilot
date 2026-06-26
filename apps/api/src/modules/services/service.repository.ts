import type pg from "pg";

export type ServiceRow = {
  readonly id: string;
  readonly name: string;
  readonly display_name: string;
  readonly description: string;
  readonly owner_team: string;
  readonly runtime: string;
  readonly criticality: string;
  readonly created_at: Date;
};

export class ServiceRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(): Promise<ServiceRow[]> {
    const result = await this.pool.query<ServiceRow>(
      "SELECT id, name, display_name, description, owner_team, runtime, criticality, created_at FROM beautycorp_services ORDER BY name ASC;",
    );
    return result.rows;
  }

  async findByIdOrName(idOrName: string): Promise<ServiceRow | null> {
    const result = await this.pool.query<ServiceRow>(
      `SELECT id, name, display_name, description, owner_team, runtime, criticality, created_at
       FROM beautycorp_services
       WHERE id::text = $1 OR name = $1
       LIMIT 1;`,
      [idOrName],
    );
    return result.rows[0] ?? null;
  }
}
