import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsIn,
} from "class-validator";

export class CreateSampleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsIn(["MANUAL", "CHAT", "TWEET", "POST", "IMPORT"])
  source?: "MANUAL" | "CHAT" | "TWEET" | "POST" | "IMPORT";
}
