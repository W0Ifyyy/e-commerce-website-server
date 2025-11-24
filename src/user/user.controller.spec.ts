import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateUserDto } from './dtos/UpdateUserDto';
import { HttpException, HttpStatus } from '@nestjs/common';

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

    it('should propagate service errors', async () => {
      const error = new HttpException(
        'Database error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.getAllUsers.mockRejectedValue(error);

      await expect(controller.getUsers()).rejects.toThrow(HttpException);
      await expect(controller.getUsers()).rejects.toThrow('Database error');
    });

    it('should handle unexpected service failures', async () => {
      mockUserService.getAllUsers.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(controller.getUsers()).rejects.toThrow('Unexpected error');
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

    it('should propagate NOT_FOUND error when user does not exist', async () => {
      const error = new HttpException(
        'User with ID 999 not found',
        HttpStatus.NOT_FOUND,
      );
      mockUserService.getUserById.mockRejectedValue(error);

      await expect(controller.getUserById(999)).rejects.toThrow(HttpException);
      await expect(controller.getUserById(999)).rejects.toThrow(
        'User with ID 999 not found',
      );
      expect(mockUserService.getUserById).toHaveBeenCalledWith(999);
    });

    it('should propagate BAD_REQUEST error for invalid id', async () => {
      const error = new HttpException(
        'Invalid user ID',
        HttpStatus.BAD_REQUEST,
      );
      mockUserService.getUserById.mockRejectedValue(error);

      await expect(controller.getUserById(0)).rejects.toThrow(HttpException);
      await expect(controller.getUserById(0)).rejects.toThrow(
        'Invalid user ID',
      );
    });

    it('should handle service throwing generic errors', async () => {
      mockUserService.getUserById.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getUserById(1)).rejects.toThrow(
        'Database connection failed',
      );
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
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        userId,
        updateDto,
      );
      expect(mockUserService.updateUser).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const userId = 2;
      const updateDto: UpdateUserDto = { name: 'New Name Only' };
      mockUserService.updateUser.mockResolvedValue({
        msg: 'User updated successfully!',
      });

      await controller.updateUser(userId, updateDto);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        userId,
        updateDto,
      );
    });

    it('should handle email-only updates', async () => {
      const userId = 3;
      const updateDto: UpdateUserDto = { email: 'newemail@test.com' };
      mockUserService.updateUser.mockResolvedValue({
        msg: 'User updated successfully!',
      });

      await controller.updateUser(userId, updateDto);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        userId,
        updateDto,
      );
    });

    it('should propagate NOT_FOUND error when user does not exist', async () => {
      const error = new HttpException(
        'User with this id does not exist!',
        HttpStatus.NOT_FOUND,
      );
      mockUserService.updateUser.mockRejectedValue(error);

      await expect(
        controller.updateUser(999, { name: 'Test' }),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.updateUser(999, { name: 'Test' }),
      ).rejects.toThrow('User with this id does not exist!');
    });

    it('should propagate INTERNAL_SERVER_ERROR on database failure', async () => {
      const error = new HttpException(
        'An error occured while updating the user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.updateUser.mockRejectedValue(error);

      await expect(
        controller.updateUser(1, { name: 'Test' }),
      ).rejects.toThrow(HttpException);
    });

    it('should handle empty update DTO', async () => {
      const userId = 1;
      const updateDto: UpdateUserDto = {};
      mockUserService.updateUser.mockResolvedValue({
        msg: 'User updated successfully!',
      });

      await controller.updateUser(userId, updateDto);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        userId,
        updateDto,
      );
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

    it('should propagate NOT_FOUND error when user does not exist', async () => {
      const error = new HttpException(
        "The user you're trying to delete does not exist!",
        HttpStatus.NOT_FOUND,
      );
      mockUserService.deleteUserById.mockRejectedValue(error);

      await expect(controller.deleteUserById(999)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.deleteUserById(999)).rejects.toThrow(
        "The user you're trying to delete does not exist!",
      );
    });

    it('should propagate INTERNAL_SERVER_ERROR on database failure', async () => {
      const error = new HttpException(
        'An error occured while deleting the user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.deleteUserById.mockRejectedValue(error);

      await expect(controller.deleteUserById(1)).rejects.toThrow(HttpException);
      await expect(controller.deleteUserById(1)).rejects.toThrow(
        'An error occured while deleting the user',
      );
    });

    it('should handle deletion of user with existing orders', async () => {
      const error = new HttpException(
        'Cannot delete user with existing orders',
        HttpStatus.CONFLICT,
      );
      mockUserService.deleteUserById.mockRejectedValue(error);

      await expect(controller.deleteUserById(1)).rejects.toThrow(HttpException);
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

      const result = await controller.changePassword(
        userId,
        changePasswordDto,
      );

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

    it('should propagate error for incorrect old password', async () => {
      const userId = 1;
      const changePasswordDto = {
        oldPassword: 'wrongPassword',
        newPassword: 'newPass123',
      };
      const error = new HttpException(
        'An error occured while changing the password: Old password is incorrect',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.changePassword(userId, changePasswordDto),
      ).rejects.toThrow('Old password is incorrect');
    });

    it('should propagate error when user does not exist', async () => {
      const error = new HttpException(
        'An error occured while changing the password: User with this id does not exist!',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword(999, {
          oldPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.changePassword(999, {
          oldPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow('User with this id does not exist!');
    });

    it('should propagate error when new password hashing fails', async () => {
      const error = new HttpException(
        'An error occured while changing the password: Failed to hash new password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword(1, {
          oldPassword: 'oldPass',
          newPassword: 'newPass',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('should handle same old and new password scenario', async () => {
      const userId = 1;
      const password = 'samePassword123';
      const error = new HttpException(
        'New password must be different from old password',
        HttpStatus.BAD_REQUEST,
      );
      mockUserService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword(userId, {
          oldPassword: password,
          newPassword: password,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('should handle database update failure', async () => {
      const error = new HttpException(
        'Failed to update password in database',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockUserService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword(1, {
          oldPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow('Failed to update password in database');
    });
  });
});