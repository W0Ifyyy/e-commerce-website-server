import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { comparePassword, hashPassword } from 'utils/creatingPassword';
import { hashToken } from 'utils/hashingTokens';
import { ICreateUser, IUpdateUser } from 'utils/Interfaces';
import nodemailer from 'nodemailer';
import { from } from 'rxjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}
  async getAllUsers() {
    let users = await this.usersRepository.find({ relations: ['orders'] });
    return users;
  }
  async getUserById(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }
    let user = await this.usersRepository.findOne({
      where: { id },
      relations: ['orders', 'orders.items.product'],
    });
    if (!user)
      throw new HttpException(
        `User with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );

    const safeUser = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      password: null,
    };

    return safeUser;
  }
  async createUser(params: ICreateUser) {
    let existingUser = await this.usersRepository.findOne({
      where: { email: params.email },
    });
    if (existingUser)
      throw new HttpException(
        'User with that email already exists!',
        HttpStatus.CONFLICT,
      );
    try {
      const hashedPassword = await hashPassword(params.password);
      const newUser = await this.usersRepository.save({
        ...params,
        password: hashedPassword,
      });
      return {
        msg: 'User created succesfully!',
        user: { ...newUser, password: null },
      };
    } catch (error: any) {
      console.log(error);
      throw new HttpException(
        'An error occurred while creating the user.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateUser(id: number, params: IUpdateUser) {
    //todo: check if params are undefined
    if (!id || id <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }
    const result = await this.usersRepository.update(id, params);
    if (result.affected === 0) {
      throw new HttpException(
        'User with this id does not exist!',
        HttpStatus.NOT_FOUND,
      );
    }
    return { msg: 'User updated successfully!' };
  }
  async deleteUserById(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }
    try {
      let deletingUserOperation = await this.usersRepository.delete({ id });
      if (deletingUserOperation.affected === 0)
        throw new HttpException(
          "The user you're trying to delete does not exist!",
          HttpStatus.NOT_FOUND,
        );
      return { msg: 'User deleted succesfully' };
    } catch (error) {
      console.log(`An error occured while deleting the user: ${error.message}`);
      throw new HttpException(
        'An error occured while deleting the user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findOne(username: string) {
    try {
      return await this.usersRepository.findOne({ where: { name: username } });
    } catch (error) {
      throw new HttpException(
        `An error occured while finding user by username, error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async updateRefreshToken(userId: number, refreshToken: string) {
    return this.usersRepository.update(userId, { refreshToken });
  }

  async getRefreshToken(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    return user ? { name: user.name, refreshToken: user.refreshToken } : null;
  }

  async removeRefreshToken(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (!user)
      throw new HttpException(
        `User with id of: ${userId} does not exist!`,
        HttpStatus.NOT_FOUND,
      );
    try {
      await this.usersRepository.update(user, { refreshToken: null });
    } catch (error: any) {
      throw new HttpException(
        `An error occured while creating the user. Error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    try {
      let isPasswordCorrect = await comparePassword(oldPassword, user.password);
      if (!isPasswordCorrect) {
        throw new HttpException(
          'Old password is incorrect',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const hashedPassword = await hashPassword(newPassword);
      const result = await this.usersRepository.update(userId, {
        password: hashedPassword,
      });
      if (result.affected === 0) {
        throw new HttpException(
          'User with this id does not exist!',
          HttpStatus.NOT_FOUND,
        );
      }
      return { msg: 'Password changed successfully!' };
    } catch (error) {
      throw new HttpException(
        `An error occured while changing the password: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async emailActions(email: string,  emailType: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
      try {
        const hashedToken = await hashToken(user.id.toString());
        if (emailType === 'VERIFY') {
          await this.usersRepository.update(user.id, {
          verifyToken: hashedToken,
          verifyTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
        });
        } else if(emailType === "RESET"){
          await this.usersRepository.update(user.id, {
          forgetPasswordToken: hashedToken,
          forgetPasswordTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
        });
        }
      const transport = nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
          user: process.env.NODEMAILER_USER,
          pass: process.env.NODEMAILER_PASS
        }
      });

      const mailOptions = {
          from: "test@gmail.com",
          to: email,
          subject: emailType === "VERIFY" ? "Verify your email" : "Reset your password",
          html: `<p>Click <a href="${process.env.NEXT_PUBLIC_BASE_UR}/verifyemail?token=${hashedToken}">here</a> to ${emailType === "VERIFY" ? "verify your email" : "reset your password"}</p>`
      };
      const mailResponse = await transport.sendMail(mailOptions);
      return mailResponse;
      } catch (error) {
        throw new HttpException(`An error occured while verifying email: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    async verifyEmail(token:string){
      
    }
}

