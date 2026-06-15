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

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Get("dashboard/top-users")
  async getTopUsers(
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<any> {
    return this.adminService.getTopUsers(limit);
  }

  @Get("dashboard/registrations")
  async getRegistrationsByMonth(
    @Query("months", new DefaultValuePipe(12), ParseIntPipe) months: number,
  ): Promise<any> {
    return this.adminService.getRegistrationsByMonth(months);
  }
}
