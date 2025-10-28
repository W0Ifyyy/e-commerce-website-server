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
});