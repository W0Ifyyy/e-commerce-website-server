import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from 'src/products/dtos/CreateProductDto';
import { UpdateProductDto } from 'src/products/dtos/UpdateProductDto';
import { Public } from 'utils/publicDecorator';

@Controller('products')
export class ProductsController {
  constructor(private productService: ProductsService) {}
  @Public()
  @Get()
  getProducts() {
    return this.productService.getProducts();
  }
  @Public()
  @Get('search') // route is now /products/search?name=xxx
  getProductsBySearch(@Query('name') name: string) {
    return this.productService.getProductsByNameSearch(name);
  }
  @Public()
  @Get(':id')
  getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getProductById(id);
  }
  @Public()
  @Post('/all')
  getProductsByIds(
    @Body('ids', new ParseArrayPipe({ items: Number }))
    ids: number[],
  ) {
    return this.productService.getProductsByIds(ids);
  }
  @Public()
  @Post()
  @HttpCode(201)
  createProduct(@Body() createProductParams: CreateProductDto) {
    return this.productService.createProduct(createProductParams);
  }
  @Delete(':id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productService.deleteProduct(id);
  }
  @Put(':id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productService.updateProduct(id, updateProductDto);
  }
}
