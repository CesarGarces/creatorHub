import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";

class BulkSampleItem {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsIn(["MANUAL", "CHAT", "TWEET", "POST", "IMPORT"])
  source?: "MANUAL" | "CHAT" | "TWEET" | "POST" | "IMPORT";
}

export class BulkCreateSamplesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkSampleItem)
  samples!: BulkSampleItem[];
}
