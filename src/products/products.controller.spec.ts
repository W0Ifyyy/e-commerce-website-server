import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dtos/CreateProductDto';
import { UpdateProductDto } from './dtos/UpdateProductDto';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockProductsService = {
    getProducts: jest.fn(),
    getProductsPaginated: jest.fn(),
    getProductById: jest.fn(),
    getProductsByIds: jest.fn(),
    getProductsByNameSearch: jest.fn(),
    getProductsByNameSearchPaginated: jest.fn(),
    createProduct: jest.fn(),
    deleteProduct: jest.fn(),
    updateProduct: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProducts', () => {
    it('should return all products', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Laptop',
          description: 'Gaming laptop',
          price: 999,
          category: { id: 1, name: 'Electronics' },
          orderItems: [],
        },
        {
          id: 2,
          name: 'Mouse',
          description: 'Wireless mouse',
          price: 50,
          category: { id: 1, name: 'Electronics' },
          orderItems: [],
        },
      ];
      mockProductsService.getProducts.mockResolvedValue(mockProducts);

      const result = await controller.getProducts();

      expect(result).toEqual(mockProducts);
      expect(service.getProducts).toHaveBeenCalledWith();
      expect(service.getProducts).toHaveBeenCalledTimes(1);
    });

    it('should propagate service errors', async () => {
      const error = new HttpException('No products found', HttpStatus.NOT_FOUND);
      mockProductsService.getProducts.mockRejectedValue(error);

      await expect(controller.getProducts()).rejects.toThrow(error);
      expect(service.getProducts).toHaveBeenCalledTimes(1);
    });

    it('should call paginated service when page/limit provided', async () => {
      const payload = {
        items: [{ id: 1, name: 'Laptop' }],
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockProductsService.getProductsPaginated.mockResolvedValue(payload);

      const result = await controller.getProducts('1', '10');

      expect(result).toEqual(payload);
      expect(service.getProductsPaginated).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('getProductsBySearch', () => {
    it('should return products similar to search query', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Laptop',
          description: 'Gaming laptop',
          price: 999,
          orderItems: [],
        },
      ];
      mockProductsService.getProductsByNameSearch.mockResolvedValue(mockProducts);

      const result = await controller.getProductsBySearch('Lap');

      expect(result).toEqual(mockProducts);
      expect(service.getProductsByNameSearch).toHaveBeenCalledWith('Lap');
      expect(service.getProductsByNameSearch).toHaveBeenCalledTimes(1);
    });

    it('should pass through undefined name (service handles validation)', async () => {
      const error = new HttpException('Invalid product name', HttpStatus.BAD_REQUEST);
      mockProductsService.getProductsByNameSearch.mockRejectedValue(error);

      await expect(controller.getProductsBySearch(undefined as any)).rejects.toThrow(error);
      expect(service.getProductsByNameSearch).toHaveBeenCalledWith(undefined);
    });

    it('should propagate service errors for invalid search', async () => {
      const error = new HttpException('Invalid product name', HttpStatus.BAD_REQUEST);
      mockProductsService.getProductsByNameSearch.mockRejectedValue(error);

      await expect(controller.getProductsBySearch('')).rejects.toThrow(error);
      expect(service.getProductsByNameSearch).toHaveBeenCalledWith('');
    });

    it('should propagate not found errors', async () => {
      const error = new HttpException(
        'No products found matching this name',
        HttpStatus.NOT_FOUND,
      );
      mockProductsService.getProductsByNameSearch.mockRejectedValue(error);

      await expect(controller.getProductsBySearch('NonExistent')).rejects.toThrow(error);
    });

    it('should call paginated search service when page/limit provided', async () => {
      const payload = {
        items: [{ id: 1, name: 'Laptop' }],
        meta: { page: 2, limit: 5, totalItems: 9, totalPages: 2, hasNextPage: false, hasPrevPage: true },
      };
      mockProductsService.getProductsByNameSearchPaginated.mockResolvedValue(payload);

      const result = await controller.getProductsBySearch('Lap', '2', '5');

      expect(result).toEqual(payload);
      expect(service.getProductsByNameSearchPaginated).toHaveBeenCalledWith('Lap', 2, 5);
    });
  });

  describe('getProductById', () => {
    it('should return product with specified id', async () => {
      const mockProduct = {
        id: 1,
        name: 'Laptop',
        description: 'Gaming laptop',
        price: 999,
        orderItems: [],
      };

      mockProductsService.getProductById.mockResolvedValue(mockProduct);

      const result = await controller.getProductById(1);

      expect(result).toEqual(mockProduct);
      expect(service.getProductById).toHaveBeenCalledWith(1);
      expect(service.getProductById).toHaveBeenCalledTimes(1);
    });

    it('should propagate not found errors from service', async () => {
      const error = new HttpException('There is no product with this id', HttpStatus.NOT_FOUND);
      mockProductsService.getProductById.mockRejectedValue(error);

      await expect(controller.getProductById(999)).rejects.toThrow(error);
      expect(service.getProductById).toHaveBeenCalledWith(999);
    });

    it('should propagate bad request errors for invalid id', async () => {
      const error = new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
      mockProductsService.getProductById.mockRejectedValue(error);

      await expect(controller.getProductById(0)).rejects.toThrow(error);
      expect(service.getProductById).toHaveBeenCalledWith(0);
    });
  });

  describe('getProductsByIds', () => {
    it('should parse comma-separated ids and return products', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Laptop',
          description: 'Gaming laptop',
          price: 999,
          orderItems: [],
        },
        {
          id: 2,
          name: 'Mouse',
          description: 'Wireless mouse',
          price: 50,
          orderItems: [],
        },
      ];
      mockProductsService.getProductsByIds.mockResolvedValue(mockProducts);

      const result = await controller.getProductsByIds('1,2');

      expect(result).toEqual(mockProducts);
      expect(service.getProductsByIds).toHaveBeenCalledWith([1, 2]);
      expect(service.getProductsByIds).toHaveBeenCalledTimes(1);
    });

    it('should accept string[] ids and join them', async () => {
      mockProductsService.getProductsByIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await controller.getProductsByIds(['1', '2'] as any);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      expect(service.getProductsByIds).toHaveBeenCalledWith([1, 2]);
      expect(service.getProductsByIds).toHaveBeenCalledTimes(1);
    });

    it('should trim tokens and ignore empty tokens', async () => {
      mockProductsService.getProductsByIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await controller.getProductsByIds(' 1, , 2 ,');

      expect(service.getProductsByIds).toHaveBeenCalledWith([1, 2]);
      expect(service.getProductsByIds).toHaveBeenCalledTimes(1);
    });

    it('should accept repeated ids and call service with unique ids', async () => {
      mockProductsService.getProductsByIds.mockResolvedValue([{ id: 2 }]);

      await controller.getProductsByIds('2,2,2');

      expect(service.getProductsByIds).toHaveBeenCalledWith([2]);
      expect(service.getProductsByIds).toHaveBeenCalledTimes(1);
    });

    it('should throw bad request when ids query param is missing (sync throw)', () => {
      expect(() => controller.getProductsByIds(undefined as any)).toThrow(
        new HttpException('Query parameter "ids" is required', HttpStatus.BAD_REQUEST),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should throw bad request for empty ids array (sync throw)', () => {
      expect(() => controller.getProductsByIds([] as any)).toThrow(
        new HttpException('Query parameter "ids" is required', HttpStatus.BAD_REQUEST),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should throw bad request when ids resolves to no tokens (only commas/whitespace)', () => {
      expect(() => controller.getProductsByIds(' , ,   ,')).toThrow(
        new HttpException(
          'Query parameter "ids" must be a comma-separated list of positive integers (e.g. ids=1,2,3)',
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should throw bad request for non-numeric ids (sync throw)', () => {
      expect(() => controller.getProductsByIds('1,a,2')).toThrow(
        new HttpException(
          'Query parameter "ids" must be a comma-separated list of positive integers (e.g. ids=1,2,3)',
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should throw bad request for zero/negative ids', () => {
      expect(() => controller.getProductsByIds('0,1')).toThrow(
        new HttpException(
          'Query parameter "ids" must be a comma-separated list of positive integers (e.g. ids=1,2,3)',
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(() => controller.getProductsByIds('-1,2')).toThrow(
        new HttpException(
          'Query parameter "ids" must be a comma-separated list of positive integers (e.g. ids=1,2,3)',
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should throw bad request when ids raw string is too long', () => {
      const long = '1,'.repeat(2001); // > 2000 chars
      expect(() => controller.getProductsByIds(long)).toThrow(
        new HttpException('Query parameter "ids" is too long', HttpStatus.BAD_REQUEST),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should throw bad request when too many ids requested (> 200)', () => {
      const ids = Array.from({ length: 201 }, (_, i) => String(i + 1)).join(',');
      expect(() => controller.getProductsByIds(ids)).toThrow(
        new HttpException('Too many ids requested', HttpStatus.BAD_REQUEST),
      );
      expect(service.getProductsByIds).not.toHaveBeenCalled();
    });

    it('should propagate not found errors when no products match', async () => {
      const error = new HttpException('No products found for the given IDs', HttpStatus.NOT_FOUND);
      mockProductsService.getProductsByIds.mockRejectedValue(error);

      await expect(controller.getProductsByIds('999,1000')).rejects.toThrow(error);
      expect(service.getProductsByIds).toHaveBeenCalledWith([999, 1000]);
    });

    it('should propagate generic service errors', async () => {
      const error = new Error('boom');
      mockProductsService.getProductsByIds.mockRejectedValue(error);

      await expect(controller.getProductsByIds('1,2')).rejects.toThrow(error);
      expect(service.getProductsByIds).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe('createProduct', () => {
    it('should create a product with given params', async () => {
      const mockCreateProductParams: CreateProductDto = {
        name: 'New Laptop',
        description: 'Brand new laptop',
        price: 1200,
        category: 1,
        imageUrl: 'https://example.com/laptop.jpg',
      };

      const mockResponse = { msg: 'Product created succesfully!' };
      mockProductsService.createProduct.mockResolvedValue(mockResponse);

      const result = await controller.createProduct(mockCreateProductParams);

      expect(result).toEqual(mockResponse);
      expect(service.createProduct).toHaveBeenCalledWith(mockCreateProductParams);
      expect(service.createProduct).toHaveBeenCalledTimes(1);
    });

    it('should propagate conflict errors for duplicate product names', async () => {
      const mockCreateProductParams: CreateProductDto = {
        name: 'Existing Laptop',
        description: 'Duplicate',
        price: 1200,
        category: 1,
        imageUrl: 'https://example.com/laptop.jpg',
      };

      const error = new HttpException(
        'This product with the same name already exists',
        HttpStatus.CONFLICT,
      );
      mockProductsService.createProduct.mockRejectedValue(error);

      await expect(controller.createProduct(mockCreateProductParams)).rejects.toThrow(error);
      expect(service.createProduct).toHaveBeenCalledWith(mockCreateProductParams);
    });

    it('should propagate not found errors for invalid category', async () => {
      const mockCreateProductParams: CreateProductDto = {
        name: 'New Laptop',
        description: 'Brand new laptop',
        price: 1200,
        category: 999,
        imageUrl: 'https://example.com/laptop.jpg',
      };

      const error = new HttpException('Category not found', HttpStatus.NOT_FOUND);
      mockProductsService.createProduct.mockRejectedValue(error);

      await expect(controller.createProduct(mockCreateProductParams)).rejects.toThrow(error);
      expect(service.createProduct).toHaveBeenCalledWith(mockCreateProductParams);
    });
  });

  describe('deleteProduct', () => {
    it('should delete product with given id', async () => {
      const mockResponse = {
        msg: 'Product deleted succesfully!',
        statusCode: 200,
      };

      mockProductsService.deleteProduct.mockResolvedValue(mockResponse);

      const result = await controller.deleteProduct(1);

      expect(result).toEqual(mockResponse);
      expect(service.deleteProduct).toHaveBeenCalledWith(1);
      expect(service.deleteProduct).toHaveBeenCalledTimes(1);
    });

    it('should propagate not found errors', async () => {
      const error = new HttpException('Product with this id doesnt exist!', HttpStatus.NOT_FOUND);
      mockProductsService.deleteProduct.mockRejectedValue(error);

      await expect(controller.deleteProduct(999)).rejects.toThrow(error);
      expect(service.deleteProduct).toHaveBeenCalledWith(999);
    });

    it('should propagate bad request errors for invalid id', async () => {
      const error = new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
      mockProductsService.deleteProduct.mockRejectedValue(error);

      await expect(controller.deleteProduct(0)).rejects.toThrow(error);
      expect(service.deleteProduct).toHaveBeenCalledWith(0);
    });
  });

  describe('updateProduct', () => {
    it('should update product with given id and params', async () => {
      const mockUpdateProductParams: UpdateProductDto = {
        name: 'Updated Laptop',
        price: 1100,
        category: 1,
      };

      const mockResponse = {
        msg: 'Product updated succesfully!',
        statusCode: 200,
      };

      mockProductsService.updateProduct.mockResolvedValue(mockResponse);

      const result = await controller.updateProduct(1, mockUpdateProductParams);

      expect(result).toEqual(mockResponse);
      expect(service.updateProduct).toHaveBeenCalledWith(1, mockUpdateProductParams);
      expect(service.updateProduct).toHaveBeenCalledTimes(1);
    });

    it('should propagate not found errors for non-existent product', async () => {
      const mockUpdateProductParams: UpdateProductDto = {
        name: 'Updated Laptop',
        category: 1,
      };

      const error = new HttpException('Product with this id doesnt exist!', HttpStatus.NOT_FOUND);
      mockProductsService.updateProduct.mockRejectedValue(error);

      await expect(controller.updateProduct(999, mockUpdateProductParams)).rejects.toThrow(error);
      expect(service.updateProduct).toHaveBeenCalledWith(999, mockUpdateProductParams);
    });

    it('should propagate not found errors for invalid category', async () => {
      const mockUpdateProductParams: UpdateProductDto = {
        category: 999,
      };

      const error = new HttpException('Category not found', HttpStatus.NOT_FOUND);
      mockProductsService.updateProduct.mockRejectedValue(error);

      await expect(controller.updateProduct(1, mockUpdateProductParams)).rejects.toThrow(error);
      expect(service.updateProduct).toHaveBeenCalledWith(1, mockUpdateProductParams);
    });

    it('should propagate bad request errors for invalid id', async () => {
      const mockUpdateProductParams: UpdateProductDto = {
        name: 'Updated Laptop',
        category: 1,
      };

      const error = new HttpException('Invalid product ID', HttpStatus.BAD_REQUEST);
      mockProductsService.updateProduct.mockRejectedValue(error);

      await expect(controller.updateProduct(0, mockUpdateProductParams)).rejects.toThrow(error);
      expect(service.updateProduct).toHaveBeenCalledWith(0, mockUpdateProductParams);
    });

    it('should propagate generic service errors', async () => {
      const mockUpdateProductParams: UpdateProductDto = { name: 'X', category: 1 };
      const error = new Error('boom');
      mockProductsService.updateProduct.mockRejectedValue(error);

      await expect(controller.updateProduct(1, mockUpdateProductParams)).rejects.toThrow(error);
      expect(service.updateProduct).toHaveBeenCalledWith(1, mockUpdateProductParams);
    });
  });
});