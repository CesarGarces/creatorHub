/**
 * The exported `prisma` is a lazy proxy: importing the package must never
 * connect, and the client is created once on first use.
 */
const mockClient = { user: { findMany: jest.fn() }, $disconnect: jest.fn() };
const PrismaClientMock = jest.fn(() => mockClient);
const PrismaPgMock = jest.fn((options: unknown) => ({
  adapter: "pg",
  options,
}));

jest.mock("../../generated/client", () => ({ PrismaClient: PrismaClientMock }));
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: PrismaPgMock }));

type DatabaseModule = typeof import("../index");

function loadFresh(): DatabaseModule {
  delete (globalThis as { prisma?: unknown }).prisma;
  let mod!: DatabaseModule;
  jest.isolateModules(() => {
    mod = require("../index");
  });
  return mod;
}

describe("database client", () => {
  const env = { url: process.env.DATABASE_URL, node: process.env.NODE_ENV };

  beforeEach(() => {
    PrismaClientMock.mockClear();
    PrismaPgMock.mockClear();
  });
  afterEach(() => {
    process.env.DATABASE_URL = env.url;
    process.env.NODE_ENV = env.node;
    delete (globalThis as { prisma?: unknown }).prisma;
  });

  it("does not create a client on import", () => {
    loadFresh();
    expect(PrismaClientMock).not.toHaveBeenCalled();
  });

  it("fails with a clear error when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    const { prisma } = loadFresh();

    expect(() => prisma.user).toThrow("DATABASE_URL is not set");
  });

  it("creates one pg-adapter client on first use and reuses it", () => {
    process.env.DATABASE_URL = "postgresql://u:p@db:5432/app";
    process.env.NODE_ENV = "production";
    const { prisma, getPrisma } = loadFresh();

    expect(prisma.user).toBe(mockClient.user);
    expect(getPrisma()).toBe(mockClient);
    void prisma.$disconnect;

    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
    expect(PrismaPgMock).toHaveBeenCalledWith({
      connectionString: "postgresql://u:p@db:5432/app",
    });
    expect(PrismaClientMock).toHaveBeenCalledWith({
      adapter: {
        adapter: "pg",
        options: { connectionString: "postgresql://u:p@db:5432/app" },
      },
      log: ["error"],
    });
  });

  it("logs queries in development", () => {
    process.env.DATABASE_URL = "postgresql://localhost/dev";
    process.env.NODE_ENV = "development";
    const { getPrisma } = loadFresh();

    getPrisma();

    expect((PrismaClientMock.mock.calls[0] as unknown[])[0]).toMatchObject({
      log: ["query", "error", "warn"],
    });
  });
});
