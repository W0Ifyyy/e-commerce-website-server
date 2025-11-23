import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateUserDto } from './dtos/UpdateUserDto';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  const mockUserService = {
    getAllUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    deleteUserById: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: 1, name: 'User1', email: 'user1@test.com', orders: [] },
        { id: 2, name: 'User2', email: 'user2@test.com', orders: [] },
      ];
      mockUserService.getAllUsers.mockResolvedValue(mockUsers);

      const result = await controller.getUsers();

      expect(result).toEqual(mockUsers);
      expect(mockUserService.getAllUsers).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users exist', async () => {
      mockUserService.getAllUsers.mockResolvedValue([]);

      const result = await controller.getUsers();

      expect(result).toEqual([]);
      expect(mockUserService.getAllUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserById', () => {
    it('should return a user by id', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        password: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        orders: [],
      };
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const result = await controller.getUserById(1);

      expect(result).toEqual(mockUser);
      expect(mockUserService.getUserById).toHaveBeenCalledWith(1);
      expect(mockUserService.getUserById).toHaveBeenCalledTimes(1);
    });

    it('should pass the correct id to service', async () => {
      const userId = 42;
      mockUserService.getUserById.mockResolvedValue({
        id: userId,
        name: 'Test',
      });

      await controller.getUserById(userId);

      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateUser', () => {
    it('should update a user successfully', async () => {
      const userId = 1;
      const updateDto: UpdateUserDto = {
        name: 'Updated Name',
        email: 'updated@test.com',
      };
      const mockResponse = { msg: 'User updated successfully!' };
      mockUserService.updateUser.mockResolvedValue(mockResponse);

      const result = await controller.updateUser(userId, updateDto);

      expect(result).toEqual(mockResponse);
      expect(mockUserService.updateUser).toHaveBeenCalledWith(userId, updateDto);
      expect(mockUserService.updateUser).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const userId = 2;
      const updateDto: UpdateUserDto = { name: 'New Name Only' };
      mockUserService.updateUser.mockResolvedValue({
        msg: 'User updated successfully!',
      });

      await controller.updateUser(userId, updateDto);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(userId, updateDto);
    });
  });

  describe('deleteUserById', () => {
    it('should delete a user successfully', async () => {
      const userId = 1;
      const mockResponse = { msg: 'User deleted succesfully' };
      mockUserService.deleteUserById.mockResolvedValue(mockResponse);

      const result = await controller.deleteUserById(userId);

      expect(result).toEqual(mockResponse);
      expect(mockUserService.deleteUserById).toHaveBeenCalledWith(userId);
      expect(mockUserService.deleteUserById).toHaveBeenCalledTimes(1);
    });

    it('should pass correct user id to service', async () => {
      const userId = 99;
      mockUserService.deleteUserById.mockResolvedValue({
        msg: 'User deleted succesfully',
      });

      await controller.deleteUserById(userId);

      expect(mockUserService.deleteUserById).toHaveBeenCalledWith(userId);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 1;
      const changePasswordDto = {
        oldPassword: 'oldPass123',
        newPassword: 'newPass456',
      };
      const mockResponse = { msg: 'Password changed successfully!' };
      mockUserService.changePassword.mockResolvedValue(mockResponse);

      const result = await controller.changePassword(userId, changePasswordDto);

      expect(result).toEqual(mockResponse);
      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        userId,
        changePasswordDto.oldPassword,
        changePasswordDto.newPassword,
      );
      expect(mockUserService.changePassword).toHaveBeenCalledTimes(1);
    });

    it('should pass all parameters correctly to service', async () => {
      const userId = 5;
      const oldPassword = 'currentPassword';
      const newPassword = 'brandNewPassword';
      mockUserService.changePassword.mockResolvedValue({
        msg: 'Password changed successfully!',
      });

      await controller.changePassword(userId, {
        oldPassword,
        newPassword,
      });

      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        userId,
        oldPassword,
        newPassword,
      );
    });
  });
});