import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from 'src/user/dtos/UpdateUserDto';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}
  @Get()
  getUsers() {
    return this.userService.getAllUsers();
  }
  @Get(':id')
  getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserById(id);
  }

  @Put(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, updateUserDto);
  }
  @Delete(':id')
  deleteUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUserById(id);
  }
  @Put('/changePassword/:id')
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: { oldPassword: string; newPassword: string },
  ) {
    return this.userService.changePassword(
      id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
  }
  @Get('/verifyEmail')
  emailActions(@Query('email') email: string, @Query('emailType') emailType: string) {
    return this.userService.emailActions(email, emailType);
  }
  @Get('/verifyEmail/confirm')
  verifyEmail(@Query('token') token: string) {
    return this.userService.verifyEmail(token);
  }
}
