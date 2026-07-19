import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { decodeHistoryCursor, InvestigationRepository } from "./investigation.repository.js";

type HistoryRow = {
  readonly investigationId: string;
  readonly incidentId: string;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly createdAt: string;
  readonly cursorCreatedAt: string;
  readonly completedAt: string | null;
  readonly summary: string | null;
  readonly probableRootCause: string | null;
  readonly confidence: number | null;
};

class HistoryPool {
  readonly calls: { readonly sql: string; readonly values: readonly unknown[] }[] = [];
  constructor(private readonly rows: HistoryRow[]) {}

  query(
    sql: string,
    values: readonly unknown[],
  ): Promise<{ rows: HistoryRow[]; rowCount: number }> {
    this.calls.push({ sql, values });
    if (!sql.includes("ORDER BY inv.created_at DESC, inv.id DESC")) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    const limit = Number(values.at(-1));
    let rows = [...this.rows].sort((a, b) => {
      const byCreated = b.cursorCreatedAt.localeCompare(a.cursorCreatedAt);
      return byCreated || b.investigationId.localeCompare(a.investigationId);
    });
    if (sql.includes("(inv.created_at, inv.id) <")) {
      const [createdAt, id] = values as [string, string, ...unknown[]];
      rows = rows.filter(
        (row) =>
          row.cursorCreatedAt < createdAt ||
          (row.cursorCreatedAt === createdAt && row.investigationId < id),
      );
    }
    if (sql.includes("inv.incident_id =")) {
      const incidentId = values.find(
        (value) => typeof value === "string" && value.startsWith("aaaaaaaa-"),
      );
      if (incidentId) rows = rows.filter((row) => row.incidentId === incidentId);
    }
    if (sql.includes("inv.status =")) {
      const status = values.find((value) => value === "completed" || value === "running");
      if (status) rows = rows.filter((row) => row.status === status);
    }
    return Promise.resolve({ rows: rows.slice(0, limit), rowCount: Math.min(rows.length, limit) });
  }
}

const row = (
  investigationId: string,
  cursorCreatedAt: string,
  overrides: Partial<HistoryRow> = {},
): HistoryRow => ({
  investigationId,
  incidentId: "aaaaaaaa-1111-4111-8111-111111111111",
  status: "completed",
  createdAt: cursorCreatedAt.replace(/(\.\d{3})\d{3}Z$/u, "$1Z"),
  cursorCreatedAt,
  completedAt: null,
  summary: "Safe persisted summary.",
  probableRootCause: "Safe runtime conclusion.",
  confidence: 0.7,
  ...overrides,
});

const cursor = (payload: unknown): string =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

describe("InvestigationRepository history pagination", () => {
  it("returns an empty bounded page", async () => {
    const repository = new InvestigationRepository(new HistoryPool([]) as never);

    await expect(repository.listInvestigationHistory({ pageSize: 10 })).resolves.toEqual({
      items: [],
      pageSize: 10,
      nextCursor: null,
    });
  });

  it("orders by microsecond cursor time and investigation id without gaps or duplicates", async () => {
    const repository = new InvestigationRepository(
      new HistoryPool([
        row("22222222-2222-4222-8222-222222222222", "2026-06-26T10:00:00.123456Z"),
        row("33333333-3333-4333-8333-333333333333", "2026-06-26T10:00:00.123457Z"),
        row("11111111-1111-4111-8111-111111111111", "2026-06-26T09:00:00.000001Z"),
      ]) as never,
    );

    const first = await repository.listInvestigationHistory({ pageSize: 1 });
    expect(first.items.map((item) => item.investigationId)).toEqual([
      "33333333-3333-4333-8333-333333333333",
    ]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await repository.listInvestigationHistory({
      pageSize: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((item) => item.investigationId)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((item) => item.investigationId)).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("applies incident and status filters while preserving cursor pagination bindings", async () => {
    const pool = new HistoryPool([
      row("11111111-1111-4111-8111-111111111111", "2026-06-26T10:00:00.000003Z"),
      row("22222222-2222-4222-8222-222222222222", "2026-06-26T10:00:00.000002Z", {
        incidentId: "bbbbbbbb-2222-4222-8222-222222222222",
        status: "running",
      }),
      row("33333333-3333-4333-8333-333333333333", "2026-06-26T10:00:00.000001Z"),
    ]);
    const repository = new InvestigationRepository(pool as never);

    const first = await repository.listInvestigationHistory({
      pageSize: 1,
      incidentId: "aaaaaaaa-1111-4111-8111-111111111111",
      status: "completed",
    });
    const second = await repository.listInvestigationHistory({
      pageSize: 1,
      cursor: first.nextCursor ?? undefined,
      incidentId: "aaaaaaaa-1111-4111-8111-111111111111",
      status: "completed",
    });

    expect(first.items.map((item) => item.investigationId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(second.items.map((item) => item.investigationId)).toEqual([
      "33333333-3333-4333-8333-333333333333",
    ]);
    expect(pool.calls[0]?.sql).toContain("inv.incident_id = $1::uuid");
    expect(pool.calls[0]?.sql).toContain("inv.status = $2");
    expect(pool.calls[1]?.sql).toContain("(inv.created_at, inv.id) < ($1::timestamptz, $2::uuid)");
    expect(pool.calls[1]?.sql).toContain("inv.incident_id = $3::uuid");
    expect(pool.calls[1]?.sql).toContain("inv.status = $4");
  });

  it("rejects malformed cursors and invalid filter UUIDs before querying", async () => {
    const invalidCursors = [
      "bad",
      cursor({
        createdAt: "2026-06-26T10:00:00.123Z",
        investigationId: "11111111-1111-4111-8111-111111111111",
      }),
      cursor({ createdAt: "2026-06-26T10:00:00.123456Z", investigationId: "not-a-uuid" }),
      cursor({
        createdAt: "2026-06-26T10:00:00.123456Z",
        investigationId: "11111111-1111-4111-8111-111111111111",
        extra: true,
      }),
      cursor({ createdAt: 1, investigationId: "11111111-1111-4111-8111-111111111111" }),
    ];
    for (const badCursor of invalidCursors) {
      const pool = new HistoryPool([]);
      const repository = new InvestigationRepository(pool as never);
      await expect(
        repository.listInvestigationHistory({ pageSize: 10, cursor: badCursor }),
      ).rejects.toThrow(/Malformed investigation history cursor/u);
      expect(pool.calls).toHaveLength(0);
    }

    const pool = new HistoryPool([]);
    const repository = new InvestigationRepository(pool as never);
    await expect(
      repository.listInvestigationHistory({ pageSize: 10, incidentId: "not-a-uuid" }),
    ).rejects.toThrow(/Malformed investigation history cursor/u);
    expect(pool.calls).toHaveLength(0);
    expect(() => decodeHistoryCursor("bad")).toThrow(/Malformed/u);
  });
});
