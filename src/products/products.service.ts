import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProductDto } from 'src/products/dtos/CreateProductDto';
import { Product } from 'src/typeorm/entities/Product';
import { Repository } from 'typeorm';
import { ICreateProduct, IUpdateProduct } from 'utils/Interfaces';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
  ) {}
  async getProducts() {
    let products = await this.productRepository.find({
      relations: ['orders'],
    });
    if (!products || products.length === 0)
      throw new HttpException('No products found', HttpStatus.NOT_FOUND);
    return products;
  }
  async getProductsById(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
    }
    let product = await this.productRepository.findOne({
      where: { id },
      relations: ['orders'],
    });
    if (!product)
      throw new HttpException(
        'There is no product with this id',
        HttpStatus.NOT_FOUND,
      );
    return product;
  }
  async createProduct(params: ICreateProduct) {
    let ifExists = await this.productRepository.findOne({
      where: { name: params.name },
    });
    if (ifExists)
      throw new HttpException(
        'This product with the same name already exists',
        HttpStatus.CONFLICT,
      );
    let newProduct = this.productRepository.create(params);
    await this.productRepository.save(newProduct);
    return { msg: 'Product created succesfully!' };
  }

  async deleteProduct(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
    }
    let product = await this.productRepository.findOne({ where: { id } });
    if (!product)
      throw new HttpException(
        'Product with this id doesnt exist!',
        HttpStatus.NOT_FOUND,
      );
    await this.productRepository.delete({ id });
    return { msg: 'Product deleted succesfully!', statusCode: 200 };
  }

  async updateProduct(id: number, params: IUpdateProduct) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
    }
    let product = await this.productRepository.findOne({ where: { id } });
    if (!product)
      throw new HttpException(
        'Product with this id doesnt exist!',
        HttpStatus.NOT_FOUND,
      );
    await this.productRepository.save({ ...product, ...params });
    return { msg: 'Product updated succesfully!', statusCode: 200 };
  }
}
