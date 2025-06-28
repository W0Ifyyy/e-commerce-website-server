import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.auth.guard';
import { Public } from 'utils/publicDecorator';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dtos/CreateUserDto';
import { Response } from 'express';

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
  async logout(@Request() req) {
    return this.authService.logout(req.user.sub);
  }
}
