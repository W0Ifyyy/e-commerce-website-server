import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../typeorm/entities/Product';
import { CategoryService } from '../category/category.service';  // Changed
import { In, Like, Repository } from 'typeorm';
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
  describe("getProductsByIds", () => {
  //Test 1 - Normal case - products and ids exist
  it("should return an array of products with given ids", async () => {
    const mockProducts = [{
      id: 1,
      name: "Laptop",
      description: "Fancy laptop",
      price: 999,
      orderItems: [],
    }, {
       id: 2,
       name: "TV",
       description: "Fancy tv",
       price: 1500,
       orderItems: [],
    }]
    mockProductRepository.find.mockResolvedValue(mockProducts);

    const result = await service.getProductsByIds([1, 2]);

    expect(result).toEqual(mockProducts);
    expect(mockProductRepository.find).toHaveBeenCalled();
    expect(mockProductRepository.find).toHaveBeenCalledWith({
      relations: ['orderItems', 'category'],
      where: { id: In([1, 2]) },
    })
    expect(mockProductRepository.find).toHaveBeenCalledTimes(1);
  })

    //Test 2 - There is no id
  it("should throw an bad request error when ids is null", async () => {
    await expect(service.getProductsByIds(null)).rejects.toThrow(
      new HttpException('Invalid product IDs', HttpStatus.BAD_REQUEST) 
    );
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  })

  //Test 3 - Empty array of ids
  it("should throw an bad request error when ids array is empty", async () => {
    await expect(service.getProductsByIds([])).rejects.toThrow(
      new HttpException('Invalid product IDs', HttpStatus.BAD_REQUEST) 
    );
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  })

  //Test 4 - Products not found
  it("should throw error when products not found", async () => {
    mockProductRepository.find.mockResolvedValue([]);
    await expect(service.getProductsByIds([999, 888])).rejects.toThrow(
      new HttpException("No products found for the given IDs", HttpStatus.NOT_FOUND) 
    );
    expect(mockProductRepository.find).toHaveBeenCalled();
  })
})
 describe("getProductsByNameSearch", () => {
  let qb: any;

  beforeEach(() => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    // mock repository.createQueryBuilder
    (mockProductRepository as any).createQueryBuilder = jest.fn().mockReturnValue(qb);
  });

  // Test 1 - Normal case - products found
  it("should return an array of products matching the name search", async () => {
    const mockProducts = [{
      id: 1,
      name: "Laptop",
      description: "Fancy laptop",
      price: 999,
      orderItems: [],
    }];
    qb.getMany.mockResolvedValue(mockProducts);

    const result = await service.getProductsByNameSearch("Lap");
    expect(result).toEqual(mockProducts);

    expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith("product");
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('product.orderItems', 'orderItems');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('product.category', 'category');

    // ensure WHERE was called with parameterized LIKE (value escapes %, _ and \)
    expect(qb.where).toHaveBeenCalledWith(
      "product.name LIKE :name ESCAPE '\\\\'",
      expect.objectContaining({ name: expect.stringMatching(/^%.*%?$/) })
    );
    expect(qb.getMany).toHaveBeenCalledTimes(1);

    // ensure repository.find is not used anymore
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  });

  // Test 2 - Name is empty string
  it("should throw bad request error when name is empty", async () => {
    await expect(service.getProductsByNameSearch("")).rejects.toThrow(
      new HttpException("Invalid product name", HttpStatus.BAD_REQUEST)
    );
    expect((mockProductRepository as any).createQueryBuilder).not.toHaveBeenCalled();
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  });

  // Test 3 - Name is null
  it("should throw bad request error when name is null", async () => {
    await expect(service.getProductsByNameSearch(null as any)).rejects.toThrow(
      new HttpException("Invalid product name", HttpStatus.BAD_REQUEST)
    );
    expect((mockProductRepository as any).createQueryBuilder).not.toHaveBeenCalled();
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  });

  // Test 4 - No products found
  it("should return null when no products found matching the name", async () => {
    qb.getMany.mockResolvedValue([]);
    const result = await service.getProductsByNameSearch("DontExist");
    expect(result).toBeNull();
    expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith("product");
    expect(qb.getMany).toHaveBeenCalledTimes(1);
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  });

  // Test 5 - Products is null/undefined
  it("should throw error when products is null or undefined", async () => {
    qb.getMany.mockResolvedValue(null);
    await expect(service.getProductsByNameSearch("Laptop")).rejects.toThrow(
      new HttpException("No products found matching this name", HttpStatus.NOT_FOUND)
    );
    expect((mockProductRepository as any).createQueryBuilder).toHaveBeenCalledWith("product");
    expect(qb.getMany).toHaveBeenCalledTimes(1);
    expect(mockProductRepository.find).not.toHaveBeenCalled();
  });
});

  describe("createProduct", () => {
    // Test 1 - Normal case - product created
    it("should create and return the new product", async () => {
      const createProductParams = {
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        category: 1,
      };

      const mockCategory = { id: 1, name: 'Electronics' };
      const mockProduct = {
        id: 1,
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        category: mockCategory,
      };

      mockProductRepository.findOne.mockResolvedValue(null);
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategory);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);
      const result = await service.createProduct(createProductParams);
      expect(result).toEqual({ msg: 'Product created succesfully!' });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { name: createProductParams.name } });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(createProductParams.category);
      expect(mockProductRepository.create).toHaveBeenCalledWith({
        ...createProductParams,
        category: mockCategory,
      });
      expect(mockProductRepository.save).toHaveBeenCalledWith(mockProduct);
    });
    // Test 2 - Error - Category not found
    it("should throw error when category not found", async () => {
      const createProductParams = {
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        category: 1,
      };
      mockProductRepository.findOne.mockResolvedValue(null);
      mockCategoryService.getCategoryById.mockResolvedValue(null);
      await expect(service.createProduct(createProductParams)).rejects.toThrow(
        new HttpException("Category not found", HttpStatus.NOT_FOUND)
      );
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { name: createProductParams.name } });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(createProductParams.category);
      expect(mockProductRepository.create).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
    // Test 3 - Error - Product with same name exists
    it("should throw error when product with same name exists", async () => {
      const createProductParams = {
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        category: 1,
      };
      const existingProduct = {
        id: 2,
        name: "Laptop",
        description: "Another laptop",
        price: 899,
        category: { id: 1, name: 'Electronics' },
      };
      mockProductRepository.findOne.mockResolvedValue(existingProduct);
      await expect(service.createProduct(createProductParams)).rejects.toThrow(
        new HttpException("This product with the same name already exists", HttpStatus.CONFLICT)
      );
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { name: createProductParams.name } });
      expect(mockCategoryService.getCategoryById).not.toHaveBeenCalled();
      expect(mockProductRepository.create).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
    
  });
  describe("deleteProduct", () => {
    // Test 1 - Normal case - product deleted
    it("should delete the product with given id", async () => {
      const mockProduct = {
        id: 1,
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        orderItems: [],
      }
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      const result = await service.deleteProduct(mockProduct.id);
      expect(result).toEqual({ msg: 'Product deleted succesfully!', statusCode: 200 });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockProductRepository.delete).toHaveBeenCalledWith({ id: mockProduct.id });
    });
    // Test 2 - Error - id is invalid - case 1
    it("should throw error when id is invalid", async () => {
      await expect(service.deleteProduct(0)).rejects.toThrow(
        new HttpException("Invalid product ID", HttpStatus.BAD_REQUEST)
      );
      expect(mockProductRepository.findOne).not.toHaveBeenCalled();
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });
    // Test 3 - Error - id is invalid - case 2
    it("should throw error when id is invalid", async () => {
      await expect(service.deleteProduct(-1)).rejects.toThrow(
        new HttpException("Invalid product ID", HttpStatus.BAD_REQUEST)
      );
      expect(mockProductRepository.findOne).not.toHaveBeenCalled();
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });
    // Test 4 - Error - product with given id does not exist
    it("should throw error when product with given id does not exist", async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      await expect(service.deleteProduct(999)).rejects.toThrow(
        new HttpException("Product with this id doesnt exist!", HttpStatus.NOT_FOUND)
      );
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });
  })
  describe("updateProduct", () => {
    // Test 1 - Normal case - product updated
    it("should update and return the product", async () => {
      const mockProduct = {
        id: 1,
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        orderItems: [],
      }
      const updateParams = {
        name: "Updated Laptop",
        description: "Updated description",
        price: 1099,
        category: 2,
      }
      const mockCategory = { id: 2, name: 'Computers' };
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategory);
      const result = await service.updateProduct(mockProduct.id, updateParams);
      expect(result).toEqual({ msg: 'Product updated succesfully!', statusCode: 200 });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(updateParams.category);
      expect(mockProductRepository.save).toHaveBeenCalledWith({
        ...mockProduct,
        ...updateParams,
        category: mockCategory,
      });
    });
    // Test 2 - Error - id is invalid
    it("should throw error when id is invalid", async () => {
      await expect(service.updateProduct(0, {})).rejects.toThrow(
        new HttpException("Invalid product ID", HttpStatus.BAD_REQUEST)
      );
      expect(mockProductRepository.findOne).not.toHaveBeenCalled();
      expect(mockCategoryService.getCategoryById).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
    // Test 3 - Error - product with given id does not exist
    it("should throw error when product with given id does not exist", async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      await expect(service.updateProduct(999, {})).rejects.toThrow(
        new HttpException("Product with this id doesnt exist!", HttpStatus.NOT_FOUND)
      );
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockCategoryService.getCategoryById).not.toHaveBeenCalled();
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
    // Test 4 - Error - category not found
    it("should throw error when category not found", async () => {
      const mockProduct = {
        id: 1,
        name: "Laptop",
        description: "Fancy laptop",
        price: 999,
        orderItems: [],
      };
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockCategoryService.getCategoryById.mockResolvedValue(null);
      await expect(service.updateProduct(mockProduct.id, { category: 2 })).rejects.toThrow(
        new HttpException("Category not found", HttpStatus.NOT_FOUND)
      );
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(2);
      expect(mockProductRepository.save).not.toHaveBeenCalled();
    });
  });
});