import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpException,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { ScriptWriterService } from "./script-writer.service";

@Controller("tools/script-writer")
@UseGuards(JwtAuthGuard)
export class ScriptWriterController {
  constructor(private scriptWriterService: ScriptWriterService) {}

  @Post("generate")
  async generate(
    @CurrentUser("id") userId: string,
    @Body()
    dto: {
      topic: string;
      platform?: string;
      tone?: string;
      hookType?: string;
      targetDuration?: number;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useStyle?: boolean;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NestJS @Res() requires any
    @Res() res: any,
  ) {
    if (!dto.topic?.trim()) {
      throw new HttpException("Topic is required", 400);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const stream = this.scriptWriterService.createStream({
      userId,
      topic: dto.topic,
      platform: dto.platform || "youtube-long",
      tone: dto.tone || "direct",
      hookType: dto.hookType || "mystery",
      targetDuration: dto.targetDuration || 300,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      useStyle: dto.useStyle ?? true,
    });

    stream.on("data", (chunk: string) => {
      res.write(chunk);
    });

    stream.on("end", () => {
      res.end();
    });

    stream.on("error", (error: Error) => {
      const data = JSON.stringify({ type: "error", error: error.message });
      res.write(`data: ${data}\n\n`);
      res.end();
    });

    res.on("close", () => {
      stream.destroy();
    });
  }

  @Get("scripts")
  async getScripts(
    @CurrentUser("id") userId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const result = await this.scriptWriterService.getScripts(
      userId,
      page,
      limit,
    );
    return { success: true, ...result };
  }

  @Get("scripts/:scriptId")
  async getScript(
    @CurrentUser("id") userId: string,
    @Param("scriptId") scriptId: string,
  ) {
    const script = await this.scriptWriterService.getScript(userId, scriptId);
    return { success: true, data: script };
  }

  @Delete("scripts/:scriptId")
  async deleteScript(
    @CurrentUser("id") userId: string,
    @Param("scriptId") scriptId: string,
  ) {
    await this.scriptWriterService.deleteScript(userId, scriptId);
    return { success: true };
  }
}
