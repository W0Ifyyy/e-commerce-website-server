import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryService } from '../category/category.service';
import { Product } from '../typeorm/entities/Product';           
import { Repository, In, Like } from 'typeorm';
import { ICreateProduct, IUpdateProduct } from '../../utils/Interfaces';  

type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginationMeta;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
    private categoryService: CategoryService,
  ) {}

  private escapeLike(input: string): string{
    return input.replace(/[%_\\]/g, '\\$&');
  }

  private normalizePagination(page: number, limit: number): { page: number; limit: number; skip: number } {
    if (!Number.isInteger(page) || page <= 0) {
      throw new HttpException('Invalid page', HttpStatus.BAD_REQUEST);
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new HttpException('Invalid limit', HttpStatus.BAD_REQUEST);
    }

    const MAX_LIMIT = 100;
    if (limit > MAX_LIMIT) {
      throw new HttpException(`limit must be <= ${MAX_LIMIT}`, HttpStatus.BAD_REQUEST);
    }

    return { page, limit, skip: (page - 1) * limit };
  }

  private buildPaginationMeta(page: number, limit: number, totalItems: number): PaginationMeta {
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    return {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: totalPages !== 0 && page < totalPages,
      hasPrevPage: totalPages !== 0 && page > 1,
    };
  }

  async getProducts() {
    let products = await this.productRepository.find({
      relations: ['orderItems', 'category'],
    });
    if (!products || products.length === 0)
      throw new HttpException('No products found', HttpStatus.NOT_FOUND);
    return products;
  }

  async getProductsPaginated(page: number, limit: number): Promise<PaginatedResponse<Product>> {
    const { skip } = this.normalizePagination(page, limit);

    const [items, totalItems] = await this.productRepository.findAndCount({
      relations: ['orderItems', 'category'],
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    const safeTotalItems = totalItems ?? 0;
    const totalPages = safeTotalItems === 0 ? 0 : Math.ceil(safeTotalItems / limit);

    // If the requested page is out of range, return results as if page=1.
    if ((totalPages === 0 && page !== 1) || (totalPages !== 0 && page > totalPages)) {
      const fallbackItems = safeTotalItems === 0
        ? []
        : await this.productRepository.find({
            relations: ['orderItems', 'category'],
            skip: 0,
            take: limit,
            order: { id: 'ASC' },
          });

      return {
        items: fallbackItems ?? [],
        meta: this.buildPaginationMeta(1, limit, safeTotalItems),
      };
    }

    return {
      items: items ?? [],
      meta: this.buildPaginationMeta(page, limit, safeTotalItems),
    };
  }
  async getProductById(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
    }
    let product = await this.productRepository.findOne({
      where: { id },
      relations: ['orderItems'],
    });
    if (!product)
      throw new HttpException(
        'There is no product with this id',
        HttpStatus.NOT_FOUND,
      );
    return product;
  }
  async getProductsByIds(ids: number[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new HttpException('Invalid product IDs', HttpStatus.BAD_REQUEST);
    }
    const products = await this.productRepository.find({
      where: { id: In(ids) },
      relations: ['orderItems', 'category'],
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
    const query = name?.trim();
    if (!query) {
      throw new HttpException('Invalid product name', HttpStatus.BAD_REQUEST);
    }

    if(query.length > 100){
      throw new HttpException('Query too long', HttpStatus.BAD_REQUEST);
    }

    const escaped = this.escapeLike(query);

    const products = await this.productRepository.createQueryBuilder('product')
    .leftJoinAndSelect('product.orderItems', 'orderItems')
    .leftJoinAndSelect('product.category', 'category')
    .where("product.name LIKE :name ESCAPE '\\\\'", {name: `%${escaped}`})
    .getMany();

    if (!products) {
      throw new HttpException(
        'No products found matching this name',
        HttpStatus.NOT_FOUND,
      );
    }

    if (products.length === 0) return null;

    return products;
  }

  async getProductsByNameSearchPaginated(
    name: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<Product>> {
    const query = name?.trim();
    if (!query) {
      throw new HttpException('Invalid product name', HttpStatus.BAD_REQUEST);
    }

    if (query.length > 100) {
      throw new HttpException('Query too long', HttpStatus.BAD_REQUEST);
    }

    const { skip } = this.normalizePagination(page, limit);
    const escaped = this.escapeLike(query);

    const [items, totalItems] = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.orderItems', 'orderItems')
      .leftJoinAndSelect('product.category', 'category')
      .where("product.name LIKE :name ESCAPE '\\\\'", { name: `%${escaped}` })
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const safeTotalItems = totalItems ?? 0;
    const totalPages = safeTotalItems === 0 ? 0 : Math.ceil(safeTotalItems / limit);

    if ((totalPages === 0 && page !== 1) || (totalPages !== 0 && page > totalPages)) {
      if (safeTotalItems === 0) {
        return {
          items: [],
          meta: this.buildPaginationMeta(1, limit, 0),
        };
      }

      const [fallbackItems] = await this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.orderItems', 'orderItems')
        .leftJoinAndSelect('product.category', 'category')
        .where("product.name LIKE :name ESCAPE '\\\\'", { name: `%${escaped}` })
        .skip(0)
        .take(limit)
        .getManyAndCount();

      return {
        items: fallbackItems ?? [],
        meta: this.buildPaginationMeta(1, limit, safeTotalItems),
      };
    }

    return {
      items: items ?? [],
      meta: this.buildPaginationMeta(page, limit, safeTotalItems),
    };
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
    const categoryEntity = await this.categoryService.getCategoryById(
      params.category,
    );
    if (!categoryEntity) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }
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
