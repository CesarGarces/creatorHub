import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
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

  @Post(":toolId")
  async addFavorite(@Request() req: any, @Param("toolId") toolId: string) {
    return this.favoritesService.addFavorite(req.user.id, toolId);
  }

  @Delete(":toolId")
  async removeFavorite(@Request() req: any, @Param("toolId") toolId: string) {
    return this.favoritesService.removeFavorite(req.user.id, toolId);
  }

  @Post(":toolId/toggle")
  async toggleFavorite(@Request() req: any, @Param("toolId") toolId: string) {
    return this.favoritesService.toggleFavorite(req.user.id, toolId);
  }
}
