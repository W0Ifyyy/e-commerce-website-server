import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dtos/CreateCategoryDto';
import { UpdateCategoryDto } from './dtos/UpdateCategoryDto';
import { Public } from 'utils/publicDecorator';

@Controller('category')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}
  @Public()
  @Get()
  getCategories() {
    return this.categoryService.getAllCategories();
  }
  @Public()
  @Get('details')
  getCategoriesWithDetails() {
    return this.categoryService.getAllCategoriesWithDetails();
  }
  @Public()
  @Get('details/:id')
  getCategoryWithDetails(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getAllCategoriesWithDetails(id);
  }

  @Get(':id')
  getCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getCategoryById(id);
  }

  @Public()
  @Post()
  @HttpCode(201)
  createCategory(@Body() createCategoryParams: CreateCategoryDto) {
    return this.categoryService.createCategory(createCategoryParams);
  }
  @Delete(':id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.deleteCategory(id);
  }
  @Put(':id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory(id, updateCategoryDto);
  }
}
