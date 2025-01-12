import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/typeorm/entities/Product';
import { Repository } from 'typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
  ) {}
  async getProducts() {
    return await this.productRepository.find();
  }
  async getProductsById(id: number) {
    return await this.productRepository.findOne({
      where: { id },
    });
  }
}
