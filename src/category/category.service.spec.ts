import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from '../typeorm/entities/Category';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('CategoryService', () => {
  let service: CategoryService;
  let repository: Repository<Category>;

  const mockCategoryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
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
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    repository = module.get<Repository<Category>>(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllCategories', () => {
    it('should return all categories', async () => {
      mockCategoryRepository.find.mockResolvedValue(mockCategories);

      const result = await service.getAllCategories();

      expect(result).toEqual(mockCategories);
      expect(mockCategoryRepository.find).toHaveBeenCalledTimes(1);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith();
    });

    it('should throw NOT_FOUND when no categories exist', async () => {
      mockCategoryRepository.find.mockResolvedValue([]);

      await expect(service.getAllCategories()).rejects.toThrow(
        new HttpException('No categories found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw NOT_FOUND when categories is null', async () => {
      mockCategoryRepository.find.mockResolvedValue(null);

      await expect(service.getAllCategories()).rejects.toThrow(
        new HttpException('No categories found', HttpStatus.NOT_FOUND),
      );
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockCategoryRepository.find.mockRejectedValue(dbError);

      await expect(service.getAllCategories()).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('getAllCategoriesWithDetails', () => {
    it('should return all categories with products when no id provided', async () => {
      mockCategoryRepository.find.mockResolvedValue(mockCategories);

      const result = await service.getAllCategoriesWithDetails();

      expect(result).toEqual(mockCategories);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({
        relations: ['products'],
      });
      expect(mockCategoryRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should return single category with products when id provided', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.getAllCategoriesWithDetails(1);

      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['products'],
      });
      expect(mockCategoryRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NOT_FOUND when category with id does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.getAllCategoriesWithDetails(999)).rejects.toThrow(
        new HttpException(
          'There is no category with this id',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw NOT_FOUND when no categories exist (no id)', async () => {
      mockCategoryRepository.find.mockResolvedValue([]);

      await expect(service.getAllCategoriesWithDetails()).rejects.toThrow(
        new HttpException('No categories found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw NOT_FOUND when categories is null (no id)', async () => {
      mockCategoryRepository.find.mockResolvedValue(null);

      await expect(service.getAllCategoriesWithDetails()).rejects.toThrow(
        new HttpException('No categories found', HttpStatus.NOT_FOUND),
      );
    });

    it('should handle id = 0', async () => {
      await expect(service.getAllCategoriesWithDetails(0)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.find).not.toHaveBeenCalled();
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should propagate database errors when finding by id', async () => {
      const dbError = new Error('Database error');
      mockCategoryRepository.findOne.mockRejectedValue(dbError);

      await expect(service.getAllCategoriesWithDetails(1)).rejects.toThrow(
        'Database error',
      );
    });

    it('should propagate database errors when finding all', async () => {
      const dbError = new Error('Database error');
      mockCategoryRepository.find.mockRejectedValue(dbError);

      await expect(service.getAllCategoriesWithDetails()).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getCategoryById', () => {
    it('should return a category by id', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.getCategoryById(1);

      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['products'],
      });
      expect(mockCategoryRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw BAD_REQUEST for invalid id (zero)', async () => {
      await expect(service.getCategoryById(0)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid id (negative)', async () => {
      await expect(service.getCategoryById(-1)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for null id', async () => {
      await expect(service.getCategoryById(null as any)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for undefined id', async () => {
      await expect(service.getCategoryById(undefined as any)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.getCategoryById(999)).rejects.toThrow(
        new HttpException(
          'There is no category with this id',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should include products relation', async () => {
      const categoryWithProducts = {
        ...mockCategory,
        products: [{ id: 1, name: 'Product 1' }],
      };
      mockCategoryRepository.findOne.mockResolvedValue(categoryWithProducts);

      const result = await service.getCategoryById(1);

      expect(result.products).toBeDefined();
      expect(result.products).toHaveLength(1);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database error');
      mockCategoryRepository.findOne.mockRejectedValue(dbError);

      await expect(service.getCategoryById(1)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('createCategory', () => {
    const createCategoryParams = {
      name: 'New Category',
      description: 'New category description',
      imageUrl: 'https://example.com/new-category.jpg',
    };

    it('should create a category successfully', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null); // No existing category
      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      const result = await service.createCategory(createCategoryParams);

      expect(result).toEqual({ msg: 'Category created succesfully!' });
      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { name: createCategoryParams.name },
      });
      expect(mockCategoryRepository.create).toHaveBeenCalledWith(
        createCategoryParams,
      );
      expect(mockCategoryRepository.save).toHaveBeenCalledWith(mockCategory);
    });

    it('should check if category with same name exists', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      await service.createCategory(createCategoryParams);

      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { name: createCategoryParams.name },
      });
    });

    it('should throw CONFLICT when category with same name exists', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);

      await expect(
        service.createCategory(createCategoryParams),
      ).rejects.toThrow(
        new HttpException(
          'This category with the same name already exists',
          HttpStatus.CONFLICT,
        ),
      );
      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
      expect(mockCategoryRepository.save).not.toHaveBeenCalled();
    });

    it('should handle category creation with minimal data', async () => {
      const minimalParams = {
        name: 'Minimal',
        imageUrl: 'https://example.com/minimal.jpg',
      };
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue({ id: 3, ...minimalParams });
      mockCategoryRepository.save.mockResolvedValue({ id: 3, ...minimalParams });

      const result = await service.createCategory(minimalParams);

      expect(result.msg).toBe('Category created succesfully!');
      expect(mockCategoryRepository.create).toHaveBeenCalledWith(minimalParams);
    });

    it('should propagate database errors when checking existence', async () => {
      const dbError = new Error('Database error');
      mockCategoryRepository.findOne.mockRejectedValue(dbError);

      await expect(
        service.createCategory(createCategoryParams),
      ).rejects.toThrow('Database error');
    });

    it('should propagate database errors when saving', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue(mockCategory);
      const dbError = new Error('Save failed');
      mockCategoryRepository.save.mockRejectedValue(dbError);

      await expect(
        service.createCategory(createCategoryParams),
      ).rejects.toThrow('Save failed');
    });

    it('should be case-sensitive when checking for duplicates', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      await service.createCategory({
        name: 'electronics',
        imageUrl: 'https://example.com/electronics.jpg',
      });

      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'electronics' },
      });
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category successfully', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCategory(1);

      expect(result).toEqual({ msg: 'Category deleted succesfully!' });
      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockCategoryRepository.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw BAD_REQUEST for invalid id (zero)', async () => {
      await expect(service.deleteCategory(0)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid id (negative)', async () => {
      await expect(service.deleteCategory(-5)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for null id', async () => {
      await expect(service.deleteCategory(null as any)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BAD_REQUEST for undefined id', async () => {
      await expect(service.deleteCategory(undefined as any)).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteCategory(999)).rejects.toThrow(
        new HttpException(
          'Category with this id doesnt exist!',
          HttpStatus.NOT_FOUND,
        ),
      );
      expect(mockCategoryRepository.delete).not.toHaveBeenCalled();
    });

    it('should verify category exists before deleting', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteCategory(1);

      // Verify both were called
      expect(mockCategoryRepository.findOne).toHaveBeenCalled();
      expect(mockCategoryRepository.delete).toHaveBeenCalled();
      
      // Verify findOne was called first by checking call order
      const findOneOrder = mockCategoryRepository.findOne.mock.invocationCallOrder[0];
      const deleteOrder = mockCategoryRepository.delete.mock.invocationCallOrder[0];
      expect(findOneOrder).toBeLessThan(deleteOrder);
    });

    it('should propagate database errors when finding category', async () => {
      const dbError = new Error('Database error');
      mockCategoryRepository.findOne.mockRejectedValue(dbError);

      await expect(service.deleteCategory(1)).rejects.toThrow('Database error');
    });

    it('should propagate database errors when deleting', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      const dbError = new Error('Delete failed');
      mockCategoryRepository.delete.mockRejectedValue(dbError);

      await expect(service.deleteCategory(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('updateCategory', () => {
    const updateCategoryParams = {
      name: 'Updated Category',
      description: 'Updated description',
      imageUrl: 'https://example.com/updated.jpg',
    };

    it('should update a category successfully', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateCategory(1, updateCategoryParams);

      expect(result).toEqual({
        msg: 'Category updated succesfully!',
        statusCode: 200,
      });
      expect(mockCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockCategoryRepository.update).toHaveBeenCalledWith(
        { id: 1 },
        updateCategoryParams,
      );
    });

    it('should throw BAD_REQUEST for invalid id (zero)', async () => {
      await expect(
        service.updateCategory(0, updateCategoryParams),
      ).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid id (negative)', async () => {
      await expect(
        service.updateCategory(-1, updateCategoryParams),
      ).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BAD_REQUEST for null id', async () => {
      await expect(
        service.updateCategory(null as any, updateCategoryParams),
      ).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BAD_REQUEST for undefined id', async () => {
      await expect(
        service.updateCategory(undefined as any, updateCategoryParams),
      ).rejects.toThrow(
        new HttpException('Invalid category ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateCategory(999, updateCategoryParams),
      ).rejects.toThrow(
        new HttpException(
          'Category with this id doesnt exist!',
          HttpStatus.NOT_FOUND,
        ),
      );
      expect(mockCategoryRepository.update).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      const partialParams = { name: 'Only Name Updated' };
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateCategory(1, partialParams);

      expect(result.msg).toBe('Category updated succesfully!');
      expect(mockCategoryRepository.update).toHaveBeenCalledWith(
        { id: 1 },
        partialParams,
      );
    });

    it('should handle empty update params', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateCategory(1, {});

      expect(result.msg).toBe('Category updated succesfully!');
      expect(mockCategoryRepository.update).toHaveBeenCalledWith({ id: 1 }, {});
    });

    it('should verify category exists before updating', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateCategory(1, updateCategoryParams);

      // Verify both were called
      expect(mockCategoryRepository.findOne).toHaveBeenCalled();
      expect(mockCategoryRepository.update).toHaveBeenCalled();
      
      // Verify findOne was called first by checking call order
      const findOneOrder = mockCategoryRepository.findOne.mock.invocationCallOrder[0];
      const updateOrder = mockCategoryRepository.update.mock.invocationCallOrder[0];
      expect(findOneOrder).toBeLessThan(updateOrder);
    });

    it('should propagate database errors when finding category', async () => {
      const dbError = new Error('Database error');
      mockCategoryRepository.findOne.mockRejectedValue(dbError);

      await expect(
        service.updateCategory(1, updateCategoryParams),
      ).rejects.toThrow('Database error');
    });

    it('should propagate database errors when updating', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      const dbError = new Error('Update failed');
      mockCategoryRepository.update.mockRejectedValue(dbError);

      await expect(
        service.updateCategory(1, updateCategoryParams),
      ).rejects.toThrow('Update failed');
    });
  });
});
