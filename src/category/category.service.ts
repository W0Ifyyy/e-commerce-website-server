import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/typeorm/entities/Category';
import { Repository } from 'typeorm';
import { ICreateCategory, IUpdateCategory } from 'utils/Interfaces';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}
  async getAllCategories() {
    let categories = await this.categoryRepository.find();
    if (!categories || categories.length === 0)
      throw new HttpException('No categories found', HttpStatus.NOT_FOUND);
    return categories;
  }
  async getAllCategoriesWithDetails(id?: number) {
    if (id) {
      let category = await this.categoryRepository.findOne({
        where: { id },
        relations: ['products'],
      });
      if (!category)
        throw new HttpException(
          'There is no category with this id',
          HttpStatus.NOT_FOUND,
        );
      return category;
    }
    let categories = await this.categoryRepository.find({
      relations: ['products'],
    });
    if (!categories || categories.length === 0)
      throw new HttpException('No categories found', HttpStatus.NOT_FOUND);
    return categories;
  }

  async getCategoryById(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST);
    }
    let category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['products'],
    });
    if (!category)
      throw new HttpException(
        'There is no category with this id',
        HttpStatus.NOT_FOUND,
      );
    return category;
  }

  async createCategory(params: ICreateCategory) {
    let ifExists = await this.categoryRepository.findOne({
      where: { name: params.name },
    });
    if (ifExists)
      throw new HttpException(
        'This category with the same name already exists',
        HttpStatus.CONFLICT,
      );
    let newCategory = this.categoryRepository.create(params);
    await this.categoryRepository.save(newCategory);
    return { msg: 'Category created succesfully!' };
  }

  async deleteCategory(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST);
    }
    let category = await this.categoryRepository.findOne({ where: { id } });
    if (!category)
      throw new HttpException(
        `Category with this id doesnt exist!`,
        HttpStatus.NOT_FOUND,
      );
    await this.categoryRepository.delete({ id });
    return { msg: 'Category deleted succesfully!' };
  }

  async updateCategory(id: number, params: IUpdateCategory) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST);
    }
    let category = await this.categoryRepository.findOne({ where: { id } });
    if (!category)
      throw new HttpException(
        'Category with this id doesnt exist!',
        HttpStatus.NOT_FOUND,
      );
    await this.categoryRepository.update({ id }, params);
    return { msg: 'Category updated succesfully!', statusCode: 200 };
  }
}
