import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
  IsStrongPassword,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export enum UserRoleDto {
  USER = "USER",
  ADMIN = "ADMIN",
}

export enum UserPlanDto {
  FREE = "FREE",
  PAY_AS_YOU_GO = "PAY_AS_YOU_GO",
  PREMIUM = "PREMIUM",
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsStrongPassword({ minLength: 8 })
  password!: string;

  @IsEnum(UserRoleDto)
  @IsOptional()
  role?: UserRoleDto;

  @IsEnum(UserPlanDto)
  @IsOptional()
  plan?: UserPlanDto;

  @IsInt()
  @Min(0)
  @IsOptional()
  freeCredits?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  purchasedCredits?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateUserBaseDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEnum(UserRoleDto)
  @IsOptional()
  role?: UserRoleDto;

  @IsEnum(UserPlanDto)
  @IsOptional()
  plan?: UserPlanDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUserDto extends PartialType(UpdateUserBaseDto) {}
