import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserService } from './user.service';
import { UpdateUserDto } from 'src/user/dtos/UpdateUserDto';
import { canAccessUser } from 'utils/canAccess';
import { Roles } from 'utils/rolesDecorator';
import { Public } from 'utils/publicDecorator';
import { RequestPasswordDto } from './dtos/RequestPasswordResetDto';
import { TokenDto } from './dtos/TokenDto';
import ConfirmResetPasswordDto from './dtos/ConfirmResetPasswordDto';
import EmailActionsDto from './dtos/EmailActionsDto';
import ChangePasswordDto from './dtos/ChangePasswordDto';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('/verifyEmail/confirm')
  verifyEmailPost(@Body() req: TokenDto) {
    return this.userService.verifyEmail(req?.token);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @Post("/resetPassword/request")
  resetPasswordRequest(@Body() req: RequestPasswordDto){
    return this.userService.emailActions(req.email, 'RESET');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post("/resetPassword/confirm")
  resetPasswordConfirm(@Body() req: ConfirmResetPasswordDto){
    return this.userService.confirmResetPassword(req?.token, req?.newPassword);
  }

  @Roles('admin', 'user')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('/verifyEmail')
  async emailActions(
    @Req() req: any,
    @Body() body: EmailActionsDto,
  ) {
    const userId = req?.user?.userId;
    canAccessUser(req, userId);

    const user = await this.userService.getUserById(userId);

    // Non-admin: force target email to own email (ignore body.email)
    // Admin: can send to provided email; if missing, defaults to own.
    const targetEmail = user.role === 'admin'
      ? (body.email ?? user.email)
      : user.email;

    return this.userService.emailActions(targetEmail, body.emailType);
  }

  @Roles('admin')
  @Get()
  getUsers(@Req() req: any) {
    return this.userService.getAllUsers();
  }

  @Roles('admin', 'user')
  @Get(':id')
  getUserById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    canAccessUser(req, id);
    return this.userService.getUserById(id);
  }

  @Roles('admin', 'user')
  @Put(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    canAccessUser(req, id);
    return this.userService.updateUser(id, updateUserDto);
  }

  @Roles('admin', 'user')
  @Delete(':id')
  deleteUserById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    canAccessUser(req, id);
    return this.userService.deleteUserById(id);
  }

  @Roles('admin', 'user')
  @Put('/changePassword/:id')
  changePassword(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangePasswordDto,
  ) {
    canAccessUser(req, id);
    return this.userService.changePassword(
      id,
      body.oldPassword,
      body.newPassword,
    );
  }
}
