import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { ToolFavoritesService } from "./tool-favorites.service";

@Controller("user/favorites")
@UseGuards(JwtAuthGuard)
export class ToolFavoritesController {
  constructor(private favoritesService: ToolFavoritesService) {}

  @Get()
  async getFavorites(@Request() req: any) {
    return this.favoritesService.getFavoriteIds(req.user.id);
  }

  @Post(":toolId/toggle")
  async toggleFavorite(@Request() req: any, @Param("toolId") toolId: string) {
    return this.favoritesService.toggleFavorite(req.user.id, toolId);
  }

  @Post("reorder")
  async reorderFavorites(
    @Request() req: any,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.favoritesService.reorderFavorites(req.user.id, body.orderedIds);
  }
}
