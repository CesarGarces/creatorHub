export {}; // module scope: keeps mock names local to this file

/**
 * Runs the real seed script against an in-memory fake database to check
 * what it writes, that re-running it is safe, and its data invariants.
 */
type Row = Record<string, unknown>;
type Table = Map<string, Row>;

const mockDb: Record<string, Table> = {};
const mockCalls = {
  create: [] as Array<[string, Row]>,
  update: [] as Array<[string, Row]>,
};

function keyOf(where: Record<string, unknown>): string {
  const [, value] = Object.entries(where)[0]!;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function mockModel(name: string) {
  const table = (mockDb[name] ??= new Map());
  return {
    findUnique: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        table.get(keyOf(where)) ?? null,
    ),
    create: jest.fn(async ({ data }: { data: Row }) => {
      const key =
        (data.id as string) ??
        (data.slug as string) ??
        JSON.stringify({
          providerSlug: data.providerSlug,
          modelId: data.modelId,
        });
      table.set(key, data);
      mockCalls.create.push([name, data]);
      return data;
    }),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Row;
      }) => {
        const key = keyOf(where);
        const row = { ...(table.get(key) ?? {}), ...data };
        table.set(key, row);
        mockCalls.update.push([name, data]);
        return row;
      },
    ),
  };
}

const mockDisconnect = jest.fn(async () => {});

jest.mock("../../generated/client", () => ({
  PrismaClient: jest.fn(
    () =>
      new Proxy(
        { $disconnect: mockDisconnect },
        {
          get(target: Record<string, unknown>, prop: string) {
            if (prop in target) return target[prop];
            target[prop] = mockModel(prop);
            return target[prop];
          },
        },
      ),
  ),
}));

async function runSeed(): Promise<void> {
  mockDisconnect.mockClear();
  jest.isolateModules(() => {
    require("../seed");
  });
  // The script runs main() on import; wait until it disconnects.
  for (let i = 0; i < 100 && mockDisconnect.mock.calls.length === 0; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(mockDisconnect).toHaveBeenCalled();
}

function rows(table: string): Row[] {
  return Array.from(mockDb[table]?.values() ?? []);
}

beforeEach(() => {
  for (const key of Object.keys(mockDb)) delete mockDb[key];
  mockCalls.create.length = 0;
  mockCalls.update.length = 0;
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("seed", () => {
  it("creates the catalog on an empty database", async () => {
    await runSeed();

    expect(rows("tool").map((t) => t.id)).toEqual([
      "thumbnail-generator",
      "content-translator",
      "video-generator",
      "x-search-trends",
      "x-post-tweet",
    ]);
    expect(rows("subscriptionPlan").map((p) => p.id)).toEqual([
      "free",
      "starter",
      "pro",
    ]);
    expect(rows("creditPlan").map((p) => p.slug)).toEqual([
      "PAY_AS_YOU_GO",
      "STARTER",
      "PRO",
    ]);
    expect(rows("mode")).toHaveLength(8);
    expect(
      rows("provider").some((p) => p.slug === "openrouter" && p.isGateway),
    ).toBe(true);
    expect(rows("modelMetadata").length).toBeGreaterThan(0);
  });

  it("is idempotent: a second run creates nothing and never overwrites admin edits", async () => {
    await runSeed();
    mockDb.tool!.get("thumbnail-generator")!.creditsPerUse = 99; // admin edit
    const created = mockCalls.create.length;

    await runSeed();

    expect(mockCalls.create.length).toBe(created);
    expect(mockDb.tool!.get("thumbnail-generator")!.creditsPerUse).toBe(99);
    expect(mockCalls.update).toHaveLength(0);
  });

  it("re-activates gateway providers that were switched off", async () => {
    await runSeed();
    mockDb.provider!.get("openrouter")!.isActive = false;
    mockDb.provider!.get("siliconflow-video")!.isActive = false;

    await runSeed();

    expect(mockDb.provider!.get("openrouter")!.isActive).toBe(true);
    expect(mockDb.provider!.get("siliconflow-video")!.isActive).toBe(true);
  });

  describe("data invariants", () => {
    beforeEach(runSeed);

    it("prices credit plans consistently (bigger packs are never more expensive per credit)", () => {
      const plans = rows("creditPlan") as Array<{
        usdAmount: number;
        creditsGiven: number;
      }>;
      const perCredit = plans
        .sort((a, b) => a.usdAmount - b.usdAmount)
        .map((p) => p.usdAmount / p.creditsGiven);

      for (let i = 1; i < perCredit.length; i++) {
        expect(perCredit[i]!).toBeLessThanOrEqual(perCredit[i - 1]!);
      }
    });

    it("gives every active model a positive credit cost", () => {
      for (const model of rows("modelMetadata")) {
        if (model.isActive) expect(model.creditCost).toBeGreaterThan(0);
      }
    });

    it("uses unique model ids per provider and unique provider slugs", () => {
      const modelKeys = rows("modelMetadata").map(
        (m) => `${m.providerSlug}/${m.modelId}`,
      );
      expect(new Set(modelKeys).size).toBe(modelKeys.length);

      const slugs = rows("provider").map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  it("always disconnects, even when seeding fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDb.tool = new Map();
    const failing = mockModel("tool");
    failing.findUnique.mockRejectedValue(new Error("connection refused"));
    const { PrismaClient } = jest.requireMock("../../generated/client") as {
      PrismaClient: jest.Mock;
    };
    PrismaClient.mockImplementationOnce(() => ({
      tool: failing,
      $disconnect: mockDisconnect,
    }));

    await runSeed();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "connection refused" }),
    );
  });
});
