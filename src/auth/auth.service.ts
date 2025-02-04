import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { comparePassword } from 'utils/creatingPassword';

@Injectable()
export class AuthService {
  constructor(private usersService: UserService) {}
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
}
