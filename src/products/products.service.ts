import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryService } from 'src/category/category.service';
import { Product } from 'src/typeorm/entities/Product';
import { Repository, In, Like } from 'typeorm';
import { ICreateProduct, IUpdateProduct } from 'utils/Interfaces';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
    private categoryService: CategoryService,
  ) {}
  async getProducts() {
    let products = await this.productRepository.find({
      relations: ['orders', 'category'],
    });
    if (!products || products.length === 0)
      throw new HttpException('No products found', HttpStatus.NOT_FOUND);
    return products;
  }
  async getProductById(id: number) {
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
  async getProductsByIds(ids: number[]) {
    console.log(ids);
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new HttpException('Invalid product IDs', HttpStatus.BAD_REQUEST);
    }
    const products = await this.productRepository.find({
      where: { id: In(ids) },
      relations: ['orders', 'category'],
    });
    if (!products || products.length === 0) {
      throw new HttpException(
        'No products found for the given IDs',
        HttpStatus.NOT_FOUND,
      );
    }
    return products;
  }
  async getProductsByNameSearch(name: string) {
    if (!name || name.trim() === '') {
      throw new HttpException('Invalid product name', HttpStatus.BAD_REQUEST);
    }

    const products = await this.productRepository.find({
      where: { name: Like(`%${name}%`) },
      relations: ['orders', 'category'],
    });

    if (products.length === 0) return null;
    if (!products) {
      throw new HttpException(
        'No products found matching this name',
        HttpStatus.NOT_FOUND,
      );
    }

    return products;
  }
  async createProduct(params: ICreateProduct) {
    let ifExists = await this.productRepository.findOne({
      where: { name: params.name },
    });
    const categoryEntity = await this.categoryService.getCategoryById(
      params.category,
    );
    if (!categoryEntity) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }
    if (ifExists)
      throw new HttpException(
        'This product with the same name already exists',
        HttpStatus.CONFLICT,
      );
    let newProduct = this.productRepository.create({
      ...params,
      category: categoryEntity,
    });
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
    let categoryEntity;
    if (!id || id <= 0) {
      throw new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
    }
    let product = await this.productRepository.findOne({ where: { id } });
    if (!product)
      throw new HttpException(
        'Product with this id doesnt exist!',
        HttpStatus.NOT_FOUND,
      );
    if (params.category) {
      categoryEntity = await this.categoryService.getCategoryById(
        params.category,
      );
      if (!categoryEntity) {
        throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
      }
    }
    await this.productRepository.save({
      ...product,
      ...params,
      category: categoryEntity,
    });
    return { msg: 'Product updated succesfully!', statusCode: 200 };
  }
}
