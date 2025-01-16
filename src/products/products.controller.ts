import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from 'src/dtos/CreateProductDto';

@Controller('products')
export class ProductsController {
  constructor(private productService: ProductsService) {}
  @Get()
  getProducts() {
    return this.productService.getProducts();
  }
  @Get(':id')
  getProductById(@Param('id') id: number) {
    return this.productService.getProductsById(id);
  }
  @Post()
  createProduct(@Body() createProductParams: CreateProductDto) {
    return this.productService.createProduct(createProductParams);
  }
}
