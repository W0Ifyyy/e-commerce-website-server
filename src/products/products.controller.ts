import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from 'src/products/dtos/CreateProductDto';
import { UpdateProductDto } from 'src/products/dtos/UpdateProductDto';
import { Public } from 'utils/publicDecorator';
import { canAccess } from 'utils/canAccess';
import { Request } from 'express';
import { Roles } from 'utils/rolesDecorator';

//add admin access control to create, update, delete product routes
@Controller('products')
export class ProductsController {
  constructor(private productService: ProductsService) {}

  @Public()
  @Get()
  getProducts() {
    return this.productService.getProducts();
  }
  @Public()
  @Get('search') 
  getProductsBySearch(@Query('name') name: string) {
    return this.productService.getProductsByNameSearch(name);
  }

   @Public()
  @Get('all')
  getProductsByIds(@Query('ids') ids: string | string[]) {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) {
      throw new HttpException('Query parameter "ids" is required', HttpStatus.BAD_REQUEST);
    }

    const raw = Array.isArray(ids) ? ids.join(',') : ids;

    // allow a reasonable URL length
    if (raw.length > 2000) {
      throw new HttpException('Query parameter "ids" is too long', HttpStatus.BAD_REQUEST);
    }

    const tokens = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      throw new HttpException(
        'Query parameter "ids" must be a comma-separated list of positive integers (e.g. ids=1,2,3)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (tokens.length > 200) {
      throw new HttpException('Too many ids requested', HttpStatus.BAD_REQUEST);
    }

    // only allow digits
    const parsedIds = tokens.map((t) => {
      if (!/^\d+$/.test(t)) return NaN;
      return parseInt(t, 10);
    });

    if (parsedIds.some((n) => !Number.isInteger(n) || n <= 0)) {
      throw new HttpException(
        'Query parameter "ids" must be a comma-separated list of positive integers (e.g. ids=1,2,3)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const uniqueIds = [...new Set(parsedIds)];
    return this.productService.getProductsByIds(uniqueIds);
  }

  @Public()
  @Get(':id')
  getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getProductById(id);
  }

  @Roles("admin")
  @Post()
  @HttpCode(201)
  createProduct(@Body() createProductParams: CreateProductDto) {
    return this.productService.createProduct(createProductParams);
  }
  @Roles("admin")
  @Delete(':id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productService.deleteProduct(id);
  }
  
  @Roles("admin")
  @Put(':id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productService.updateProduct(id, updateProductDto);
  }
}
