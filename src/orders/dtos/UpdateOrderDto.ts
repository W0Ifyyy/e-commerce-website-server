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

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'User ID must be valid' })
  @Type(() => Number)
  userId?: number;

  @IsOptional()
  @IsArray()
  @IsNotEmpty({ each: true, message: 'Product IDs must be valid' })
  @IsNumber({}, { each: true })
  @Type(() => Number)
  productIds?: number[];

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Total amount must be at least 0' })
  totalAmount?: number;

  @IsOptional()
  @IsEnum(['PENDING', 'COMPLETED', 'CANCELED'], { message: 'Invalid status' })
  status?: 'PENDING' | 'COMPLETED' | 'CANCELED';
}
