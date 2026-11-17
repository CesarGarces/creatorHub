/**
 * In-memory Prisma mock for this package's unit tests. Every
 * `prismaMock.<model>.<method>` is a lazily created vi.fn().
 *
 *   vi.mock("@creator-hub/database", async (importOriginal) => ({
 *     ...(await importOriginal<object>()),
 *     prisma: (await import("./helpers/prisma-mock")).prismaMock,
 *   }));
 */
import { vi, type Mock } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = Mock<(...args: any[]) => any>;
type ModelMock = Record<string, AnyMock>;

const models = new Map<string, ModelMock>();

function model(name: string): ModelMock {
  let m = models.get(name);
  if (!m) {
    const fns: Record<string, AnyMock> = {};
    m = new Proxy(fns, {
      get: (target, prop: string) => (target[prop] ??= vi.fn()),
    });
    models.set(name, m);
  }
  return m;
}

export const prismaMock = new Proxy({} as Record<string, ModelMock>, {
  get: (_t, prop) =>
    typeof prop === "string" && prop !== "then" ? model(prop) : undefined,
});

export function resetPrismaMock(): void {
  models.clear();
}
