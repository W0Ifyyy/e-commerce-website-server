import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProductDto } from 'src/dtos/CreateProductDto';
import { Product } from 'src/typeorm/entities/Product';
import { Repository } from 'typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
  ) {}
  async getProducts() {
    // todo add security checks like what if products doesnt exist

    return await this.productRepository.find();
  }
  async getProductsById(id: number) {
    // todo add security checks like what if product doesnt exist
    return await this.productRepository.findOne({
      where: { id },
    });
  }
  async createProduct(params: CreateProductDto) {
    //todo create interface for this, and create security checks like if post already exist etc.
    let newProduct = await this.productRepository.create({ ...params });
    let productCreation = await this.productRepository.save(newProduct);
    return { msg: 'product created succesfully!' };
  }
}
