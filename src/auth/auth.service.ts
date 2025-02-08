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
    const payload = { username: user.name, sub: user.id };
    const access_token = this.jwtService.sign(payload, { expiresIn: '60s' });
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
      const payload = this.jwtService.decode(refreshToken) as { sub: number };
      if (!payload) throw new UnauthorizedException('Invalid refresh token');

      const userId = payload.sub;

      const storedToken = await this.usersService.getRefreshToken(userId);
      if (!storedToken)
        throw new UnauthorizedException('Refresh token not found');

      const isValid = await compareTokens(
        refreshToken,
        storedToken.refreshToken,
      );
      if (!isValid) throw new UnauthorizedException('Invalid refresh token');

      const verifyToken = this.jwtService.verify(refreshToken);
      if (!verifyToken)
        throw new UnauthorizedException('Token verification failed');

      const newPayload = { username: storedToken.name, sub: userId };
      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '60s',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });

      const newHashedToken = await hashToken(newRefreshToken);
      await this.usersService.updateRefreshToken(userId, newHashedToken);

      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
