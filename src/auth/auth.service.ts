import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { comparePassword } from 'utils/creatingPassword';
import { compareTokens, hashToken } from 'utils/hashingTokens';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
  ) {}
  async validateUser(username: string, password: string) {
    const user = await this.usersService.findOne(username);
    if (!user) return null;
    let isPasswordValid = await comparePassword(password, user.password);
    if (isPasswordValid) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
  async login(user: any) {
    const payload = { username: user.name, sub: user.id, role: user.role };
    const access_token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });
    const hashedRefreshToken = await hashToken(refresh_token);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);
    return {
      access_token,
      refresh_token,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      if (!refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      //Jwt verification
      const payload = this.jwtService.verify<{ sub: number; username?: string }>(
        refreshToken,
      );

      const userId = payload.sub;
      if (!userId || userId <= 0) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      //checking hashed token from db
      const storedToken = await this.usersService.getRefreshToken(userId);
      if (!storedToken || !storedToken.refreshToken) {
        throw new UnauthorizedException('Refresh token not found');
      }

      const isValid = await compareTokens(
        refreshToken,
        storedToken.refreshToken,
      );
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // token rotation
      const newPayload = { username: storedToken.name, sub: userId };
      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '600s',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });

      const newHashedToken = await hashToken(newRefreshToken);
      await this.usersService.updateRefreshToken(userId, newHashedToken);

      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (error) {
      console.log('Refresh token error:', error?.message);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
  async logout(userId: number) {
    await this.usersService.removeRefreshToken(userId);
    return { message: 'Logged out successfully.' };
  }
}
