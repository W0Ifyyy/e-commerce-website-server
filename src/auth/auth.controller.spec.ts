import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';
import { CreateUserDto } from '../user/dtos/CreateUserDto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;

  const mockAuthService = {
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    validateUser: jest.fn(),
  };

  const mockUserService = {
    createUser: jest.fn(),
    findOne: jest.fn(),
    updateRefreshToken: jest.fn(),
    getRefreshToken: jest.fn(),
    removeRefreshToken: jest.fn(),
  };

  const mockUser = {
    id: 1,
    name: 'testuser',
    email: 'test@test.com',
    role: 'user',
  };

  const mockTokens = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
  };

  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;

  beforeEach(async () => {
    // Reset mock response for each test
    mockResponse = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      user: mockUser,
      cookies: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    beforeEach(() => {
      mockAuthService.login.mockResolvedValue(mockTokens);
      process.env.NODE_ENV = 'development';
    });

    it('should login user and return success message', async () => {
      const result = await controller.login(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(result).toEqual({ message: 'Logged in' });
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
    });

    it('should set access_token cookie with correct options', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockTokens.access_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 1000 * 60 * 15, // 15 minutes
        },
      );
    });

    it('should set refresh_token cookie with correct options', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockTokens.refresh_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/auth/refresh',
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        },
      );
    });

    it('should set secure flag to true in production', async () => {
      process.env.NODE_ENV = 'production';

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockTokens.access_token,
        expect.objectContaining({ secure: true }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockTokens.refresh_token,
        expect.objectContaining({ secure: true }),
      );
    });

    it('should set secure flag to false in development', async () => {
      process.env.NODE_ENV = 'development';

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expect.objectContaining({ secure: false }),
      );
    });

    it('should call authService.login with user from request', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should set both cookies before returning', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should handle different user objects', async () => {
      const differentUser = { id: 99, name: 'otheruser', email: 'other@test.com' };
      mockRequest.user = differentUser;

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(differentUser);
    });

    it('should propagate auth service errors', async () => {
      const error = new Error('Login failed');
      mockAuthService.login.mockRejectedValue(error);

      await expect(
        controller.login(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow('Login failed');
    });

    it('should set httpOnly flag on both cookies', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should set sameSite to lax on both cookies', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expect.objectContaining({ sameSite: 'lax' }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ sameSite: 'lax' }),
      );
    });

    it('should set path only on refresh_token cookie', async () => {
      await controller.login(mockRequest as Request, mockResponse as Response);

      const accessTokenCall = (mockResponse.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === 'access_token',
      );
      const refreshTokenCall = (mockResponse.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === 'refresh_token',
      );

      expect(accessTokenCall[2]).not.toHaveProperty('path');
      expect(refreshTokenCall[2]).toHaveProperty('path', '/auth/refresh');
    });
  });

  describe('getProfile', () => {
    it('should return user from request', () => {
      const result = controller.getProfile(mockRequest as Request);

      expect(result).toEqual(mockUser);
    });

    it('should return different users', () => {
      const differentUser = { id: 2, name: 'anotheruser' };
      mockRequest.user = differentUser;

      const result = controller.getProfile(mockRequest as Request);

      expect(result).toEqual(differentUser);
    });

    it('should not call any services', () => {
      controller.getProfile(mockRequest as Request);

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockUserService.findOne).not.toHaveBeenCalled();
    });

    it('should handle user with additional properties', () => {
      const userWithExtra = {
        ...mockUser,
        customField: 'value',
        anotherField: 123,
      };
      mockRequest.user = userWithExtra;

      const result = controller.getProfile(mockRequest as Request);

      expect(result).toEqual(userWithExtra);
    });
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      name: 'newuser',
      email: 'new@test.com',
      password: 'password123',
    };

    const mockCreatedUser = {
      msg: 'User created successfully',
      statusCode: 201,
    };

    beforeEach(() => {
      mockUserService.createUser.mockResolvedValue(mockCreatedUser);
    });

    it('should create a new user', async () => {
      const result = await controller.createUser(createUserDto);

      expect(result).toEqual(mockCreatedUser);
      expect(mockUserService.createUser).toHaveBeenCalledWith(createUserDto);
    });

    it('should pass DTO to userService', async () => {
      await controller.createUser(createUserDto);

      expect(mockUserService.createUser).toHaveBeenCalledWith(createUserDto);
      expect(mockUserService.createUser).toHaveBeenCalledTimes(1);
    });

    it('should handle different user data', async () => {
      const differentDto: CreateUserDto = {
        name: 'admin',
        email: 'admin@test.com',
        password: 'admin123',
      };

      await controller.createUser(differentDto);

      expect(mockUserService.createUser).toHaveBeenCalledWith(differentDto);
    });

    it('should propagate validation errors', async () => {
      const error = new Error('Validation failed');
      mockUserService.createUser.mockRejectedValue(error);

      await expect(controller.createUser(createUserDto)).rejects.toThrow(
        'Validation failed',
      );
    });

    it('should propagate duplicate user errors', async () => {
      const error = new Error('User already exists');
      mockUserService.createUser.mockRejectedValue(error);

      await expect(controller.createUser(createUserDto)).rejects.toThrow(
        'User already exists',
      );
    });

    it('should propagate database errors', async () => {
      const error = new Error('Database error');
      mockUserService.createUser.mockRejectedValue(error);

      await expect(controller.createUser(createUserDto)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('refresh', () => {
    const mockRefreshToken = 'valid_refresh_token';
    const newTokens = {
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token',
    };

    beforeEach(() => {
      mockAuthService.refreshToken.mockResolvedValue(newTokens);
    });

    it('should refresh tokens successfully', async () => {
      const result = await controller.refresh(mockRefreshToken);

      expect(result).toEqual(newTokens);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should pass refresh token to service', async () => {
      await controller.refresh(mockRefreshToken);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('should handle different refresh tokens', async () => {
      const differentToken = 'different_refresh_token';

      await controller.refresh(differentToken);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(differentToken);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(controller.refresh('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.refresh('invalid_token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Token expired'),
      );

      await expect(controller.refresh(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should propagate auth service errors', async () => {
      const error = new Error('Refresh failed');
      mockAuthService.refreshToken.mockRejectedValue(error);

      await expect(controller.refresh(mockRefreshToken)).rejects.toThrow(
        'Refresh failed',
      );
    });

    it('should handle empty token string', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(controller.refresh('')).rejects.toThrow(UnauthorizedException);
    });

    it('should handle null token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(controller.refresh(null)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    const mockLogoutResponse = { message: 'Logged out successfully.' };

    beforeEach(() => {
      mockAuthService.logout.mockResolvedValue(mockLogoutResponse);
      mockRequest.user = { sub: 1, username: 'testuser' };
    });

    it('should logout user successfully', async () => {
      const result = await controller.logout(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(result).toEqual(mockLogoutResponse);
      expect(mockAuthService.logout).toHaveBeenCalledWith(1);
    });

    it('should clear access_token cookie', async () => {
      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
    });

    it('should clear refresh_token cookie with /auth/refresh path', async () => {
      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/auth/refresh',
      });
    });

    it('should clear refresh_token cookie with / path', async () => {
      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
    });

    it('should clear all three cookies', async () => {
      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
    });

    it('should call authService.logout with user id from JWT payload', async () => {
      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.logout).toHaveBeenCalledWith(1);
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });

    it('should handle different user ids', async () => {
      mockRequest.user = { sub: 42, username: 'otheruser' };

      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.logout).toHaveBeenCalledWith(42);
    });

    it('should clear cookies before calling logout service', async () => {
      const callOrder: string[] = [];

      (mockResponse.clearCookie as jest.Mock).mockImplementation(() => {
        callOrder.push('clearCookie');
        return mockResponse;
      });

      mockAuthService.logout.mockImplementation(() => {
        callOrder.push('logout');
        return Promise.resolve(mockLogoutResponse);
      });

      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(callOrder.filter((c) => c === 'clearCookie')).toHaveLength(3);
      expect(callOrder[callOrder.length - 1]).toBe('logout');
    });

    it('should propagate auth service errors', async () => {
      const error = new Error('Logout failed');
      mockAuthService.logout.mockRejectedValue(error);

      await expect(
        controller.logout(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow('Logout failed');
    });

    it('should still clear cookies even if service fails', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('Service error'));

      try {
        await controller.logout(mockRequest as Request, mockResponse as Response);
      } catch (error) {
        // Expected to throw
      }

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
    });
  });
});
