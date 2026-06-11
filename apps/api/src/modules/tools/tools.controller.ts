import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ToolRegistry } from "@creator-hub/tool-sdk";
import { JwtAuthGuard, Roles, RolesGuard } from "@creator-hub/auth";

@Controller("tools")
@UseGuards(JwtAuthGuard)
export class ToolsController {
  constructor(private toolRegistry: ToolRegistry) {}

  @Get()
  async listTools() {
    return this.toolRegistry.getActive();
  }

  @Get(":id")
  async getTool(@Param("id") id: string) {
    return this.toolRegistry.get(id);
  }

  @Get("routes/all")
  async getRoutes() {
    return this.toolRegistry.getFrontendRoutes();
  }
}
