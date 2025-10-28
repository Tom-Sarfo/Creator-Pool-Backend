import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "../../entities/user.entity";

export class RegisterDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "User password (minimum 8 characters)",
    example: "password123",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: "User first name",
    example: "John",
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: "User last name",
    example: "Doe",
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: "User phone number",
    example: "+1234567890",
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: "User role",
    enum: UserRole,
    example: UserRole.USER,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
