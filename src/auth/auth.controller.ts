import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.auth.guard';
import { Public } from 'utils/publicDecorator';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dtos/CreateUserDto';
import { Response } from 'express';
import { Test, TestingModule } from '@nestjs/testing';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    const { access_token, refresh_token } = await this.authService.login(
      req.user,
    );

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 15,
    });
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    return { message: 'Logged in' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
  @Public()
  @Post('register')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body('refresh_token') token: string) {
    return this.authService.refreshToken(token);
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    res.clearCookie('refresh_token', { path: '/' });

    const userId =
      req?.user?.userId ?? req?.user?.sub ?? req?.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return this.authService.logout(userId);
  }
}

describe('AuthController (additional logout coverage)', () => {
  let controller: AuthController;

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

  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockResponse = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logout userId extraction precedence', () => {
    it('should prefer req.user.userId over sub/id', async () => {
      const req = { user: { userId: 123, sub: 999, id: 555 } } as unknown as Request;
      const mockLogoutResponse = { message: 'Logged out successfully.' };
      mockAuthService.logout.mockResolvedValue(mockLogoutResponse);

      const result = await controller.logout(req, mockResponse as Response);

      expect(result).toEqual(mockLogoutResponse);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/auth/refresh',
      });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);

      expect(mockAuthService.logout).toHaveBeenCalledWith(123);
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });

    it('should use req.user.sub when userId is missing', async () => {
      const req = { user: { sub: 42, username: 'testuser' } } as unknown as Request;
      const mockLogoutResponse = { message: 'Logged out successfully.' };
      mockAuthService.logout.mockResolvedValue(mockLogoutResponse);

      const result = await controller.logout(req, mockResponse as Response);

      expect(result).toEqual(mockLogoutResponse);
      expect(mockAuthService.logout).toHaveBeenCalledWith(42);
    });

    it('should use req.user.id when userId and sub are missing', async () => {
      const req = { user: { id: 77, email: 'a@b.com' } } as unknown as Request;
      const mockLogoutResponse = { message: 'Logged out successfully.' };
      mockAuthService.logout.mockResolvedValue(mockLogoutResponse);

      const result = await controller.logout(req, mockResponse as Response);

      expect(result).toEqual(mockLogoutResponse);
      expect(mockAuthService.logout).toHaveBeenCalledWith(77);
    });
  });

  describe('logout invalid payload handling', () => {
    it('should throw UnauthorizedException when req.user is missing, but still clear cookies', () => {
      const req = {} as unknown as Request;

      try {
        controller.logout(req, mockResponse as Response);
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toContain('Invalid token payload');
      }

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when extracted userId is falsy (0), but still clear cookies', () => {
      const req = { user: { userId: 0, sub: 0, id: 0 } } as unknown as Request;

      try {
        controller.logout(req, mockResponse as Response);
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toContain('Invalid token payload');
      }

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });
});
