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
import { UserService } from './user.service';
import { UpdateUserDto } from 'src/user/dtos/UpdateUserDto';
import { canAccessUser } from 'utils/canAccess';
import { Roles } from 'utils/rolesDecorator';
import { Public } from 'utils/publicDecorator';
import { RequestPasswordDto } from './dtos/RequestPasswordResetDto';
import { TokenDto } from './dtos/TokenDto';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}
  @Public()
  @Get('/verifyEmail/confirm')
  verifyEmail(@Query('token') token: string) {
    return this.userService.verifyEmail(token);
  }

  @Public()
  @Post('/verifyEmail/confirm')
  verifyEmailPost(@Body() req: TokenDto) {
    return this.userService.verifyEmail(req?.token);
  }

  @Public()
  @Post("/resetPassword/request")
  resetPasswordRequest(@Body() req: RequestPasswordDto){
    return this.userService.emailActions(req.email, 'RESET');
  }

  @Public()
  @Post("/resetPassword/confirm")
  resetPasswordConfirm(@Body() req: {token: string, newPassword: string }){
    return this.userService.confirmResetPassword(req?.token, req?.newPassword);
  }

  @Roles('admin', 'user')
  @Post('/verifyEmail')
  async emailActions(
    @Req() req: any,
    @Body() body: { emailType: string; email?: string },
  ) {
    console.log("neck hurt")
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
    @Body() changePasswordDto: { oldPassword: string; newPassword: string },
  ) {
    canAccessUser(req, id);
    return this.userService.changePassword(
      id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
  }
}
