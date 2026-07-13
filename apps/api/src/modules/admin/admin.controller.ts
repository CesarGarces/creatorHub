import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
  ParseEnumPipe,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { CurrentUser } from "@creator-hub/auth";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { DatabaseBackupService } from "./database-backup.service";
import {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderTierDto,
} from "./dto/provider.dto";
import {
  CreateUserDto,
  UpdateUserDto,
  UserPlanDto,
  UserRoleDto,
} from "./dto/user.dto";
import {
  CreateCreditPlanDto,
  UpdateCreditPlanDto,
} from "./dto/credit-plan.dto";
import { CreateModeDto, UpdateModeDto } from "./dto/mode.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly backupService: DatabaseBackupService,
  ) {}

  // ──────────────────────────────────────────────
  // Providers
  // ──────────────────────────────────────────────

  @Get("providers")
  async getProviders(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("tier", new ParseEnumPipe(ProviderTierDto, { optional: true }))
    tier?: ProviderTierDto,
    @Query("isActive", new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ): Promise<any> {
    return this.adminService.findAllProviders({
      page,
      limit,
      search,
      tier,
      isActive,
    });
  }

  @Get("providers/:id")
  async getProvider(@Param("id") id: string): Promise<any> {
    return this.adminService.findProviderById(id);
  }

  @Post("providers")
  async createProvider(
    @Body(ValidationPipe) dto: CreateProviderDto,
  ): Promise<any> {
    return this.adminService.createProvider(dto);
  }

  @Put("providers/:id")
  async updateProvider(
    @Param("id") id: string,
    @Body(ValidationPipe) dto: UpdateProviderDto,
  ): Promise<any> {
    return this.adminService.updateProvider(id, dto);
  }

  @Delete("providers/:id")
  async deleteProvider(@Param("id") id: string): Promise<any> {
    return this.adminService.deleteProvider(id);
  }

  // ──────────────────────────────────────────────
  // Users
  // ──────────────────────────────────────────────

  @Get("users")
  async getUsers(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("role", new ParseEnumPipe(UserRoleDto, { optional: true }))
    role?: UserRoleDto,
    @Query("plan", new ParseEnumPipe(UserPlanDto, { optional: true }))
    plan?: UserPlanDto,
    @Query("isActive", new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ): Promise<any> {
    return this.adminService.findAllUsers({
      page,
      limit,
      search,
      role,
      plan,
      isActive,
    });
  }

  @Get("users/:id")
  async getUser(@Param("id") id: string): Promise<any> {
    return this.adminService.findUserById(id);
  }

  @Post("users")
  async createUser(@Body(ValidationPipe) dto: CreateUserDto): Promise<any> {
    return this.adminService.createUser(dto);
  }

  @Put("users/:id")
  async updateUser(
    @Param("id") id: string,
    @Body(ValidationPipe) dto: UpdateUserDto,
    @CurrentUser() actor: { id: string; role: string },
  ): Promise<any> {
    return this.adminService.updateUser(id, dto, actor.id);
  }

  @Post("users/:id/deactivate")
  async deactivateUser(
    @Param("id") id: string,
    @CurrentUser() actor: { id: string; role: string },
  ): Promise<any> {
    return this.adminService.deactivateUser(id, actor.id);
  }

  @Post("users/:id/activate")
  async activateUser(
    @Param("id") id: string,
    @CurrentUser() actor: { id: string; role: string },
  ): Promise<any> {
    return this.adminService.activateUser(id, actor.id);
  }

  // ──────────────────────────────────────────────
  // Dashboard
  // ──────────────────────────────────────────────

  @Get("dashboard/stats")
  async getDashboardStats(): Promise<any> {
    return this.adminService.getDashboardStats();
  }

  @Get("dashboard/usage")
  async getUsageByProvider(
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<any> {
    return this.adminService.getUsageByProvider(limit);
  }

  @Get("dashboard/favorites")
  async getFavoriteStats(
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<any> {
    return this.adminService.getFavoriteStats(limit);
  }

  @Get("dashboard/top-users")
  async getTopUsers(
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<any> {
    return this.adminService.getTopUsers(limit);
  }

  @Get("dashboard/registrations")
  async getRegistrations(
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<any> {
    return this.adminService.getRegistrations(from, to);
  }

  // ──────────────────────────────────────────────
  // Credit Plans
  // ──────────────────────────────────────────────

  @Get("credit-plans")
  async getCreditPlans(): Promise<any> {
    return this.adminService.findAllCreditPlans();
  }

  @Get("credit-plans/:id")
  async getCreditPlan(@Param("id") id: string): Promise<any> {
    return this.adminService.findCreditPlanById(id);
  }

  @Post("credit-plans")
  async createCreditPlan(
    @Body(ValidationPipe) dto: CreateCreditPlanDto,
  ): Promise<any> {
    return this.adminService.createCreditPlan(dto);
  }

  @Put("credit-plans/:id")
  async updateCreditPlan(
    @Param("id") id: string,
    @Body(ValidationPipe) dto: UpdateCreditPlanDto,
  ): Promise<any> {
    return this.adminService.updateCreditPlan(id, dto);
  }

  @Delete("credit-plans/:id")
  async deleteCreditPlan(@Param("id") id: string): Promise<any> {
    return this.adminService.deleteCreditPlan(id);
  }

  // ──────────────────────────────────────────────
  // Modes
  // ──────────────────────────────────────────────

  @Get("modes")
  async getModes(): Promise<any> {
    return this.adminService.findAllModes();
  }

  @Get("modes/:id")
  async getMode(@Param("id") id: string): Promise<any> {
    return this.adminService.findModeById(id);
  }

  @Post("modes")
  async createMode(@Body(ValidationPipe) dto: CreateModeDto): Promise<any> {
    return this.adminService.createMode(dto);
  }

  @Put("modes/:id")
  async updateMode(
    @Param("id") id: string,
    @Body(ValidationPipe) dto: UpdateModeDto,
  ): Promise<any> {
    return this.adminService.updateMode(id, dto);
  }

  @Delete("modes/:id")
  async deleteMode(@Param("id") id: string): Promise<any> {
    return this.adminService.deleteMode(id);
  }

  // ──────────────────────────────────────────────
  // Tool-Mode Management
  // ──────────────────────────────────────────────

  @Get("tools-with-modes")
  async getToolsWithModes(): Promise<any> {
    return this.adminService.findAllToolsWithModes();
  }

  @Put("tools/:id/modes")
  async setToolModes(
    @Param("id") id: string,
    @Body("modeIds") modeIds: string[],
  ): Promise<any> {
    return this.adminService.setToolModes(id, modeIds || []);
  }

  // ──────────────────────────────────────────────
  // Provider-Mode Management
  // ──────────────────────────────────────────────

  @Put("providers/:id/modes")
  async setProviderModes(
    @Param("id") id: string,
    @Body("modeIds") modeIds: string[],
  ): Promise<any> {
    return this.adminService.setProviderModes(id, modeIds || []);
  }

  // ──────────────────────────────────────────────
  // Database Backups
  // ──────────────────────────────────────────────

  @Get("backups")
  async getBackups(): Promise<any> {
    return this.backupService.listBackups();
  }

  @Post("backups")
  async createBackup(): Promise<any> {
    return this.backupService.createBackup();
  }

  @Delete("backups/:id")
  async deleteBackup(@Param("id") id: string): Promise<any> {
    return this.backupService.deleteBackup(id);
  }

  @Get("backups/:id/download")
  async downloadBackup(@Param("id") id: string): Promise<any> {
    const url = await this.backupService.getBackupDownloadUrl(id);
    return { url };
  }
}
