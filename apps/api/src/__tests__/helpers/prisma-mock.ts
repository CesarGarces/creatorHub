/**
 * Shared in-memory Prisma mock for API unit tests (no database required).
 *
 * Every `prismaMock.<model>.<method>` is a lazily created `vi.fn()`, so tests
 * only configure what they use. `$transaction` supports both forms Prisma
 * accepts: an array of pending queries or an interactive callback.
 *
 * Usage in a spec file:
 *
 *   vi.mock("@creator-hub/database", async (importOriginal) => {
 *     const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
 *     return { ...(await importOriginal<object>()), prisma: prismaMock };
 *   });
 *   import { prismaMock, resetPrismaMock } from "../../../__tests__/helpers/prisma-mock";
 */
import { vi, type Mock } from "vitest";
import type { Prisma } from "@creator-hub/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMock = Mock<(...args: any[]) => any>;

type PrismaMethod =
  | "findUnique"
  | "findFirst"
  | "findMany"
  | "create"
  | "createMany"
  | "update"
  | "updateMany"
  | "upsert"
  | "delete"
  | "deleteMany"
  | "count"
  | "aggregate"
  | "groupBy";

export type ModelMock = Record<PrismaMethod, AnyMock>;

/** Model delegates use Prisma's camelCase names, e.g. `user`, `aIRequestLog`. */
export type PrismaMock = Record<Uncapitalize<Prisma.ModelName>, ModelMock> & {
  $transaction: AnyMock;
};

const allFns = new Set<AnyMock>();

function trackedFn(): AnyMock {
  const fn: AnyMock = vi.fn();
  allFns.add(fn);
  return fn;
}

function createModelMock(): ModelMock {
  const methods: Record<string, AnyMock> = {};
  return new Proxy(methods as ModelMock, {
    get(target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;
      const methodsByName = target as Record<string, AnyMock>;
      if (!methodsByName[prop]) methodsByName[prop] = trackedFn();
      return methodsByName[prop];
    },
  });
}

function createPrismaMock(): PrismaMock {
  const models: Record<string, ModelMock> = {};
  const $transaction = trackedFn();

  const proxy = new Proxy(models as unknown as PrismaMock, {
    get(target, prop) {
      if (prop === "$transaction") return $transaction;
      if (typeof prop !== "string" || prop === "then") return undefined;
      if (!models[prop]) models[prop] = createModelMock();
      return models[prop];
    },
  });

  return proxy;
}

function defaultTransaction(arg: unknown) {
  if (Array.isArray(arg)) return Promise.all(arg);
  if (typeof arg === "function") return arg(prismaMock);
  throw new Error("prismaMock.$transaction: unsupported argument");
}

export const prismaMock: PrismaMock = createPrismaMock();
prismaMock.$transaction.mockImplementation(defaultTransaction);

/** Clears calls and configured behaviour of every Prisma mock (call in beforeEach). */
export function resetPrismaMock(): void {
  for (const fn of allFns) fn.mockReset();
  prismaMock.$transaction.mockImplementation(defaultTransaction);
}
