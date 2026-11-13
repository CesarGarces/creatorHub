/**
 * Jest in-memory Prisma mock: every `prismaMock.<model>.<method>` is a lazily
 * created jest.fn(). `$transaction` supports both array and callback forms.
 *
 *   jest.mock("@creator-hub/database", () => ({
 *     ...jest.requireActual("@creator-hub/database"),
 *     prisma: require("./helpers/prisma-mock").prismaMock,
 *   }));
 */
import type { Prisma } from "@creator-hub/database";

type Fn = jest.Mock;
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
type ModelMock = Record<PrismaMethod, Fn>;
export type PrismaMock = Record<Uncapitalize<Prisma.ModelName>, ModelMock> & {
  $transaction: Fn;
};

const allFns = new Set<Fn>();
const models: Record<string, Record<string, Fn>> = {};

function trackedFn(): Fn {
  const fn = jest.fn();
  allFns.add(fn);
  return fn;
}

const $transaction = trackedFn();

export const prismaMock = new Proxy(models, {
  get(target, prop) {
    if (prop === "$transaction") return $transaction;
    if (typeof prop !== "string" || prop === "then") return undefined;
    if (!target[prop]) {
      target[prop] = new Proxy({} as Record<string, Fn>, {
        get(methods, name) {
          if (typeof name !== "string" || name === "then") return undefined;
          if (!methods[name]) methods[name] = trackedFn();
          return methods[name];
        },
      });
    }
    return target[prop];
  },
}) as unknown as PrismaMock;

function defaultTransaction(arg: unknown) {
  if (Array.isArray(arg)) return Promise.all(arg);
  if (typeof arg === "function") return arg(prismaMock);
  throw new Error("unsupported $transaction argument");
}

export function resetPrismaMock(): void {
  for (const fn of allFns) fn.mockReset();
  $transaction.mockImplementation(defaultTransaction);
}
resetPrismaMock();
