import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../typeorm/entities/Product';
import { CategoryService } from '../category/category.service';
import { In, Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: Repository<Product>;

  const mockProductRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockCategoryService = {
    getCategoryById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProducts', () => {
    it('should return all products with relations', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Laptop',
          price: 999,
          description: 'Gaming laptop',
          category: { id: 1, name: 'Electronics' },
          orderItems: [],
        },
        {
          id: 2,
          name: 'Mouse',
          price: 50,
          description: 'Wireless mouse',
          category: { id: 1, name: 'Electronics' },
          orderItems: [],
        },
      ];

      mockProductRepository.find.mockResolvedValue(mockProducts);

      const result = await service.getProducts();

      expect(result).toEqual(mockProducts);
      expect(mockProductRepository.find).toHaveBeenCalled();
      expect(mockProductRepository.find).toHaveBeenCalledWith({
        relations: ['orderItems', 'category'],
      });
      expect(mockProductRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no products found', async () => {
      mockProductRepository.find.mockResolvedValue([]);

      await expect(service.getProducts()).rejects.toThrow(
        new HttpException('No products found', HttpStatus.NOT_FOUND),
      );

      expect(mockProductRepository.find).toHaveBeenCalled();
    });

    it('should throw error when products is null', async () => {
      mockProductRepository.find.mockResolvedValue(null);

      await expect(service.getProducts()).rejects.toThrow(
        new HttpException('No products found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('getProductById', () => {
    it('should return a product with given id', async () => {
      const mockProduct = {
        id: 1,
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        orderItems: [],
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const result = await service.getProductById(mockProduct.id);

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findOne).toHaveBeenCalled();
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        relations: ['orderItems'],
        where: { id: mockProduct.id },
      });
      expect(mockProductRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw error when there are no products found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.getProductById(999)).rejects.toThrow(
        new HttpException('There is no product with this id', HttpStatus.NOT_FOUND),
      );
      expect(mockProductRepository.findOne).toHaveBeenCalled();
    });

    it('should throw error when the id is zero', async () => {
      await expect(service.getProductById(0)).rejects.toThrow(
        new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw error when the id is negative', async () => {
      await expect(service.getProductById(-1)).rejects.toThrow(
        new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw error when the id is null', async () => {
      await expect(service.getProductById(null as any)).rejects.toThrow(
        new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('getProductsByIds', () => {
    it('should return an array of products with given ids', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Laptop',
          description: 'Fancy laptop',
          price: 999,
          orderItems: [],
        },
        {
          id: 2,
          name: 'TV',
          description: 'Fancy tv',
          price: 1500,
          orderItems: [],
        },
      ];
      mockProductRepository.find.mockResolvedValue(mockProducts);

      const result = await service.getProductsByIds([1, 2]);

      expect(result).toEqual(mockProducts);
      expect(mockProductRepository.find).toHaveBeenCalled();
      expect(mockProductRepository.find).toHaveBeenCalledWith({
        relations: ['orderItems', 'category'],
        where: { id: In([1, 2]) },
      });
      expect(mockProductRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should throw a bad request error when ids is null', async () => {
      await expect(service.getProductsByIds(null as any)).rejects.toThrow(
        new HttpException('Invalid product IDs', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw a bad request error when ids array is empty', async () => {
      await expect(service.getProductsByIds([])).rejects.toThrow(
        new HttpException('Invalid product IDs', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw error when products not found', async () => {
      mockProductRepository.find.mockResolvedValue([]);

      await expect(service.getProductsByIds([999, 888])).rejects.toThrow(
        new HttpException('No products found for the given IDs', HttpStatus.NOT_FOUND),
      );
      expect(mockProductRepository.find).toHaveBeenCalled();
    });
  });

  describe('getProductsByNameSearch', () => {
    let qb: any;

    beforeEach(() => {
      qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };
      (mockProductRepository as any).createQueryBuilder = jest.fn().mockReturnValue(qb);
    });

    it('should return an array of products matching the name search', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Laptop',
          description: 'Fancy laptop',
          price: 999,
          orderItems: [],
        },
      ];
      qb.getMany.mockResolvedValue(mockProducts);

      const result = await service.getProductsByNameSearch('Lap');

      expect(result).toEqual(mockProducts);

      expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith('product');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('product.orderItems', 'orderItems');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('product.category', 'category');

      // current implementation passes `%${escaped}` (no trailing %)
      expect(qb.where).toHaveBeenCalledWith(
        "product.name LIKE :name ESCAPE '\\\\'",
        { name: '%Lap' },
      );

      expect(qb.getMany).toHaveBeenCalledTimes(1);
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw bad request error when name is empty', async () => {
      await expect(service.getProductsByNameSearch('')).rejects.toThrow(
        new HttpException('Invalid product name', HttpStatus.BAD_REQUEST),
      );
      expect((mockProductRepository as any).createQueryBuilder).not.toHaveBeenCalled();
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw bad request error when name is null', async () => {
      await expect(service.getProductsByNameSearch(null as any)).rejects.toThrow(
        new HttpException('Invalid product name', HttpStatus.BAD_REQUEST),
      );
      expect((mockProductRepository as any).createQueryBuilder).not.toHaveBeenCalled();
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw bad request error when query is too long', async () => {
      const long = 'a'.repeat(101);

      await expect(service.getProductsByNameSearch(long)).rejects.toThrow(
        new HttpException('Query too long', HttpStatus.BAD_REQUEST),
      );
      expect((mockProductRepository as any).createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should return null when no products found matching the name', async () => {
      qb.getMany.mockResolvedValue([]);

      const result = await service.getProductsByNameSearch('DontExist');

      expect(result).toBeNull();
      expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith('product');
      expect(qb.getMany).toHaveBeenCalledTimes(1);
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw error when products is null or undefined', async () => {
      qb.getMany.mockResolvedValue(null);

      await expect(service.getProductsByNameSearch('Laptop')).rejects.toThrow(
        new HttpException('No products found matching this name', HttpStatus.NOT_FOUND),
      );

      expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith('product');
      expect(qb.getMany).toHaveBeenCalledTimes(1);
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('getProductsPaginated', () => {
    it('should return paginated items and meta', async () => {
      const mockProducts = [
        { id: 1, name: 'Laptop', description: 'Fancy laptop', price: 999, orderItems: [], category: { id: 1 } },
      ];

      mockProductRepository.findAndCount.mockResolvedValue([mockProducts, 25]);

      const result = await service.getProductsPaginated(2, 10);

      expect(result.items).toEqual(mockProducts);
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });

      expect(mockProductRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['orderItems', 'category'],
        skip: 10,
        take: 10,
        order: { id: 'ASC' },
      });
    });

    it('should fall back to page 1 when page is out of range (non-empty dataset)', async () => {
      // totalItems=1 => totalPages=1; requesting page 2 should return page 1
      mockProductRepository.findAndCount.mockResolvedValue([[], 1]);
      const firstPageItems = [{ id: 1, name: 'Laptop' }];
      mockProductRepository.find.mockResolvedValue(firstPageItems);

      const result = await service.getProductsPaginated(2, 10);

      expect(result.items).toEqual(firstPageItems);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(mockProductRepository.find).toHaveBeenCalledWith({
        relations: ['orderItems', 'category'],
        skip: 0,
        take: 10,
        order: { id: 'ASC' },
      });
    });

    it('should fall back to page 1 when page is out of range (empty dataset)', async () => {
      mockProductRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getProductsPaginated(100, 10);

      expect(result.items).toEqual([]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should throw bad request for invalid page/limit', async () => {
      await expect(service.getProductsPaginated(0, 10)).rejects.toThrow(
        new HttpException('Invalid page', HttpStatus.BAD_REQUEST),
      );
      await expect(service.getProductsPaginated(1, 0)).rejects.toThrow(
        new HttpException('Invalid limit', HttpStatus.BAD_REQUEST),
      );
      await expect(service.getProductsPaginated(1, 101)).rejects.toThrow(
        new HttpException('limit must be <= 100', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('getProductsByNameSearchPaginated', () => {
    let qb: any;

    beforeEach(() => {
      qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
      };
      (mockProductRepository as any).createQueryBuilder = jest.fn().mockReturnValue(qb);
    });

    it('should return paginated search results with meta', async () => {
      const mockProducts = [
        { id: 1, name: 'Laptop', description: 'Fancy laptop', price: 999, orderItems: [], category: { id: 1 } },
      ];

      qb.getManyAndCount.mockResolvedValue([mockProducts, 11]);

      const result = await service.getProductsByNameSearchPaginated('Lap', 1, 10);

      expect(result.items).toEqual(mockProducts);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 11,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      });

      expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith('product');
      expect(qb.where).toHaveBeenCalledWith(
        "product.name LIKE :name ESCAPE '\\\\'",
        { name: '%Lap' },
      );
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.getManyAndCount).toHaveBeenCalledTimes(1);
    });

    it('should fall back to page 1 when search page is out of range', async () => {
      qb.getManyAndCount.mockResolvedValueOnce([[], 1]);
      qb.getManyAndCount.mockResolvedValueOnce([[{ id: 1, name: 'Laptop' }], 1]);

      const result = await service.getProductsByNameSearchPaginated('Lap', 2, 10);

      expect(result.items).toEqual([{ id: 1, name: 'Laptop' }]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('should validate name and pagination params', async () => {
      await expect(service.getProductsByNameSearchPaginated('', 1, 10)).rejects.toThrow(
        new HttpException('Invalid product name', HttpStatus.BAD_REQUEST),
      );
      await expect(service.getProductsByNameSearchPaginated('Lap', 0, 10)).rejects.toThrow(
        new HttpException('Invalid page', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('createProduct', () => {
    it('should create and return the new product', async () => {
      const createProductParams = {
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        category: 1,
      };

      const mockCategory = { id: 1, name: 'Electronics' };
      const mockProduct = {
        id: 1,
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        category: mockCategory,
      };

      mockProductRepository.findOne.mockResolvedValue(null);
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategory);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      const result = await service.createProduct(createProductParams as any);

      expect(result).toEqual({ msg: 'Product created succesfully!' });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { name: createProductParams.name },
      });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(createProductParams.category);
      expect(mockProductRepository.create).toHaveBeenCalledWith({
        ...createProductParams,
        category: mockCategory,
      });
      expect(mockProductRepository.save).toHaveBeenCalledWith(mockProduct);
    });

    it('should throw error when category not found', async () => {
      const createProductParams = {
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        category: 1,
      };

      mockProductRepository.findOne.mockResolvedValue(null);
      mockCategoryService.getCategoryById.mockResolvedValue(null);

      await expect(service.createProduct(createProductParams as any)).rejects.toThrow(
        new HttpException('Category not found', HttpStatus.NOT_FOUND),
      );

      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { name: createProductParams.name },
      });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(createProductParams.category);
      expect(mockProductRepository.create).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error when product with same name exists', async () => {
      const createProductParams = {
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        category: 1,
      };

      const existingProduct = {
        id: 2,
        name: 'Laptop',
        description: 'Another laptop',
        price: 899,
        category: { id: 1, name: 'Electronics' },
      };

      mockProductRepository.findOne.mockResolvedValue(existingProduct);

      await expect(service.createProduct(createProductParams as any)).rejects.toThrow(
        new HttpException('This product with the same name already exists', HttpStatus.CONFLICT),
      );

      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { name: createProductParams.name },
      });
      expect(mockCategoryService.getCategoryById).not.toHaveBeenCalled();
      expect(mockProductRepository.create).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    it('should delete the product with given id', async () => {
      const mockProduct = {
        id: 1,
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        orderItems: [],
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const result = await service.deleteProduct(mockProduct.id);

      expect(result).toEqual({ msg: 'Product deleted succesfully!', statusCode: 200 });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockProductRepository.delete).toHaveBeenCalledWith({ id: mockProduct.id });
    });

    it('should throw error when id is invalid (0)', async () => {
      await expect(service.deleteProduct(0)).rejects.toThrow(
        new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.findOne).not.toHaveBeenCalled();
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when id is invalid (-1)', async () => {
      await expect(service.deleteProduct(-1)).rejects.toThrow(
        new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.findOne).not.toHaveBeenCalled();
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when product with given id does not exist', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteProduct(999)).rejects.toThrow(
        new HttpException('Product with this id doesnt exist!', HttpStatus.NOT_FOUND),
      );

      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    it('should update and return the product', async () => {
      const mockProduct = {
        id: 1,
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        orderItems: [],
      };

      const updateParams = {
        name: 'Updated Laptop',
        description: 'Updated description',
        price: 1099,
        category: 2,
      };

      const mockCategory = { id: 2, name: 'Computers' };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategory);

      const result = await service.updateProduct(mockProduct.id, updateParams as any);

      expect(result).toEqual({ msg: 'Product updated succesfully!', statusCode: 200 });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(updateParams.category);
      expect(mockProductRepository.save).toHaveBeenCalledWith({
        ...mockProduct,
        ...updateParams,
        category: mockCategory,
      });
    });

    it('should throw error when id is invalid', async () => {
      await expect(service.updateProduct(0, {} as any)).rejects.toThrow(
        new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockProductRepository.findOne).not.toHaveBeenCalled();
      expect(mockCategoryService.getCategoryById).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error when product with given id does not exist', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.updateProduct(999, {} as any)).rejects.toThrow(
        new HttpException('Product with this id doesnt exist!', HttpStatus.NOT_FOUND),
      );

      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockCategoryService.getCategoryById).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error when category not found', async () => {
      const mockProduct = {
        id: 1,
        name: 'Laptop',
        description: 'Fancy laptop',
        price: 999,
        orderItems: [],
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockCategoryService.getCategoryById.mockResolvedValue(null);

      await expect(service.updateProduct(mockProduct.id, { category: 2 } as any)).rejects.toThrow(
        new HttpException('Category not found', HttpStatus.NOT_FOUND),
      );

      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(2);
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
  });
});