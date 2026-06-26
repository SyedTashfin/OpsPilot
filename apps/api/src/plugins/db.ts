import type pg from "pg";
import { createPool } from "@opspilot/database";
import type { ApiConfig } from "../config.js";

export function createDatabasePool(config: ApiConfig): pg.Pool {
  return createPool({ connectionString: config.databaseUrl });
}
