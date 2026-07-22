import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@creator-hub/database";
import { prisma } from "@creator-hub/database";
import * as bcrypt from "bcryptjs";
import { CreateProviderDto, UpdateProviderDto } from "./dto/provider.dto";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import {
  CreateCreditPlanDto,
  UpdateCreditPlanDto,
} from "./dto/credit-plan.dto";
import { CreateModeDto, UpdateModeDto } from "./dto/mode.dto";

@Injectable()
export class AdminService {
  // ──────────────────────────────────────────────
  // Providers
  // ──────────────────────────────────────────────

  async findAllProviders(params: {
    page?: number;
    limit?: number;
    search?: string;
    tier?: string;
    isActive?: boolean;
  }): Promise<any> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ProviderWhereInput = {};

    if (params.search) {
      where.OR = [
        { slug: { contains: params.search, mode: "insensitive" } },
        { name: { contains: params.search, mode: "insensitive" } },
        { model: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.tier) {
      where.tier = params.tier as Prisma.EnumProviderTierFilter;
    }

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    const [data, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        orderBy: [{ tier: "asc" }, { costPerCredit: "asc" }, { name: "asc" }],
        skip,
        take: limit,
        include: {
          modes: {
            include: { mode: true },
          },
        },
      }),
      prisma.provider.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findProviderById(id: string): Promise<any> {
    const provider = await prisma.provider.findUnique({
      where: { id },
      include: {
        modes: {
          include: { mode: true },
        },
      },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    return provider;
  }

  async createProvider(dto: CreateProviderDto): Promise<any> {
    const existing = await prisma.provider.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `Provider with slug "${dto.slug}" already exists`,
      );
    }

    return prisma.provider.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        model: dto.model,
        tier: dto.tier,
        costPerCredit: dto.costPerCredit,
        isActive: dto.isActive ?? true,
        supportedTasks: dto.supportedTasks,
        config: dto.config
          ? (dto.config as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async updateProvider(id: string, dto: UpdateProviderDto): Promise<any> {
    const provider = await this.findProviderById(id);

    if (dto.slug) {
      const existing = await prisma.provider.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException(
          `Provider with slug "${dto.slug}" already exists`,
        );
      }
    }

    // Protect gateway providers from being deactivated
    // Gateway providers (openrouter, siliconflow-video, etc.) are the source of models
    // and must always remain active
    if (dto.isActive === false && provider.isGateway) {
      throw new BadRequestException(
        `Gateway provider "${provider.slug}" cannot be deactivated. Gateway providers are the source of AI models and must always remain active.`,
      );
    }

    return prisma.provider.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.tier !== undefined && { tier: dto.tier }),
        ...(dto.costPerCredit !== undefined && {
          costPerCredit: dto.costPerCredit,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.supportedTasks !== undefined && {
          supportedTasks: dto.supportedTasks,
        }),
        ...(dto.config !== undefined && {
          config: dto.config
            ? (dto.config as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
      },
    });
  }

  async deleteProvider(id: string): Promise<any> {
    const provider = await this.findProviderById(id);

    // Protect gateway providers from being deleted
    if (provider.isGateway) {
      throw new BadRequestException(
        `Gateway provider "${provider.slug}" cannot be deleted. Gateway providers are the source of AI models.`,
      );
    }

    return prisma.provider.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────
  // Users
  // ──────────────────────────────────────────────

  async findAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    plan?: string;
    isActive?: boolean;
  }): Promise<any> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: "insensitive" } },
        { name: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.role) {
      where.role = params.role as Prisma.EnumUserRoleFilter;
    }

    if (params.plan) {
      where.plan = params.plan as Prisma.EnumUserPlanFilter;
    }

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          currentCredits: true,
          purchasedCredits: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithTotalCredits = data.map((u) => ({
      ...u,
      totalCredits: u.currentCredits,
    }));

    return {
      data: usersWithTotalCredits,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUserById(id: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        currentCredits: true,
        purchasedCredits: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return {
      ...user,
      totalCredits: user.currentCredits,
    };
  }

  async createUser(dto: CreateUserDto): Promise<any> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const created = await prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role ?? "USER",
        plan: (dto.plan ?? "FREE") as any,
        currentCredits: dto.currentCredits ?? 100,
        purchasedCredits: dto.purchasedCredits ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        currentCredits: true,
        purchasedCredits: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return {
      ...created,
      totalCredits: created.currentCredits + created.purchasedCredits,
    };
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    if (dto.email && dto.email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException("User with this email already exists");
      }
    }

    if (dto.isActive === false && id === actorId) {
      throw new ForbiddenException("You cannot deactivate your own account");
    }

    if (dto.isActive === false && user.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: id } },
      });
      if (activeAdmins === 0) {
        throw new ForbiddenException("Cannot deactivate the last active admin");
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.password && {
          passwordHash: await bcrypt.hash(dto.password, 12),
        }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.plan !== undefined && { plan: dto.plan as any }),
        ...(dto.currentCredits !== undefined && {
          currentCredits: dto.currentCredits,
        }),
        ...(dto.purchasedCredits !== undefined && {
          purchasedCredits: dto.purchasedCredits,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        currentCredits: true,
        purchasedCredits: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return {
      ...updated,
      totalCredits: updated.currentCredits + updated.purchasedCredits,
    };
  }

  async deactivateUser(id: string, actorId: string): Promise<any> {
    return this.updateUser(id, { isActive: false }, actorId);
  }

  async activateUser(id: string, actorId: string): Promise<any> {
    return this.updateUser(id, { isActive: true }, actorId);
  }

  // ──────────────────────────────────────────────
  // Dashboard
  // ──────────────────────────────────────────────

  async getDashboardStats(): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalProviders,
      activeProviders,
      totalCreditsUsed,
      totalFavorites,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.provider.count(),
      prisma.provider.count({ where: { isActive: true } }),
      prisma.creditTransaction.aggregate({
        where: { type: "USAGE" },
        _sum: { amount: true },
      }),
      prisma.toolFavorite.count(),
    ]);

    const totalCreditsRemaining = await prisma.user.aggregate({
      _sum: { currentCredits: true, purchasedCredits: true },
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalProviders,
      activeProviders,
      totalCreditsUsed: Math.abs(totalCreditsUsed._sum.amount ?? 0),
      totalCreditsRemaining:
        (totalCreditsRemaining._sum.currentCredits ?? 0) +
        (totalCreditsRemaining._sum.purchasedCredits ?? 0),
      totalFavorites,
    };
  }

  async getUsageByProvider(limit = 10): Promise<any> {
    const usage = await prisma.usageLog.groupBy({
      by: ["toolId"],
      _count: { userId: true },
      _sum: { credits: true },
      orderBy: { _count: { userId: "desc" } },
      take: limit,
    });

    return {
      byProvider: usage.map((u) => ({
        toolId: u.toolId,
        usageCount: u._count.userId,
        totalCredits: Math.abs(u._sum.credits ?? 0),
      })),
    };
  }

  async getFavoriteStats(limit = 10): Promise<any> {
    const stats = await prisma.toolFavorite.groupBy({
      by: ["toolId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });

    return {
      byTool: stats.map((s) => ({
        toolId: s.toolId,
        favoriteCount: s._count.id,
      })),
    };
  }

  async getTopUsers(limit = 10): Promise<any> {
    const usage = await prisma.usageLog.groupBy({
      by: ["userId"],
      _count: { userId: true },
      _sum: { credits: true },
      orderBy: { _count: { userId: "desc" } },
      take: limit,
    });

    const userIds = usage.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      users: usage.map((u) => {
        const user = userMap.get(u.userId);
        return {
          userId: u.userId,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "Unknown",
          userPlan: user?.plan ?? "FREE",
          usageCount: u._count.userId,
          creditsUsed: Math.abs(u._sum.credits ?? 0),
        };
      }),
    };
  }

  async getRegistrations(from?: string, to?: string): Promise<any> {
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = from ? new Date(from) : new Date(endDate);
    startDate.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { createdAt: true },
    });

    const grouped = new Map<string, number>();

    const current = new Date(startDate);
    while (current <= endDate) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
      grouped.set(key, 0);
      current.setDate(current.getDate() + 1);
    }

    for (const user of users) {
      const d = user.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (grouped.has(key)) {
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }
    }

    return {
      byDay: Array.from(grouped.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  // ──────────────────────────────────────────────
  // Credit Plans
  // ──────────────────────────────────────────────

  async findAllCreditPlans(): Promise<any> {
    return prisma.creditPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { usdAmount: "asc" }],
    });
  }

  async findCreditPlanById(id: string): Promise<any> {
    const plan = await prisma.creditPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Credit plan not found");
    return plan;
  }

  async findCreditPlanBySlug(slug: string): Promise<any> {
    const plan = await prisma.creditPlan.findUnique({ where: { slug } });
    if (!plan) throw new NotFoundException("Credit plan not found");
    return plan;
  }

  async createCreditPlan(dto: CreateCreditPlanDto): Promise<any> {
    const existing = await prisma.creditPlan.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `Credit plan with slug "${dto.slug}" already exists`,
      );
    }

    return prisma.creditPlan.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        usdAmount: dto.usdAmount,
        creditsGiven: dto.creditsGiven,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCreditPlan(id: string, dto: UpdateCreditPlanDto): Promise<any> {
    await this.findCreditPlanById(id);

    if (dto.slug) {
      const existing = await prisma.creditPlan.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException(
          `Credit plan with slug "${dto.slug}" already exists`,
        );
      }
    }

    return prisma.creditPlan.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.usdAmount !== undefined && { usdAmount: dto.usdAmount }),
        ...(dto.creditsGiven !== undefined && {
          creditsGiven: dto.creditsGiven,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteCreditPlan(id: string): Promise<any> {
    await this.findCreditPlanById(id);
    return prisma.creditPlan.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────
  // Modes
  // ──────────────────────────────────────────────

  async findAllModes(): Promise<any> {
    return prisma.mode.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        _count: {
          select: { tools: true, providers: true },
        },
      },
    });
  }

  async findModeById(id: string): Promise<any> {
    const mode = await prisma.mode.findUnique({
      where: { id },
      include: {
        tools: { include: { tool: true } },
        providers: { include: { provider: true } },
      },
    });
    if (!mode) throw new NotFoundException("Mode not found");
    return mode;
  }

  async createMode(dto: CreateModeDto): Promise<any> {
    const existing = await prisma.mode.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(
        `Mode with slug "${dto.slug}" already exists`,
      );
    }

    return prisma.mode.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMode(id: string, dto: UpdateModeDto): Promise<any> {
    await this.findModeById(id);

    if (dto.slug) {
      const existing = await prisma.mode.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException(
          `Mode with slug "${dto.slug}" already exists`,
        );
      }
    }

    return prisma.mode.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteMode(id: string): Promise<any> {
    await this.findModeById(id);
    return prisma.mode.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────
  // Tool-Mode Management
  // ──────────────────────────────────────────────

  async findAllToolsWithModes(): Promise<any> {
    const tools = await prisma.tool.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        modes: {
          include: { mode: true },
          orderBy: { mode: { name: "asc" } },
        },
      },
    });

    return tools.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      status: t.status,
      creditsPerUse: t.creditsPerUse,
      modes: t.modes.map((tm) => tm.mode),
    }));
  }

  async setToolModes(toolId: string, modeIds: string[]): Promise<any> {
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) throw new NotFoundException("Tool not found");

    await prisma.toolMode.deleteMany({ where: { toolId } });

    if (modeIds.length > 0) {
      await prisma.toolMode.createMany({
        data: modeIds.map((modeId) => ({ toolId, modeId })),
      });
    }

    return prisma.tool.findUnique({
      where: { id: toolId },
      include: {
        modes: {
          include: { mode: true },
          orderBy: { mode: { name: "asc" } },
        },
      },
    });
  }

  // ──────────────────────────────────────────────
  // Provider-Mode Management
  // ──────────────────────────────────────────────

  async setProviderModes(providerId: string, modeIds: string[]): Promise<any> {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException("Provider not found");

    await prisma.providerMode.deleteMany({ where: { providerId } });

    if (modeIds.length > 0) {
      await prisma.providerMode.createMany({
        data: modeIds.map((modeId) => ({ providerId, modeId })),
      });
    }

    return prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        modes: {
          include: { mode: true },
          orderBy: { mode: { name: "asc" } },
        },
      },
    });
  }

  // ──────────────────────────────────────────────
  // Model Metadata (AI Models)
  // ──────────────────────────────────────────────

  async findAllModels(params: {
    page?: number;
    limit?: number;
    providerSlug?: string;
    taskType?: string;
    tier?: string;
    isActive?: boolean;
    search?: string;
    tags?: string[];
  }): Promise<any> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ModelMetadataWhereInput = {};

    if (params.providerSlug) {
      where.providerSlug = params.providerSlug;
    }

    if (params.taskType) {
      where.taskType = params.taskType;
    }

    if (params.tier) {
      where.tier = params.tier as any;
    }

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    if (params.search) {
      where.OR = [
        { displayName: { contains: params.search, mode: "insensitive" } },
        { modelId: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.tags && params.tags.length > 0) {
      where.tags = { hasSome: params.tags };
    }

    const [data, total] = await Promise.all([
      prisma.modelMetadata.findMany({
        where,
        orderBy: [{ tier: "asc" }, { taskType: "asc" }, { displayName: "asc" }],
        skip,
        take: limit,
      }),
      prisma.modelMetadata.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findModelById(id: string): Promise<any> {
    const model = await prisma.modelMetadata.findUnique({ where: { id } });
    if (!model) {
      throw new NotFoundException(`Model not found: ${id}`);
    }
    return model;
  }

  async updateModelConfig(
    id: string,
    config: {
      isActive?: boolean;
      creditCost?: number;
      profitMargin?: number;
      tier?: string;
      taskType?: string;
    },
  ): Promise<any> {
    const model = await prisma.modelMetadata.findUnique({ where: { id } });
    if (!model) {
      throw new NotFoundException(`Model not found: ${id}`);
    }

    const updated = await prisma.modelMetadata.update({
      where: { id },
      data: {
        ...(config.isActive !== undefined && { isActive: config.isActive }),
        ...(config.creditCost !== undefined && {
          creditCost: config.creditCost,
        }),
        ...(config.profitMargin !== undefined && {
          profitMargin: config.profitMargin,
        }),
        ...(config.tier !== undefined && { tier: config.tier as any }),
        ...(config.taskType !== undefined && { taskType: config.taskType }),
        updatedAt: new Date(),
      },
    });

    // Auto-sync Provider record when model is activated/deactivated
    // Non-blocking: if sync fails, the model update still succeeds
    try {
      await this.syncProviderFromModel(updated);
    } catch (err) {
      console.error("[AdminService] Provider sync failed:", err);
    }

    return updated;
  }

  /**
   * Creates or updates a Provider record from a ModelMetadata entry.
   * This ensures the generation flow always has a matching Provider.
   */
  private async syncProviderFromModel(model: {
    id: string;
    modelId: string;
    displayName: string;
    tier: string;
    creditCost: number;
    isActive: boolean;
    taskType: string;
    providerSlug: string;
  }): Promise<void> {
    const slug = this.toSlug(model.displayName);

    // Determine supported tasks from taskType
    const supportedTasks = [model.taskType];
    if (model.taskType === "text-generation") {
      supportedTasks.push("translator");
    }

    // Find existing provider by model ID
    const existing = await prisma.provider.findFirst({
      where: { model: model.modelId },
    });

    if (existing) {
      // Update existing provider
      await prisma.provider.update({
        where: { id: existing.id },
        data: {
          name: model.displayName,
          tier: model.tier as any,
          costPerCredit: model.creditCost,
          isActive: model.isActive,
          supportedTasks,
        },
      });
    } else if (model.isActive) {
      // Create new provider only if model is active
      const slugExists = await prisma.provider.findUnique({ where: { slug } });
      if (!slugExists) {
        await prisma.provider.create({
          data: {
            slug,
            name: model.displayName,
            model: model.modelId,
            tier: model.tier as any,
            costPerCredit: model.creditCost,
            isActive: true,
            supportedTasks,
          },
        });
      }
    }
  }

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async bulkUpdateModels(
    ids: string[],
    config: {
      isActive?: boolean;
      creditCost?: number;
      profitMargin?: number;
      tier?: string;
      taskType?: string;
    },
  ): Promise<{ updated: number }> {
    const result = await prisma.modelMetadata.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(config.isActive !== undefined && { isActive: config.isActive }),
        ...(config.creditCost !== undefined && {
          creditCost: config.creditCost,
        }),
        ...(config.profitMargin !== undefined && {
          profitMargin: config.profitMargin,
        }),
        ...(config.tier !== undefined && { tier: config.tier as any }),
        ...(config.taskType !== undefined && { taskType: config.taskType }),
        updatedAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async getModelStats(): Promise<any> {
    const [total, active, byProvider, byTaskType, byTier] = await Promise.all([
      prisma.modelMetadata.count(),
      prisma.modelMetadata.count({ where: { isActive: true } }),
      prisma.modelMetadata.groupBy({
        by: ["providerSlug"],
        _count: true,
      }),
      prisma.modelMetadata.groupBy({
        by: ["taskType"],
        _count: true,
      }),
      prisma.modelMetadata.groupBy({
        by: ["tier"],
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      byProvider: Object.fromEntries(
        byProvider.map((p) => [p.providerSlug, p._count]),
      ),
      byTaskType: Object.fromEntries(
        byTaskType.map((t) => [t.taskType, t._count]),
      ),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t._count])),
    };
  }
}
