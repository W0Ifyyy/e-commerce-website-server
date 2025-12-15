import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as hashingTokens from '../../utils/hashingTokens';

// Mock bcrypt
jest.mock('bcrypt');
// Mock hashing utilities
jest.mock('../../utils/hashingTokens');
jest.mock('../../utils/creatingPassword', () => ({
  comparePassword: jest.fn(),
}));

import { comparePassword } from '../../utils/creatingPassword';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUserService = {
    findOne: jest.fn(),
    updateRefreshToken: jest.fn(),
    getRefreshToken: jest.fn(),
    removeRefreshToken: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn(),
  };

  const mockUser = {
    id: 1,
    name: 'testuser',
    email: 'test@test.com',
    password: 'hashedPassword123',
    role: 'user',
  };

  const mockUserWithoutPassword = {
    id: 1,
    name: 'testuser',
    email: 'test@test.com',
    role: 'user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toEqual(mockUserWithoutPassword);
      expect(mockUserService.findOne).toHaveBeenCalledWith('testuser');
      expect(comparePassword).toHaveBeenCalledWith('password123', 'hashedPassword123');
    });

    it('should return null when user does not exist', async () => {
      mockUserService.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
      expect(mockUserService.findOne).toHaveBeenCalledWith('nonexistent');
      expect(comparePassword).not.toHaveBeenCalled();
    });

    it('should return null when password is invalid', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
      expect(comparePassword).toHaveBeenCalledWith('wrongpassword', 'hashedPassword123');
    });

    it('should exclude password from returned user object', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('should handle empty username', async () => {
      mockUserService.findOne.mockResolvedValue(null);

      const result = await service.validateUser('', 'password123');

      expect(result).toBeNull();
      expect(mockUserService.findOne).toHaveBeenCalledWith('');
    });

    it('should handle empty password', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', '');

      expect(result).toBeNull();
      expect(comparePassword).toHaveBeenCalledWith('', 'hashedPassword123');
    });

    it('should propagate UserService errors', async () => {
      const error = new Error('Database error');
      mockUserService.findOne.mockRejectedValue(error);

      await expect(service.validateUser('testuser', 'password123')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('login', () => {
    const mockAccessToken = 'mock_access_token';
    const mockRefreshToken = 'mock_refresh_token';
    const hashedRefreshToken = 'hashed_refresh_token';

    beforeEach(() => {
      mockJwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);
      (hashingTokens.hashToken as jest.Mock).mockResolvedValue(hashedRefreshToken);
      mockUserService.updateRefreshToken.mockResolvedValue(undefined);
    });

    it('should return access and refresh tokens', async () => {
      const result = await service.login(mockUserWithoutPassword);

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
      });
    });

    it('should create JWT with correct payload for access token', async () => {
      await service.login(mockUserWithoutPassword);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { username: 'testuser', sub: 1, role: 'user' },
        { expiresIn: '15m' },
      );
    });

    it('should create JWT with correct payload for refresh token', async () => {
      await service.login(mockUserWithoutPassword);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        { username: 'testuser', sub: 1, role: 'user' },
        { expiresIn: '7d' },
      );
    });

    it('should hash the refresh token before storing', async () => {
      await service.login(mockUserWithoutPassword);

      expect(hashingTokens.hashToken).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should store hashed refresh token in database', async () => {
      await service.login(mockUserWithoutPassword);

      expect(mockUserService.updateRefreshToken).toHaveBeenCalledWith(
        1,
        hashedRefreshToken,
      );
    });

    it('should call all required methods', async () => {
      await service.login(mockUserWithoutPassword);

      // Verify all methods are called
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(hashingTokens.hashToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockUserService.updateRefreshToken).toHaveBeenCalledWith(
        1,
        hashedRefreshToken,
      );
    });

    it('should handle different user IDs', async () => {
      const differentUser = { id: 99, name: 'otheruser' };

      await service.login(differentUser);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { username: 'otheruser', sub: 99, role: undefined },
        { expiresIn: '15m' },
      );
      expect(mockUserService.updateRefreshToken).toHaveBeenCalledWith(
        99,
        hashedRefreshToken,
      );
    });

    it('should propagate hashing errors', async () => {
      const error = new Error('Hashing failed');
      (hashingTokens.hashToken as jest.Mock).mockRejectedValue(error);

      await expect(service.login(mockUserWithoutPassword)).rejects.toThrow(
        'Hashing failed',
      );
    });

    it('should propagate database errors', async () => {
      const error = new Error('Database error');
      mockUserService.updateRefreshToken.mockRejectedValue(error);

      await expect(service.login(mockUserWithoutPassword)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'valid_refresh_token';
    const mockPayload = { sub: 1, username: 'testuser' };
    const mockStoredToken = {
      name: 'testuser',
      refreshToken: 'stored_hashed_token',
    };
    const newAccessToken = 'new_access_token';
    const newRefreshToken = 'new_refresh_token';
    const newHashedToken = 'new_hashed_token';

    beforeEach(() => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserService.getRefreshToken.mockResolvedValue(mockStoredToken);
      (hashingTokens.compareTokens as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce(newAccessToken)
        .mockReturnValueOnce(newRefreshToken);
      (hashingTokens.hashToken as jest.Mock).mockResolvedValue(newHashedToken);
      mockUserService.updateRefreshToken.mockResolvedValue(undefined);
    });

    it('should return new access and refresh tokens', async () => {
      const result = await service.refreshToken(mockRefreshToken);

      expect(result).toEqual({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      });
    });

    it('should verify the refresh token and extract payload', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(mockJwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      await expect(service.refreshToken('')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken('')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should retrieve stored refresh token from database', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(mockUserService.getRefreshToken).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException when stored token not found', async () => {
      mockUserService.getRefreshToken.mockResolvedValue(null);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should compare tokens', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(hashingTokens.compareTokens).toHaveBeenCalledWith(
        mockRefreshToken,
        'stored_hashed_token',
      );
    });

    it('should throw UnauthorizedException when tokens do not match', async () => {
      (hashingTokens.compareTokens as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should create new access token with correct payload and expiration', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { username: 'testuser', sub: 1 },
        { expiresIn: '600s' },
      );
    });

    it('should create new refresh token with correct payload and expiration', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        { username: 'testuser', sub: 1 },
        { expiresIn: '7d' },
      );
    });

    it('should hash new refresh token', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(hashingTokens.hashToken).toHaveBeenCalledWith(newRefreshToken);
    });

    it('should update stored refresh token', async () => {
      await service.refreshToken(mockRefreshToken);

      expect(mockUserService.updateRefreshToken).toHaveBeenCalledWith(
        1,
        newHashedToken,
      );
    });

    it('should throw UnauthorizedException when payload is missing sub', async () => {
      mockJwtService.verify.mockReturnValue({ username: 'test' } as any);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should handle JWT verification throwing error', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should log errors before throwing', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should throw UnauthorizedException for any unexpected errors', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });

  describe('logout', () => {
    it('should remove refresh token from database', async () => {
      mockUserService.removeRefreshToken.mockResolvedValue(undefined);

      await service.logout(1);

      expect(mockUserService.removeRefreshToken).toHaveBeenCalledWith(1);
      expect(mockUserService.removeRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should return success message', async () => {
      mockUserService.removeRefreshToken.mockResolvedValue(undefined);

      const result = await service.logout(1);

      expect(result).toEqual({ message: 'Logged out successfully.' });
    });

    it('should handle different user IDs', async () => {
      mockUserService.removeRefreshToken.mockResolvedValue(undefined);

      await service.logout(42);

      expect(mockUserService.removeRefreshToken).toHaveBeenCalledWith(42);
    });

    it('should propagate database errors', async () => {
      const error = new Error('Database error');
      mockUserService.removeRefreshToken.mockRejectedValue(error);

      await expect(service.logout(1)).rejects.toThrow('Database error');
    });

    it('should handle zero userId', async () => {
      mockUserService.removeRefreshToken.mockResolvedValue(undefined);

      const result = await service.logout(0);

      expect(mockUserService.removeRefreshToken).toHaveBeenCalledWith(0);
      expect(result.message).toBe('Logged out successfully.');
    });
  });
});
