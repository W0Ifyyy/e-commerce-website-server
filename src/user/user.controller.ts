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

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}
  private canAccessUser(req: any, userId?: number){
    const role = req.user?.role;
    if (role === 'admin') return;

    const currentUserId = req.user?.userId;  

    if (userId !== undefined && currentUserId !== userId) {
      throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (userId === undefined) {
      throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
    }
  }
  @Get()
  getUsers(@Req() req: any) {
    this.canAccessUser(req);
    return this.userService.getAllUsers();
  }
  @Get(':id')
  getUserById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    this.canAccessUser(req, id);
    return this.userService.getUserById(id);
  }

  @Put(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    this.canAccessUser(req, id);
    return this.userService.updateUser(id, updateUserDto);
  }
  @Delete(':id')
  deleteUserById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    this.canAccessUser(req, id);
    return this.userService.deleteUserById(id);
  }
  @Put('/changePassword/:id')
  changePassword(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: { oldPassword: string; newPassword: string },
  ) {
    this.canAccessUser(req, id);
    return this.userService.changePassword(
      id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
  }
  @Get('/verifyEmail')
  emailActions(@Req() req: any, @Query('email') email: string, @Query('emailType') emailType: string) {
    this.canAccessUser(req);
    return this.userService.emailActions(email, emailType);
  }
  @Get('/verifyEmail/confirm')
  verifyEmail(@Query('token') token: string) {
    return this.userService.verifyEmail(token);
  }
}
