import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(1, { message: 'User ID must be valid' })
  @Type(() => Number)
  userId: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNumber()
  @Min(0, { message: 'Total amount must be at least 0' })
  totalAmount: number;

  @IsOptional()
  @IsEnum(['PENDING', 'COMPLETED', 'CANCELED'], { message: 'Invalid status' })
  status?: 'PENDING' | 'COMPLETED' | 'CANCELED';
}
