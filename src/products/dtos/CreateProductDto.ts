import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'Price must be at least 0' })
  price: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  category: number;

  @IsOptional()
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  imageUrl?: string;
}
