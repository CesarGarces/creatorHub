import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import {
  DASHBOARD_WIDGET_IDS,
  DEFAULT_DASHBOARD_WIDGETS,
} from "@creator-hub/shared-types";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { DashboardLayoutService } from "../dashboard-layout.service";
import { DashboardLayoutController } from "../dashboard-layout.controller";
import { UpdateDashboardLayoutDto } from "../dto/update-dashboard-layout.dto";

const SAVED_AT = new Date("2026-11-20T10:00:00.000Z");
const ids = (list: { id: string }[]) => list.map((w) => w.id);

describe("DashboardLayoutService", () => {
  const service = new DashboardLayoutService();

  beforeEach(() => resetPrismaMock());

  it("returns the default layout to users who never customized it", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    expect(await service.getLayout("u1")).toEqual({
      widgets: [...DEFAULT_DASHBOARD_WIDGETS],
      updatedAt: null,
    });
    expect(prismaMock.dashboardLayout.findUnique).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { widgets: true, updatedAt: true },
    });
  });

  it("returns the saved order, completed with widgets added since", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [
        { id: "activity", visible: true },
        { id: "favorites", visible: false },
        { id: "retired-widget", visible: true },
      ],
      updatedAt: SAVED_AT,
    });

    const layout = await service.getLayout("u1");

    expect(layout.updatedAt).toBe(SAVED_AT.toISOString());
    expect(layout.widgets.slice(0, 2)).toEqual([
      { id: "activity", visible: true },
      { id: "favorites", visible: false },
    ]);
    // Unknown ids dropped, every known widget exactly once.
    expect([...ids(layout.widgets)].sort()).toEqual(
      [...DASHBOARD_WIDGET_IDS].sort(),
    );
  });

  it("upserts the complete, normalized list", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({
      updatedAt: SAVED_AT,
    });

    const layout = await service.saveLayout("u1", [
      { id: "tips", visible: true },
      { id: "credits", visible: true },
    ]);

    const stored = prismaMock.dashboardLayout.upsert.mock.calls[0]![0];
    expect(stored.where).toEqual({ userId: "u1" });
    expect(stored.create).toEqual({ userId: "u1", widgets: layout.widgets });
    expect(stored.update).toEqual({ widgets: layout.widgets });
    expect(ids(layout.widgets)).toEqual([
      "tips",
      "credits",
      "quick-prompt",
      "favorites",
      "today-plans",
      "activity",
      "recommendations",
      "asset-stats",
      "voice-assistant",
    ]);
    expect(layout.updatedAt).toBe(SAVED_AT.toISOString());
  });

  it("reset removes the user's row and answers the default layout", async () => {
    prismaMock.dashboardLayout.deleteMany.mockResolvedValue({ count: 1 });

    expect(await service.resetLayout("u1")).toEqual({
      widgets: [...DEFAULT_DASHBOARD_WIDGETS],
      updatedAt: null,
    });
    expect(prismaMock.dashboardLayout.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });
});

describe("PUT /user/dashboard-layout body", () => {
  // Same options as the global pipe in main.ts.
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: "body", metatype: UpdateDashboardLayoutDto });

  it("accepts an ordered list of known widgets", async () => {
    const body = {
      widgets: [
        { id: "favorites", visible: true },
        { id: "quick-prompt", visible: false },
      ],
    };
    await expect(validate(body)).resolves.toMatchObject(body);
  });

  it("accepts every widget at once and an empty list", async () => {
    await expect(
      validate({ widgets: [...DEFAULT_DASHBOARD_WIDGETS] }),
    ).resolves.toBeDefined();
    await expect(validate({ widgets: [] })).resolves.toBeDefined();
  });

  it.each([
    ["an unknown widget", { widgets: [{ id: "weather", visible: true }] }],
    [
      "a non-boolean visibility",
      { widgets: [{ id: "favorites", visible: "yes" }] },
    ],
    [
      "a repeated widget",
      {
        widgets: [
          { id: "favorites", visible: true },
          { id: "favorites", visible: false },
        ],
      },
    ],
    [
      "more entries than widgets",
      {
        widgets: [
          ...DEFAULT_DASHBOARD_WIDGETS,
          { id: "favorites", visible: true },
        ],
      },
    ],
    ["a missing list", {}],
    ["a list that isn't an array", { widgets: "favorites" }],
    [
      "unexpected fields on a widget",
      { widgets: [{ id: "favorites", visible: true, size: "xl" }] },
    ],
    ["unexpected top-level fields", { widgets: [], userId: "someone-else" }],
  ])("rejects %s", async (_label, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("DashboardLayoutController", () => {
  const service = {
    getLayout: vi.fn(),
    saveLayout: vi.fn(),
    resetLayout: vi.fn(),
  };
  const controller = new DashboardLayoutController(
    service as unknown as DashboardLayoutService,
  );

  beforeEach(() => vi.clearAllMocks());

  it("lives next to the favorites and requires authentication", () => {
    expect(Reflect.getMetadata(PATH_METADATA, DashboardLayoutController)).toBe(
      "user/dashboard-layout",
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, DashboardLayoutController),
    ).toEqual([JwtAuthGuard]);
  });

  it("reads, saves and resets the signed-in user's layout only", async () => {
    const layout = { widgets: [...DEFAULT_DASHBOARD_WIDGETS], updatedAt: null };
    service.getLayout.mockResolvedValue(layout);
    service.saveLayout.mockResolvedValue(layout);
    service.resetLayout.mockResolvedValue(layout);
    const widgets = [{ id: "tips" as const, visible: false }];

    await expect(controller.getLayout("u1")).resolves.toBe(layout);
    await expect(controller.saveLayout("u1", { widgets })).resolves.toBe(
      layout,
    );
    await expect(controller.resetLayout("u1")).resolves.toBe(layout);

    expect(service.getLayout).toHaveBeenCalledWith("u1");
    expect(service.saveLayout).toHaveBeenCalledWith("u1", widgets);
    expect(service.resetLayout).toHaveBeenCalledWith("u1");
  });
});
