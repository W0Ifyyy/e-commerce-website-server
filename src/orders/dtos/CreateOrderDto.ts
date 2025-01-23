import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(1, { message: 'User ID must be valid' })
  @Type(() => Number)
  userId: number;

  @IsArray()
  @IsNotEmpty({ each: true, message: 'Product IDs must be valid' })
  @IsNumber({}, { each: true })
  @Type(() => Number)
  productIds: number[];

  @IsNumber()
  @Min(0, { message: 'Total amount must be at least 0' })
  totalAmount: number;

  @IsEnum(['PENDING', 'COMPLETED', 'CANCELED'], { message: 'Invalid status' })
  status: 'PENDING' | 'COMPLETED' | 'CANCELED';
}
