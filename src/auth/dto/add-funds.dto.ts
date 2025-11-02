import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class AddFundsDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
