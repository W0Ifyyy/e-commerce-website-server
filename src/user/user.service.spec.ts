import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as creatingPassword from 'utils/creatingPassword';
import * as nodemailer from 'nodemailer';
import * as nodeCrypto from 'crypto';

jest.mock('utils/creatingPassword', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('mailtrap', () => ({
  MailtrapTransport: jest.fn((opts: any) => opts),
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

    process.env.MAILTRAP_TOKEN = 'test-token';
    process.env.MAILTRAP_TEST_INBOX_ID = '123';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.MAIL_FROM_ADDRESS = 'hello@example.com';
    process.env.MAIL_FROM_NAME = 'Mailtrap Test';

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
        /An error occured while finding user by username/,
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
        /An error occurred while removing refresh token/,
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

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.changePassword(9, 'old', 'new')).rejects.toThrow(
        new HttpException('User not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw UNAUTHORIZED when old password is incorrect', async () => {
      const mockUser = { id: 2, password: 'hashedPassword' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      (creatingPassword.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(2, 'wrongPassword', 'newPassword'),
      ).rejects.toThrow(
        new HttpException('Old password is incorrect', HttpStatus.UNAUTHORIZED),
      );
    });

    it('should throw NOT_FOUND when update affected=0', async () => {
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
        new HttpException('User with this id does not exist!', HttpStatus.NOT_FOUND),
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
        /An error occurred while changing the password/,
      );
    });
  });

  describe('emailActions', () => {
    it('should return generic response and (VERIFY) update token + send mail when user exists', async () => {
      const user = { id: 1, email: 'test@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);

      const bytes = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
      jest.spyOn(nodeCrypto, 'randomBytes').mockReturnValue(bytes as any);

      const rawToken = bytes.toString('hex');
      const expectedHash = nodeCrypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const sendMail = jest.fn().mockResolvedValue('mail-ok');
      (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

      const result = await service.emailActions(user.email, 'VERIFY');

      expect(result).toEqual({
        message: 'An email has been sent if the address exists.',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          verifyToken: expectedHash,
          verifyTokenExpiry: expect.any(Date),
        }),
      );

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test@test.com'],
          subject: 'Verify your email',
          text: expect.stringContaining(`/verifyEmail?token=${encodeURIComponent(rawToken)}`),
        }),
      );
    });

    it('should return generic response and (RESET) update token + send mail when user exists', async () => {
      const user = { id: 2, email: 'reset@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);

      const bytes = Buffer.from(Array.from({ length: 32 }, (_, i) => 255 - i));
      jest.spyOn(nodeCrypto, 'randomBytes').mockReturnValue(bytes as any);

      const rawToken = bytes.toString('hex');
      const expectedHash = nodeCrypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const sendMail = jest.fn().mockResolvedValue('reset-ok');
      (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

      const result = await service.emailActions(user.email, 'RESET');

      expect(result).toEqual({
        message: 'An email has been sent if the address exists.',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          forgetPasswordToken: expectedHash,
          forgetPasswordTokenExpiry: expect.any(Date),
        }),
      );

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['reset@test.com'],
          subject: 'Reset your password',
          text: expect.stringContaining(`/resetPassword?token=${encodeURIComponent(rawToken)}`),
        }),
      );
    });

    it('should throw BAD_REQUEST for invalid emailType', async () => {
      await expect(service.emailActions('x@y.com', 'NOPE')).rejects.toThrow(
        HttpException,
      );
      await expect(service.emailActions('x@y.com', 'NOPE')).rejects.toMatchObject(
        { status: HttpStatus.BAD_REQUEST },
      );
    });

    it('should return generic response and do nothing when email is empty', async () => {
      const result = await service.emailActions('', 'VERIFY');
      expect(result).toEqual({
        message: 'An email has been sent if the address exists.',
      });

      expect(mockRepository.findOne).not.toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should return generic response when user does not exist (no enumeration)', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const sendMail = jest.fn();
      (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

      const result = await service.emailActions('missing@test.com', 'VERIFY');

      expect(result).toEqual({
        message: 'An email has been sent if the address exists.',
      });
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('should enforce cooldown: second call returns generic and skips DB/mail', async () => {
      const user = { id: 1, email: 'cool@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);

      const bytes = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
      jest.spyOn(nodeCrypto, 'randomBytes').mockReturnValue(bytes as any);

      const sendMail = jest.fn().mockResolvedValue('ok');
      (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

      const first = await service.emailActions('cool@test.com', 'VERIFY');
      const second = await service.emailActions('cool@test.com', 'VERIFY');

      expect(first).toEqual({
        message: 'An email has been sent if the address exists.',
      });
      expect(second).toEqual({
        message: 'An email has been sent if the address exists.',
      });

      // first call does work, second should bail out before hitting DB
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockRepository.update).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('should wrap transport/update failures as INTERNAL_SERVER_ERROR with generic message', async () => {
      const user = { id: 7, email: 'err@test.com' } as any;
      mockRepository.findOne.mockResolvedValue(user);

      jest
        .spyOn(nodeCrypto, 'randomBytes')
        .mockReturnValue(Buffer.alloc(32, 1) as any);

      mockRepository.update.mockRejectedValue(new Error('db fail'));

      await expect(service.emailActions(user.email, 'VERIFY')).rejects.toThrow(
        new HttpException('An error occured while sending email', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });

  describe('verifyEmail', () => {
    it('should throw BAD_REQUEST when token is missing', async () => {
      await expect(service.verifyEmail('')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should throw UNAUTHORIZED when token is invalid', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail('token123')).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      await expect(service.verifyEmail('token123')).rejects.toThrow('Invalid token');
    });

    it('should throw UNAUTHORIZED when token is expired', async () => {
      const token = 't';
      const tokenHash = nodeCrypto.createHash('sha256').update(token).digest('hex');

      mockRepository.findOne.mockResolvedValue({
        id: 1,
        verifyToken: tokenHash,
        verifyTokenExpiry: new Date(Date.now() - 1000),
      });

      await expect(service.verifyEmail(token)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      await expect(service.verifyEmail(token)).rejects.toThrow('Token expired');
    });

    it('should verify email and clear verify token fields', async () => {
      const token = 'ok-token';
      const tokenHash = nodeCrypto.createHash('sha256').update(token).digest('hex');

      mockRepository.findOne.mockResolvedValue({
        id: 5,
        verifyToken: tokenHash,
        verifyTokenExpiry: new Date(Date.now() + 60_000),
      });

      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.verifyEmail(token);

      expect(result).toEqual({ message: 'Email verified' });
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { verifyToken: tokenHash },
      });
      expect(mockRepository.update).toHaveBeenCalledWith(5, {
        isEmailVerified: true,
        verifyToken: null,
        verifyTokenExpiry: null,
      });
    });
  });

  describe('confirmResetPassword', () => {
    it('should throw BAD_REQUEST when token is missing', async () => {
      await expect(service.confirmResetPassword('', 'newpass')).rejects.toMatchObject(
        { status: HttpStatus.BAD_REQUEST },
      );
    });

    it('should throw BAD_REQUEST when newPassword is missing', async () => {
      await expect(service.confirmResetPassword('t', '')).rejects.toMatchObject(
        { status: HttpStatus.BAD_REQUEST },
      );
    });

    it('should throw UNAUTHORIZED when token is invalid', async () => {
      const token = 'bad';
      const tokenHash = nodeCrypto.createHash('sha256').update(token).digest('hex');

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.confirmResetPassword(token, 'new123')).rejects.toMatchObject(
        { status: HttpStatus.UNAUTHORIZED },
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { forgetPasswordToken: tokenHash },
      });
    });

    it('should throw UNAUTHORIZED when token is expired', async () => {
      const token = 'expired';
      const tokenHash = nodeCrypto.createHash('sha256').update(token).digest('hex');

      mockRepository.findOne.mockResolvedValue({
        id: 9,
        forgetPasswordToken: tokenHash,
        forgetPasswordTokenExpiry: new Date(Date.now() - 1000),
      });

      await expect(service.confirmResetPassword(token, 'new123')).rejects.toMatchObject(
        { status: HttpStatus.UNAUTHORIZED },
      );
      await expect(service.confirmResetPassword(token, 'new123')).rejects.toThrow('Token expired');
    });

    it('should reset password, clear reset token fields, and return message', async () => {
      const token = 'reset-ok';
      const tokenHash = nodeCrypto.createHash('sha256').update(token).digest('hex');

      mockRepository.findOne.mockResolvedValue({
        id: 11,
        forgetPasswordToken: tokenHash,
        forgetPasswordTokenExpiry: new Date(Date.now() + 60_000),
      });

      (creatingPassword.hashPassword as jest.Mock).mockResolvedValue('hashedNew');
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.confirmResetPassword(token, ' newPass123 ');

      expect(result).toEqual({ message: 'Password has been reset' });
      expect(creatingPassword.hashPassword).toHaveBeenCalledWith('newPass123');
      expect(mockRepository.update).toHaveBeenCalledWith(11, {
        password: 'hashedNew',
        forgetPasswordToken: null,
        forgetPasswordTokenExpiry: null,
      });
    });
  });
});