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

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Roles("admin")
  @Get()
  getUsers(@Req() req: any) {
    return this.userService.getAllUsers();
  }

  @Roles("admin", "user")
  @Get(':id')
  getUserById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    canAccessUser(req, id);
    return this.userService.getUserById(id);
  }

  @Roles("admin", "user")
  @Put(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    canAccessUser(req, id);
    return this.userService.updateUser(id, updateUserDto);
  }

  @Roles("admin", "user")
  @Delete(':id')
  deleteUserById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    canAccessUser(req, id);
    return this.userService.deleteUserById(id);
  }

  @Roles("admin", "user")
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
  //email section is not done yet
  @Get('/verifyEmail')
  emailActions(@Req() req: any, @Query('email') email: string, @Query('emailType') emailType: string) {
    canAccessUser(req);
    return this.userService.emailActions(email, emailType);
  }
  @Get('/verifyEmail/confirm')
  verifyEmail(@Query('token') token: string) {
    return this.userService.verifyEmail(token);
  }
}
