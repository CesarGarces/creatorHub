import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { ThrottlerGuard } from "@nestjs/throttler";
import { StyleProfileService } from "./services/style-profile.service";
import { StyleAnalyzerService } from "./services/style-analyzer.service";
import { ContentSampleService } from "./services/content-sample.service";
import { CreateSampleDto } from "./dto/create-sample.dto";
import { BulkCreateSamplesDto } from "./dto/bulk-create-samples.dto";
import { UpdateStyleProfileDto } from "./dto/update-style-profile.dto";

@Controller("user-style")
@UseGuards(JwtAuthGuard)
export class UserStyleController {
  constructor(
    private profileService: StyleProfileService,
    private analyzerService: StyleAnalyzerService,
    private sampleService: ContentSampleService,
  ) {}

  @Get("profile")
  async getProfile(@CurrentUser("id") userId: string) {
    const profile = await this.profileService.getByUserId(userId);
    return { success: true, data: profile };
  }

  @Put("profile")
  async updateProfile(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateStyleProfileDto,
  ) {
    const profile = await this.profileService.update(userId, dto);
    return { success: true, data: profile };
  }

  @Delete("profile")
  async deleteProfile(@CurrentUser("id") userId: string) {
    await this.profileService.delete(userId);
    return { success: true, data: null };
  }

  @Post("analyze")
  @UseGuards(ThrottlerGuard)
  async analyze(@CurrentUser("id") userId: string) {
    const result = await this.analyzerService.analyze(userId);
    return { success: true, data: result };
  }

  @Post("samples")
  async addSample(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateSampleDto,
  ): Promise<{ success: boolean; data: any }> {
    const sample = await this.sampleService.create(userId, dto);
    return { success: true, data: sample };
  }

  @Post("samples/bulk")
  async addBulkSamples(
    @CurrentUser("id") userId: string,
    @Body() dto: BulkCreateSamplesDto,
  ) {
    const result = await this.sampleService.createBulk(userId, dto.samples);
    return { success: true, data: { count: result.count } };
  }

  @Get("samples")
  async listSamples(
    @CurrentUser("id") userId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<{ success: boolean; data: any; meta: any }> {
    const result = await this.sampleService.list(userId, page, limit);
    return { success: true, ...result };
  }

  @Delete("samples/:id")
  async deleteSample(
    @CurrentUser("id") userId: string,
    @Param("id") sampleId: string,
  ) {
    await this.sampleService.delete(userId, sampleId);
    return { success: true, data: null };
  }
}
