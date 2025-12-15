import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as creatingPassword from 'utils/creatingPassword';
import * as hashingTokens from 'utils/hashingTokens';
import nodemailer from 'nodemailer';

jest.mock('utils/creatingPassword', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock('utils/hashingTokens', () => ({
  hashToken: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;
  let mockRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
    jest.resetAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return all users with orders', async () => {
      const mockUsers = [{ id: 1, name: 'Test', orders: [] }];
      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.getAllUsers();

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['orders'],
      });
    });
  });

  describe('getUserById', () => {
    it('should return user and nulls password & stringifies createdAt', async () => {
      const mockUser = {
        id: 1,
        name: 'Test',
        password: 'hashed',
        createdAt: new Date(),
        orders: [],
      };
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result: any = await service.getUserById(1);

      expect(result.password).toBeNull();
      expect(typeof result.createdAt).toBe('string');
      expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
      expect(result.id).toBe(1);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['orders', 'orders.items.product'],
      });
    });

    it('should throw BAD_REQUEST for invalid id', async () => {
      await expect(service.getUserById(0)).rejects.toThrow(HttpException);
      await expect(service.getUserById(-1)).rejects.toThrow(HttpException);
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.getUserById(999)).rejects.toThrow(
        new HttpException('User with ID 999 not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const mockParams = {
        email: 'test@test.com',
        password: 'password123',
        name: 'Test',
      };
      const hashedPassword = 'hashedPassword';
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue({
        id: 1,
        ...mockParams,
        password: hashedPassword,
      });
      (creatingPassword.hashPassword as jest.Mock).mockResolvedValue(
        hashedPassword,
      );

      const result = await service.createUser(mockParams);

      expect(result.msg).toBe('User created succesfully!');
      expect(result.user.password).toBeNull();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw CONFLICT when user already exists', async () => {
      const mockParams = {
        email: 'test@test.com',
        password: 'password123',
        name: 'Test',
      };
      mockRepository.findOne.mockResolvedValue({
        id: 1,
        email: mockParams.email,
      });

      await expect(service.createUser(mockParams)).rejects.toThrow(
        new HttpException(
          'User with that email already exists!',
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should wrap repository save error as INTERNAL_SERVER_ERROR', async () => {
      const mockParams = {
        email: 'new@test.com',
        password: 'password123',
        name: 'Test',
      };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(new Error('db fail'));
      (creatingPassword.hashPassword as jest.Mock).mockResolvedValue('hp');

      await expect(service.createUser(mockParams)).rejects.toThrow(
        /An error occurred while creating the user./,
      );
    });

    it('should propagate hashPassword failure as INTERNAL_SERVER_ERROR', async () => {
      const mockParams = {
        email: 'fresh@test.com',
        password: 'password123',
        name: 'Fresh',
      };
      mockRepository.findOne.mockResolvedValue(null);
      (creatingPassword.hashPassword as jest.Mock).mockRejectedValue(
        new Error('hash fail'),
      );

      await expect(service.createUser(mockParams)).rejects.toThrow(
        /An error occurred while creating the user./,
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateUser(1, { name: 'Updated' });

      expect(result.msg).toBe('User updated successfully!');
      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        name: 'Updated',
      });
    });

    it('should throw BAD_REQUEST for invalid id', async () => {
      await expect(service.updateUser(0, { name: 'Test' })).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 });

      await expect(service.updateUser(999, { name: 'Test' })).rejects.toThrow(
        new HttpException(
          'User with this id does not exist!',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('deleteUserById', () => {
    it('should delete a user', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteUserById(1);

      expect(result.msg).toBe('User deleted succesfully');
      expect(mockRepository.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('should throw BAD_REQUEST for invalid id', async () => {
      await expect(service.deleteUserById(0)).rejects.toThrow(HttpException);
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteUserById(999)).rejects.toThrow(HttpException);
    });

    it('should wrap repository errors as INTERNAL_SERVER_ERROR', async () => {
      mockRepository.delete.mockRejectedValue(new Error('db down'));
      await expect(service.deleteUserById(1)).rejects.toThrow(
        /An error occured while deleting the user/,
      );
    });
  });

  describe('findOne', () => {
    it('should find user by username', async () => {
      const mockUser = { id: 1, name: 'testuser' };
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('testuser');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'testuser' },
      });
    });

    it('should wrap repository error as INTERNAL_SERVER_ERROR', async () => {
      mockRepository.findOne.mockRejectedValue(new Error('db fail'));
      await expect(service.findOne('broken')).rejects.toThrow(
        /An error occured while finding user by username, error: db fail/,
      );
    });
  });

  describe('refresh token helpers', () => {
    it('should getRefreshToken returns null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.getRefreshToken(999)).resolves.toBeNull();
    });

    it('should getRefreshToken returns name and token', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 1,
        name: 'User',
        refreshToken: 'rt',
      });
      await expect(service.getRefreshToken(1)).resolves.toEqual({
        name: 'User',
        refreshToken: 'rt',
      });
    });

    it('should updateRefreshToken delegates to repository.update', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      await service.updateRefreshToken(1, 'newToken');
      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        refreshToken: 'newToken',
      });
    });

    it('should throw NOT_FOUND when removeRefreshToken user missing', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.removeRefreshToken(2)).rejects.toThrow(
        /User with id of: 2 does not exist!/,
      );
    });

    it('should removeRefreshToken sets refreshToken null', async () => {
      const user = { id: 3, refreshToken: 'abc' };
      mockRepository.findOne.mockResolvedValue(user);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      await service.removeRefreshToken(3);
      expect(mockRepository.update).toHaveBeenCalledWith(user, {
        refreshToken: null,
      });
    });

    it('should wrap update error as INTERNAL_SERVER_ERROR when removeRefreshToken fails', async () => {
      const user = { id: 4, refreshToken: 'def' };
      mockRepository.findOne.mockResolvedValue(user);
      mockRepository.update.mockRejectedValue(new Error('update fail'));
      await expect(service.removeRefreshToken(4)).rejects.toThrow(
        /An error occured while creating the user. Error: update fail/,
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = { id: 1, password: 'oldHashedPassword' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      (creatingPassword.comparePassword as jest.Mock).mockResolvedValue(true);
      (creatingPassword.hashPassword as jest.Mock).mockResolvedValue(
        'newHashed',
      );

      const result = await service.changePassword(
        1,
        'oldPassword',
        'newPassword',
      );

      expect(result.msg).toBe('Password changed successfully!');
    });

    it('calls comparePassword, hashPassword and repository.update with correct args', async () => {
      const mockUser = { id: 10, password: 'storedHash' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      (creatingPassword.comparePassword as jest.Mock).mockResolvedValue(true);
      (creatingPassword.hashPassword as jest.Mock).mockResolvedValue(
        'hashedNew',
      );

      await service.changePassword(10, 'oldPlain', 'newPlain');

      expect(creatingPassword.comparePassword).toHaveBeenCalledWith(
        'oldPlain',
        'storedHash',
      );
      expect(creatingPassword.hashPassword).toHaveBeenCalledWith('newPlain');
      expect(mockRepository.update).toHaveBeenCalledWith(10, {
        password: 'hashedNew',
      });
    });

    it('should wrap missing user error as INTERNAL_SERVER_ERROR', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.changePassword(9, 'old', 'new')).rejects.toThrow(
        /An error occured while changing the password: Cannot read properties of null/,
      );
    });

    it('should wrap UNAUTHORIZED error as INTERNAL_SERVER_ERROR message', async () => {
      const mockUser = { id: 2, password: 'hashedPassword' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      (creatingPassword.comparePassword as jest.Mock).mockResolvedValue(false);

      try {
        await service.changePassword(2, 'wrongPassword', 'newPassword');
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(e.message).toMatch(
          /An error occured while changing the password: Old password is incorrect/,
        );
      }
    });

    it('should wrap NOT_FOUND (affected=0) error as INTERNAL_SERVER_ERROR', async () => {
      const mockUser = { id: 3, password: 'hashedPassword' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      (creatingPassword.comparePassword as jest.Mock).mockResolvedValue(true);
      (creatingPassword.hashPassword as jest.Mock).mockResolvedValue(
        'newHashed',
      );
      mockRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.changePassword(3, 'oldPass', 'newPass'),
      ).rejects.toThrow(
        /An error occured while changing the password: User with this id does not exist!/,
      );
    });

    it('should propagate hashPassword failure wrapped as INTERNAL_SERVER_ERROR', async () => {
      const mockUser = { id: 5, password: 'oldHash' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      (creatingPassword.comparePassword as jest.Mock).mockResolvedValue(true);
      (creatingPassword.hashPassword as jest.Mock).mockRejectedValue(
        new Error('hash crash'),
      );

      await expect(
        service.changePassword(5, 'old', 'new'),
      ).rejects.toThrow(
        /An error occured while changing the password: hash crash/,
      );
    });
  });

  describe('emailActions', () => {
    it('should send verify email and update verify token', async () => {
      const user = { id: 1, email: 'test@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);
      (hashingTokens.hashToken as jest.Mock).mockResolvedValue('hashedToken');

      const sendMail = jest.fn().mockResolvedValue('mail-ok');
      (nodemailer as any).createTransport.mockReturnValue({ sendMail });

      const result = await service.emailActions(user.email, 'VERIFY');

      expect(hashingTokens.hashToken).toHaveBeenCalledWith(user.id.toString());
      expect(mockRepository.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          verifyToken: 'hashedToken',
          verifyTokenExpiry: expect.any(Date),
        }),
      );
      expect(sendMail).toHaveBeenCalled();
      expect(result).toBe('mail-ok');
    });

    it('should send reset email and update reset token', async () => {
      const user = { id: 2, email: 'reset@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);
      (hashingTokens.hashToken as jest.Mock).mockResolvedValue('resetHashed');

      const sendMail = jest.fn().mockResolvedValue('reset-ok');
      (nodemailer as any).createTransport.mockReturnValue({ sendMail });

      const result = await service.emailActions(user.email, 'RESET');

      expect(hashingTokens.hashToken).toHaveBeenCalledWith(user.id.toString());
      expect(mockRepository.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          forgetPasswordToken: 'resetHashed',
          forgetPasswordTokenExpiry: expect.any(Date),
        }),
      );
      expect(sendMail).toHaveBeenCalled();
      expect(result).toBe('reset-ok');
    });

    it('should wrap errors from hashToken/sendMail as INTERNAL_SERVER_ERROR', async () => {
      const user = { id: 3, email: 'err@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);
      (hashingTokens.hashToken as jest.Mock).mockRejectedValue(
        new Error('hash fail'),
      );

      await expect(service.emailActions(user.email, 'VERIFY')).rejects.toThrow(
        /An error occured while verifying email: hash fail/,
      );
    });
  });
});