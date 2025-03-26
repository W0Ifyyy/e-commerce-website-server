import { IsInt, IsString, IsUrl, IsDate } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsUrl()
  imageUrl: string;
}
