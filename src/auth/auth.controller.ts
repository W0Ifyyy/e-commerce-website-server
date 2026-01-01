import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Request,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.auth.guard';
import { Public } from 'utils/publicDecorator';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dtos/CreateUserDto';
import { Response } from 'express';
import { csrf } from 'src/csrf';
import { Request as ExpressRequest } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Generate tokens
    const { access_token, refresh_token } = await this.authService.login(
      req.user,
    );
    // Set cookies
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 15,
    });
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    // CSRF token (per NestJS docs via `csrf-csrf`).
    // Frontend must send: header `x-csrf-token` with the `csrfToken` returned here.
    // The `csrfToken` cookie is an httpOnly hash managed by `csrf-csrf`.
    const csrfToken = csrf.generateCsrfToken(req, res);
    return { message: 'Logged in', csrfToken, csrf_token: csrfToken };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @Post('register')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
    @Body('refresh_token') bodyToken?: string,
  ) {
    const cookieToken = req?.cookies?.refresh_token as string | undefined;
    const token = cookieToken ?? bodyToken;
    const { access_token, refresh_token } = await this.authService.refreshToken(token);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 15,
    });
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const csrfToken = csrf.generateCsrfToken(req as any, res);
    return { message: 'Refreshed', csrfToken, csrf_token: csrfToken };
  }
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('logout')
  logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Clear cookies
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });

    const userId = req?.user?.userId ?? req?.user?.sub ?? req?.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return this.authService.logout(userId);
  }
}
