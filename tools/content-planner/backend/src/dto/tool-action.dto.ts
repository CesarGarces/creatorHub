import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

/** A platform tool suggested for a session (e.g. by the AI planner). */
export class ToolActionDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,60}$/, {
    message: "toolId must be a tool slug",
  })
  toolId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  intention!: string;

  @IsString()
  @MaxLength(1000)
  prompt!: string;
}
