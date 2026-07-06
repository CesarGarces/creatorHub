import { IsOptional, IsString } from "class-validator";

export class LikeAssetDto {
  @IsOptional()
  @IsString()
  userId?: string;
}
