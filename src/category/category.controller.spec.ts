import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CreateCategoryDto } from './dtos/CreateCategoryDto';
import { UpdateCategoryDto } from './dtos/UpdateCategoryDto';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: CategoryService;

  const mockCategoryService = {
    getAllCategories: jest.fn(),
    getAllCategoriesWithDetails: jest.fn(),
    getCategoryById: jest.fn(),
    createCategory: jest.fn(),
    deleteCategory: jest.fn(),
    updateCategory: jest.fn(),
  };

  const mockCategory = {
    id: 1,
    name: 'Electronics',
    description: 'Electronic products',
    imageUrl: 'https://example.com/electronics.jpg',
    products: [],
  };

  const mockCategories = [
    mockCategory,
    {
      id: 2,
      name: 'Clothing',
      description: 'Clothing items',
      imageUrl: 'https://example.com/clothing.jpg',
      products: [],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCategories', () => {
    it('should return all categories', async () => {
      mockCategoryService.getAllCategories.mockResolvedValue(mockCategories);

      const result = await controller.getCategories();

      expect(result).toEqual(mockCategories);
      expect(mockCategoryService.getAllCategories).toHaveBeenCalledTimes(1);
      expect(mockCategoryService.getAllCategories).toHaveBeenCalledWith();
    });

    it('should return empty array when no categories exist', async () => {
      mockCategoryService.getAllCategories.mockResolvedValue([]);

      const result = await controller.getCategories();

      expect(result).toEqual([]);
    });

    it('should propagate NOT_FOUND error from service', async () => {
      const error = new HttpException('No categories found', HttpStatus.NOT_FOUND);
      mockCategoryService.getAllCategories.mockRejectedValue(error);

      await expect(controller.getCategories()).rejects.toThrow(HttpException);
      await expect(controller.getCategories()).rejects.toThrow('No categories found');
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.getAllCategories.mockRejectedValue(error);

      await expect(controller.getCategories()).rejects.toThrow('Database error');
    });
  });

  describe('getCategoriesWithDetails', () => {
    it('should return all categories with products', async () => {
      const categoriesWithProducts = mockCategories.map((cat) => ({
        ...cat,
        products: [{ id: 1, name: 'Product 1' }],
      }));
      mockCategoryService.getAllCategoriesWithDetails.mockResolvedValue(
        categoriesWithProducts,
      );

      const result = await controller.getCategoriesWithDetails();

      expect(result).toEqual(categoriesWithProducts);
      expect(mockCategoryService.getAllCategoriesWithDetails).toHaveBeenCalledWith();
      expect(mockCategoryService.getAllCategoriesWithDetails).toHaveBeenCalledTimes(1);
    });

    it('should call service without id parameter', async () => {
      mockCategoryService.getAllCategoriesWithDetails.mockResolvedValue(mockCategories);

      await controller.getCategoriesWithDetails();

      expect(mockCategoryService.getAllCategoriesWithDetails).toHaveBeenCalledWith();
    });

    it('should propagate NOT_FOUND error from service', async () => {
      const error = new HttpException('No categories found', HttpStatus.NOT_FOUND);
      mockCategoryService.getAllCategoriesWithDetails.mockRejectedValue(error);

      await expect(controller.getCategoriesWithDetails()).rejects.toThrow(
        HttpException,
      );
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.getAllCategoriesWithDetails.mockRejectedValue(error);

      await expect(controller.getCategoriesWithDetails()).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getCategoryWithDetails', () => {
    it('should return a category with products by id', async () => {
      const categoryWithProducts = {
        ...mockCategory,
        products: [{ id: 1, name: 'Product 1' }],
      };
      mockCategoryService.getAllCategoriesWithDetails.mockResolvedValue(
        categoryWithProducts,
      );

      const result = await controller.getCategoryWithDetails(1);

      expect(result).toEqual(categoryWithProducts);
      expect(mockCategoryService.getAllCategoriesWithDetails).toHaveBeenCalledWith(1);
      expect(mockCategoryService.getAllCategoriesWithDetails).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      mockCategoryService.getAllCategoriesWithDetails.mockResolvedValue(mockCategory);

      await controller.getCategoryWithDetails(42);

      expect(mockCategoryService.getAllCategoriesWithDetails).toHaveBeenCalledWith(42);
    });

    it('should propagate NOT_FOUND error when category does not exist', async () => {
      const error = new HttpException(
        'There is no category with this id',
        HttpStatus.NOT_FOUND,
      );
      mockCategoryService.getAllCategoriesWithDetails.mockRejectedValue(error);

      await expect(controller.getCategoryWithDetails(999)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.getCategoryWithDetails(999)).rejects.toThrow(
        'There is no category with this id',
      );
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.getAllCategoriesWithDetails.mockRejectedValue(error);

      await expect(controller.getCategoryWithDetails(1)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getCategoryById', () => {
    it('should return a category by id', async () => {
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategory);

      const result = await controller.getCategoryById(1);

      expect(result).toEqual(mockCategory);
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(1);
      expect(mockCategoryService.getCategoryById).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategory);

      await controller.getCategoryById(99);

      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(99);
    });

    it('should propagate BAD_REQUEST error for invalid id', async () => {
      const error = new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST);
      mockCategoryService.getCategoryById.mockRejectedValue(error);

      await expect(controller.getCategoryById(0)).rejects.toThrow(HttpException);
      await expect(controller.getCategoryById(0)).rejects.toThrow(
        'Invalid category ID',
      );
    });

    it('should propagate NOT_FOUND error when category does not exist', async () => {
      const error = new HttpException(
        'There is no category with this id',
        HttpStatus.NOT_FOUND,
      );
      mockCategoryService.getCategoryById.mockRejectedValue(error);

      await expect(controller.getCategoryById(999)).rejects.toThrow(HttpException);
      await expect(controller.getCategoryById(999)).rejects.toThrow(
        'There is no category with this id',
      );
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.getCategoryById.mockRejectedValue(error);

      await expect(controller.getCategoryById(1)).rejects.toThrow('Database error');
    });
  });

  describe('createCategory', () => {
    const createCategoryDto: CreateCategoryDto = {
      name: 'New Category',
      imageUrl: 'https://example.com/new-category.jpg',
    };

    it('should create a category successfully', async () => {
      const mockResponse = { msg: 'Category created succesfully!' };
      mockCategoryService.createCategory.mockResolvedValue(mockResponse);

      const result = await controller.createCategory(createCategoryDto);

      expect(result).toEqual(mockResponse);
      expect(mockCategoryService.createCategory).toHaveBeenCalledWith(
        createCategoryDto,
      );
      expect(mockCategoryService.createCategory).toHaveBeenCalledTimes(1);
    });

    it('should pass DTO to service correctly', async () => {
      mockCategoryService.createCategory.mockResolvedValue({
        msg: 'Category created succesfully!',
      });

      await controller.createCategory(createCategoryDto);

      expect(mockCategoryService.createCategory).toHaveBeenCalledWith(
        createCategoryDto,
      );
    });

    it('should handle minimal category data', async () => {
      const minimalDto: CreateCategoryDto = {
        name: 'Minimal',
        imageUrl: 'https://example.com/minimal.jpg',
      };
      mockCategoryService.createCategory.mockResolvedValue({
        msg: 'Category created succesfully!',
      });

      const result = await controller.createCategory(minimalDto);

      expect(result.msg).toBe('Category created succesfully!');
      expect(mockCategoryService.createCategory).toHaveBeenCalledWith(minimalDto);
    });

    it('should propagate CONFLICT error when category name already exists', async () => {
      const error = new HttpException(
        'This category with the same name already exists',
        HttpStatus.CONFLICT,
      );
      mockCategoryService.createCategory.mockRejectedValue(error);

      await expect(controller.createCategory(createCategoryDto)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.createCategory(createCategoryDto)).rejects.toThrow(
        'This category with the same name already exists',
      );
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.createCategory.mockRejectedValue(error);

      await expect(controller.createCategory(createCategoryDto)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle special characters in category name', async () => {
      const specialDto: CreateCategoryDto = {
        name: 'Electronics & Gadgets',
        imageUrl: 'https://example.com/special.jpg',
      };
      mockCategoryService.createCategory.mockResolvedValue({
        msg: 'Category created succesfully!',
      });

      await controller.createCategory(specialDto);

      expect(mockCategoryService.createCategory).toHaveBeenCalledWith(specialDto);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category successfully', async () => {
      const mockResponse = { msg: 'Category deleted succesfully!' };
      mockCategoryService.deleteCategory.mockResolvedValue(mockResponse);

      const result = await controller.deleteCategory(1);

      expect(result).toEqual(mockResponse);
      expect(mockCategoryService.deleteCategory).toHaveBeenCalledWith(1);
      expect(mockCategoryService.deleteCategory).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      mockCategoryService.deleteCategory.mockResolvedValue({
        msg: 'Category deleted succesfully!',
      });

      await controller.deleteCategory(42);

      expect(mockCategoryService.deleteCategory).toHaveBeenCalledWith(42);
    });

    it('should propagate BAD_REQUEST error for invalid id', async () => {
      const error = new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST);
      mockCategoryService.deleteCategory.mockRejectedValue(error);

      await expect(controller.deleteCategory(0)).rejects.toThrow(HttpException);
      await expect(controller.deleteCategory(0)).rejects.toThrow(
        'Invalid category ID',
      );
    });

    it('should propagate NOT_FOUND error when category does not exist', async () => {
      const error = new HttpException(
        'Category with this id doesnt exist!',
        HttpStatus.NOT_FOUND,
      );
      mockCategoryService.deleteCategory.mockRejectedValue(error);

      await expect(controller.deleteCategory(999)).rejects.toThrow(HttpException);
      await expect(controller.deleteCategory(999)).rejects.toThrow(
        'Category with this id doesnt exist!',
      );
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.deleteCategory.mockRejectedValue(error);

      await expect(controller.deleteCategory(1)).rejects.toThrow('Database error');
    });
  });

  describe('updateCategory', () => {
    const updateCategoryDto: UpdateCategoryDto = {
      name: 'Updated Category',
      imageUrl: 'https://example.com/updated.jpg',
    };

    it('should update a category successfully', async () => {
      const mockResponse = {
        msg: 'Category updated succesfully!',
        statusCode: 200,
      };
      mockCategoryService.updateCategory.mockResolvedValue(mockResponse);

      const result = await controller.updateCategory(1, updateCategoryDto);

      expect(result).toEqual(mockResponse);
      expect(mockCategoryService.updateCategory).toHaveBeenCalledWith(
        1,
        updateCategoryDto,
      );
      expect(mockCategoryService.updateCategory).toHaveBeenCalledTimes(1);
    });

    it('should pass id and DTO correctly to service', async () => {
      mockCategoryService.updateCategory.mockResolvedValue({
        msg: 'Category updated succesfully!',
        statusCode: 200,
      });

      await controller.updateCategory(5, updateCategoryDto);

      expect(mockCategoryService.updateCategory).toHaveBeenCalledWith(
        5,
        updateCategoryDto,
      );
    });

    it('should handle partial updates - name only', async () => {
      const partialDto: UpdateCategoryDto = { name: 'New Name' };
      mockCategoryService.updateCategory.mockResolvedValue({
        msg: 'Category updated succesfully!',
        statusCode: 200,
      });

      await controller.updateCategory(1, partialDto);

      expect(mockCategoryService.updateCategory).toHaveBeenCalledWith(
        1,
        partialDto,
      );
    });

    it('should handle partial updates - imageUrl only', async () => {
      const partialDto: UpdateCategoryDto = {
        imageUrl: 'https://example.com/new-image.jpg',
      };
      mockCategoryService.updateCategory.mockResolvedValue({
        msg: 'Category updated succesfully!',
        statusCode: 200,
      });

      await controller.updateCategory(1, partialDto);

      expect(mockCategoryService.updateCategory).toHaveBeenCalledWith(
        1,
        partialDto,
      );
    });

    it('should handle empty update DTO', async () => {
      const emptyDto: UpdateCategoryDto = {};
      mockCategoryService.updateCategory.mockResolvedValue({
        msg: 'Category updated succesfully!',
        statusCode: 200,
      });

      await controller.updateCategory(1, emptyDto);

      expect(mockCategoryService.updateCategory).toHaveBeenCalledWith(1, emptyDto);
    });

    it('should propagate BAD_REQUEST error for invalid id', async () => {
      const error = new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST);
      mockCategoryService.updateCategory.mockRejectedValue(error);

      await expect(controller.updateCategory(0, updateCategoryDto)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.updateCategory(0, updateCategoryDto)).rejects.toThrow(
        'Invalid category ID',
      );
    });

    it('should propagate NOT_FOUND error when category does not exist', async () => {
      const error = new HttpException(
        'Category with this id doesnt exist!',
        HttpStatus.NOT_FOUND,
      );
      mockCategoryService.updateCategory.mockRejectedValue(error);

      await expect(
        controller.updateCategory(999, updateCategoryDto),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.updateCategory(999, updateCategoryDto),
      ).rejects.toThrow('Category with this id doesnt exist!');
    });

    it('should propagate database errors from service', async () => {
      const error = new Error('Database error');
      mockCategoryService.updateCategory.mockRejectedValue(error);

      await expect(
        controller.updateCategory(1, updateCategoryDto),
      ).rejects.toThrow('Database error');
    });
  });
});
