import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from './CreateOrderDto';

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
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Total amount must be at least 0' })
  totalAmount?: number;

  @IsOptional()
  @IsEnum(['PENDING', 'COMPLETED', 'CANCELED'], { message: 'Invalid status' })
  status?: 'PENDING' | 'COMPLETED' | 'CANCELED';
}
