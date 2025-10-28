import { IsOptional, IsString, IsEmail } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateProfileDto {
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
    description: "User email address",
    example: "updated@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: "User phone number",
    example: "+1234567890",
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
