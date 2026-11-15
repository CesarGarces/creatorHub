import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
// Rate limiting is applied globally (APP_GUARD ThrottlerGuard in AppModule).
import { ContentPlannerService } from "./content-planner.service";
import {
  CreateContentEventDto,
  ListContentEventsQueryDto,
  UpdateContentEventDto,
} from "./dto/content-event.dto";
import {
  CreateContentProjectDto,
  UpdateContentProjectDto,
} from "./dto/content-project.dto";
import {
  CreateCustomPlatformDto,
  CreateCustomTypeDto,
} from "./dto/custom-type.dto";
import { SaveProductionStepsDto } from "./dto/production-step.dto";

@Controller("tools/content-planner")
@UseGuards(JwtAuthGuard)
export class ContentPlannerController {
  constructor(private planner: ContentPlannerService) {}

  // ─── Sessions ──────────────────────────────────────────────────────────

  @Get("events")
  async listEvents(
    @CurrentUser("id") userId: string,
    @Query() query: ListContentEventsQueryDto,
  ) {
    const events = await this.planner.listEvents(userId, query);
    return { success: true, data: events };
  }

  @Post("events")
  async createEvent(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateContentEventDto,
  ) {
    const { event, conflicts } = await this.planner.createEvent(userId, dto);
    return { success: true, data: event, conflicts };
  }

  @Patch("events/:eventId")
  async updateEvent(
    @CurrentUser("id") userId: string,
    @Param("eventId") eventId: string,
    @Body() dto: UpdateContentEventDto,
  ) {
    const { event, conflicts } = await this.planner.updateEvent(
      userId,
      eventId,
      dto,
    );
    return { success: true, data: event, conflicts };
  }

  @Delete("events/:eventId")
  async deleteEvent(
    @CurrentUser("id") userId: string,
    @Param("eventId") eventId: string,
  ) {
    await this.planner.deleteEvent(userId, eventId);
    return { success: true };
  }

  // ─── Summary ───────────────────────────────────────────────────────────

  @Get("stats")
  async getStats(@CurrentUser("id") userId: string) {
    const stats = await this.planner.getStats(userId);
    return { success: true, data: stats };
  }

  // ─── Custom session types ──────────────────────────────────────────────

  @Get("types")
  async listCustomTypes(@CurrentUser("id") userId: string) {
    const types = await this.planner.listCustomTypes(userId);
    return { success: true, data: types };
  }

  @Post("types")
  async createCustomType(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateCustomTypeDto,
  ) {
    const type = await this.planner.createCustomType(userId, dto);
    return { success: true, data: type };
  }

  @Delete("types/:typeId")
  async deleteCustomType(
    @CurrentUser("id") userId: string,
    @Param("typeId") typeId: string,
  ) {
    await this.planner.deleteCustomType(userId, typeId);
    return { success: true };
  }

  // ─── Custom platforms ──────────────────────────────────────────────────

  @Get("platforms")
  async listCustomPlatforms(@CurrentUser("id") userId: string) {
    const platforms = await this.planner.listCustomPlatforms(userId);
    return { success: true, data: platforms };
  }

  @Post("platforms")
  async createCustomPlatform(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateCustomPlatformDto,
  ) {
    const platform = await this.planner.createCustomPlatform(userId, dto);
    return { success: true, data: platform };
  }

  @Delete("platforms/:platformId")
  async deleteCustomPlatform(
    @CurrentUser("id") userId: string,
    @Param("platformId") platformId: string,
  ) {
    await this.planner.deleteCustomPlatform(userId, platformId);
    return { success: true };
  }

  // ─── Production steps template ─────────────────────────────────────────

  @Get("steps")
  async getProductionSteps(@CurrentUser("id") userId: string) {
    const steps = await this.planner.getProductionSteps(userId);
    return { success: true, data: steps };
  }

  @Put("steps")
  async saveProductionSteps(
    @CurrentUser("id") userId: string,
    @Body() dto: SaveProductionStepsDto,
  ) {
    const steps = await this.planner.saveProductionSteps(userId, dto.steps);
    return { success: true, data: steps };
  }

  // ─── Video projects ────────────────────────────────────────────────────

  @Get("projects")
  async listProjects(@CurrentUser("id") userId: string) {
    const projects = await this.planner.listProjects(userId);
    return { success: true, data: projects };
  }

  @Post("projects")
  async createProject(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateContentProjectDto,
  ) {
    const { project, conflicts } = await this.planner.createProject(
      userId,
      dto,
    );
    return { success: true, data: project, conflicts };
  }

  @Patch("projects/:projectId")
  async updateProject(
    @CurrentUser("id") userId: string,
    @Param("projectId") projectId: string,
    @Body() dto: UpdateContentProjectDto,
  ) {
    const project = await this.planner.updateProject(userId, projectId, dto);
    return { success: true, data: project };
  }

  @Delete("projects/:projectId")
  async deleteProject(
    @CurrentUser("id") userId: string,
    @Param("projectId") projectId: string,
  ) {
    await this.planner.deleteProject(userId, projectId);
    return { success: true };
  }
}
