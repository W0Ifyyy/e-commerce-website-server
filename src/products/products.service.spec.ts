import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../typeorm/entities/Product';
import { CategoryService } from '../category/category.service';  // Changed
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';


describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: Repository<Product>;

  const mockProductRepository = {
    find: jest.fn(),
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
    // TEST 1: Normal case - products exist
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

    // TEST 2: Error case - no products found
    it('should throw error when no products found', async () => {

      mockProductRepository.find.mockResolvedValue([]);

      await expect(service.getProducts()).rejects.toThrow(
        new HttpException('No products found', HttpStatus.NOT_FOUND),
      );

      expect(mockProductRepository.find).toHaveBeenCalled();
    });

    // TEST 3: Error case - null response from database
    it('should throw error when products is null', async () => {

      mockProductRepository.find.mockResolvedValue(null);

      await expect(service.getProducts()).rejects.toThrow(
        new HttpException('No products found', HttpStatus.NOT_FOUND),
      );
    });
  });
  describe("getProductById", () => {
    // TEST 1: Normal case - product exists
    it("should return a product with given id", async () => {
      const mockProduct = {
        id: 1,
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        orderItems: [],
      }
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      const result = await service.getProductById(mockProduct.id);

      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findOne).toHaveBeenCalled();
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        relations: ['orderItems'],
        where: { id: mockProduct.id }
      })

      expect(mockProductRepository.findOne).toHaveBeenCalledTimes(1);
    })
    // Test 2 - Error - Product does not exist
    it("should throw error when there are no products found", async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      await expect(service.getProductById(999)).rejects.toThrow(new HttpException("There is no product with this id", HttpStatus.NOT_FOUND));
      expect(mockProductRepository.findOne).toHaveBeenCalled();
    })
    // Test 3 - Error - Id is zero
    it("should throw error when the id is zero", async () => {
      await expect(service.getProductById(0)).rejects.toThrow(new HttpException("Invalid product ID", HttpStatus.BAD_REQUEST));
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    })
    // Test 4 - Error - Id is negative
    it("should throw error when the id is negative", async () => {
      await expect(service.getProductById(-1)).rejects.toThrow(new HttpException("Invalid product ID", HttpStatus.BAD_REQUEST));
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    })
    //Test 5 - Error - Id is null
    it("should throw error when the id is zero", async () => {
      await expect(service.getProductById(null)).rejects.toThrow(new HttpException("Invalid product ID", HttpStatus.BAD_REQUEST));
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    })
  })
});