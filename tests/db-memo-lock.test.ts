import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewIntention } from "../src/lib/db";

const execute = vi.fn();
const select = vi.fn();

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(async () => ({ execute, select })),
  },
}));

const intention = (date:string): NewIntention => ({
  mass_date: date,
  mass_time: "18:00",
  offerer_first_name: "Don",
  offerer_last_name: "Giacomo",
  offerer_phone: "",
  intention_text: "A ricordo di Famiglia Rossi",
  remembered_person: "Famiglia Rossi",
  offering_cents: 1500,
  payment_method: "Contanti",
  internal_notes: "",
});

describe("salvataggio promemoria senza lock SQLite", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    select.mockReset();
    let intentionId = 20;
    execute.mockImplementation(async (sql: string) => {
      if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql.trim())) throw new Error("database is locked");
      if (sql.includes("INSERT INTO mass_memos")) return { lastInsertId: 10, rowsAffected: 1 };
      if (sql.includes("INSERT INTO mass_intentions")) return { lastInsertId: ++intentionId, rowsAffected: 1 };
      return { lastInsertId: 0, rowsAffected: 1 };
    });
    select.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("COUNT(*)")) return [{ count: 0 }];
      if (sql.includes("SELECT receipt_number")) return [{ receipt_number: Number(params?.[0] ?? 1) }];
      return [];
    });
  });

  it("non usa BEGIN/COMMIT/ROLLBACK dal plugin SQL quando crea un promemoria", async () => {
    const { createMassMemo } = await import("../src/lib/db");

    const memo = await createMassMemo([intention("2027-04-15"), intention("2027-10-12")], 3);

    expect(memo.items).toHaveLength(2);
    expect(execute.mock.calls.map(call => String(call[0]).trim())).not.toEqual(expect.arrayContaining(["BEGIN", "COMMIT", "ROLLBACK"]));
  });

  it("serializza due creazioni ravvicinate invece di sovrapporre scritture", async () => {
    const { createMassMemo } = await import("../src/lib/db");

    await Promise.all([
      createMassMemo([intention("2027-04-15")], 3),
      createMassMemo([intention("2027-10-12")], 3),
    ]);

    const memoInsertIndexes = execute.mock.calls
      .map((call, index) => [String(call[0]), index] as const)
      .filter(([sql]) => sql.includes("INSERT INTO mass_memos"))
      .map(([, index]) => index);
    const firstMemoSecondInsert = execute.mock.calls.findIndex((call, index) => index > memoInsertIndexes[0] && String(call[0]).includes("INSERT INTO mass_intentions"));

    expect(memoInsertIndexes[1]).toBeGreaterThan(firstMemoSecondInsert);
  });
});
