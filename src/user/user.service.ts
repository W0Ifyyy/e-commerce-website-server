import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { comparePassword, hashPassword } from 'utils/creatingPassword';
import { ICreateUser, IUpdateUser } from 'utils/Interfaces';
import * as nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import * as crypto from 'crypto';
import { sha256Hex } from 'utils/hashingTokens';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async getAllUsers() {
    let users = await this.usersRepository.find({ relations: ['orders'] });
    return users;
  }
  async getUserById(id: number) {
   // Validate ID
    if (!id || id <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }
    // Fetch user
    let user = await this.usersRepository.findOne({
      where: { id },
      relations: ['orders', 'orders.items.product'],
    });
    if (!user)
      throw new HttpException(
        `User with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );

      // Sanitize user object
    const safeUser = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      password: null,
    };

    return safeUser;
  }
  async createUser(params: ICreateUser) {
    //  Check if user with that email already exists
    let existingUser = await this.usersRepository.findOne({
      where: { email: params.email },
    });
    if (existingUser)
      throw new HttpException(
        'User with that email already exists!',
        HttpStatus.CONFLICT,
      );
    try {
      // Hash password and create user
      const hashedPassword = await hashPassword(params.password);
      const newUser = await this.usersRepository.save({
        ...params,
        password: hashedPassword,
      });
      // Return success message
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
    // Validate ID and params
    if (!id || id <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }
    if (!params) {
      throw new HttpException('Update parameters are required', HttpStatus.BAD_REQUEST);
    }
    // Update user
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
    // Validate ID
    if (!id || id <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }
    try {
      // Delete user
      let deletingUserOperation = await this.usersRepository.delete({ id });
      if (deletingUserOperation.affected === 0)
        throw new HttpException(
          "The user you're trying to delete does not exist!",
          HttpStatus.NOT_FOUND,
        );
      return { msg: 'User deleted succesfully' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Failed to delete user',
        (error as any)?.stack ?? String(error),
      );
      throw new HttpException(
        'An error occured while deleting the user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findOne(username: string) {
    try {
      // Find user by username
      return await this.usersRepository.findOne({ where: { name: username } });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Failed to find user by username',
        (error as any)?.stack ?? String(error),
      );
      throw new HttpException(
        'An error occured while finding user by username',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async updateRefreshToken(userId: number, refreshToken: string) {
    return this.usersRepository.update(userId, { refreshToken });
  }

  async getRefreshToken(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    return user
      ? { name: user.name, role: user.role, refreshToken: user.refreshToken }
      : null;
  }

  async removeRefreshToken(userId: number) {
    // Find user
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });
    // Validate user existence
    if (!user)
      throw new HttpException(
        `User with id of: ${userId} does not exist!`,
        HttpStatus.NOT_FOUND,
      );
    try {
      // Remove refresh token
      await this.usersRepository.update(user, { refreshToken: null });
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Failed to remove refresh token',
        (error as any)?.stack ?? String(error),
      );
      throw new HttpException(
        'An error occurred while removing refresh token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    // Find user and validate existence
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if(!user) throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    try {
      // Verify old password
      let isPasswordCorrect = await comparePassword(oldPassword, user.password);
      if (!isPasswordCorrect) {
        throw new HttpException(
          'Old password is incorrect',
          HttpStatus.UNAUTHORIZED,
        );
      }
      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      const result = await this.usersRepository.update(userId, {
        password: hashedPassword,
      });
      // Check update result
      if (result.affected === 0) {
        throw new HttpException(
          'User with this id does not exist!',
          HttpStatus.NOT_FOUND,
        );
      }
      return { msg: 'Password changed successfully!' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Failed to change password',
        (error as any)?.stack ?? String(error),
      );
      throw new HttpException(
        'An error occurred while changing the password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // In-memory cooldown (per server instance)
  private readonly emailCooldownMs = 60_000; // 60s
  private readonly emailCooldown = new Map<string, number>();

  private isOnCooldown(key: string): boolean {
    const last = this.emailCooldown.get(key);
    return typeof last === 'number' && Date.now() - last < this.emailCooldownMs;
  }

  private touchCooldown(key: string) {
    this.emailCooldown.set(key, Date.now());
  }

  async emailActions(email: string, emailType: string) {
    const normalizedType = (emailType ?? '').toUpperCase().trim();
    if (!['VERIFY', 'RESET'].includes(normalizedType)) {
      throw new HttpException('Invalid emailType', HttpStatus.BAD_REQUEST);
    }

    // Generic response to prevent email enumeration
    const generic = {
      message: 'An email has been sent if the address exists.',
    };

    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail) return generic;

    const cooldownKey = `${normalizedType}:${normalizedEmail}`;
    if (this.isOnCooldown(cooldownKey)) {
      // Same response to avoid signal; still prevents spamming
      return generic;
    }

    const user = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    // If user doesn't exist do not reveal it
    if (!user) {
      this.touchCooldown(cooldownKey);
      return generic;
    }

    try {
      // Generate token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(rawToken);
      const expiry = new Date(Date.now() + 3600000); // 1 hour
      
      // Store token
      if (normalizedType === 'VERIFY') {
        await this.usersRepository.update(user.id, {
          verifyToken: tokenHash,
          verifyTokenExpiry: expiry,
        });
      } else {
        await this.usersRepository.update(user.id, {
          forgetPasswordToken: tokenHash,
          forgetPasswordTokenExpiry: expiry,
        });
      }

      const token = process.env.MAILTRAP_TOKEN;
      const testInboxIdRaw = process.env.MAILTRAP_TEST_INBOX_ID;

      if (!token) throw new Error('MAILTRAP_TOKEN is not set');
      if (!testInboxIdRaw) throw new Error('MAILTRAP_TEST_INBOX_ID is not set');

      const testInboxId = Number(testInboxIdRaw);
      if (!Number.isFinite(testInboxId)) {
        throw new Error('MAILTRAP_TEST_INBOX_ID must be a number');
      }
      
      const transport = nodemailer.createTransport(
        MailtrapTransport({
          token,
          sandbox: true,
          testInboxId,
        }),
      );

      const webBase =
        process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000';

      const confirmUrl =
        normalizedType === 'VERIFY'
          ? `${webBase}/verifyEmail?token=${encodeURIComponent(rawToken)}`
          : `${webBase}/resetPassword?token=${encodeURIComponent(rawToken)}`;

      // Send email
      await transport.sendMail({
        from: {
          address: process.env.MAIL_FROM_ADDRESS ?? 'hello@example.com',
          name: process.env.MAIL_FROM_NAME ?? 'Mailtrap Test',
        },
        to: [normalizedEmail],
        subject:
          normalizedType === 'VERIFY' ? 'Verify your email' : 'Reset your password',
        text:
          normalizedType === 'VERIFY'
            ? `Verify your email: ${confirmUrl}`
            : `Reset your password: ${confirmUrl}`,
        category: 'Integration Test',
      });

      this.touchCooldown(cooldownKey);
      return generic;
    } catch (error: any) {
      throw new HttpException(
        'An error occured while sending email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyEmail(token: string) {
    // Validate input
    const raw = (token ?? '').trim();
    if (!raw) throw new HttpException('Missing token', HttpStatus.BAD_REQUEST);

    // Find user by token
    const tokenHash = sha256Hex(raw);
    const user = await this.usersRepository.findOne({ where: { verifyToken: tokenHash } });
    if (!user) throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);

    // Check token expiry
    if (!user.verifyTokenExpiry || user.verifyTokenExpiry.getTime() < Date.now()) {
      throw new HttpException('Token expired', HttpStatus.UNAUTHORIZED);
    }

    // Update isEmailVerified
    await this.usersRepository.update(user.id, {
      isEmailVerified: true,
      verifyToken: null,
      verifyTokenExpiry: null,
    });

    return { message: 'Email verified' };
  }

  async confirmResetPassword(token: string, newPassword: string){
    // Validate inputs
    const raw = (token ?? '').trim();
    if(!raw) throw new HttpException("Missing token",  HttpStatus.BAD_REQUEST);

    const passwordTrimmed = (newPassword ?? '').trim();
    if(!passwordTrimmed || passwordTrimmed.length === 0){
      throw new HttpException('Missing new password', HttpStatus.BAD_REQUEST);
    }
    
    // Find user by token
    const tokenHash = sha256Hex(raw);
    const user = await this.usersRepository.findOne({where: { forgetPasswordToken: tokenHash}})


    if(!user) throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);

    // Check token expiry
    
    if(!user.forgetPasswordTokenExpiry || user.forgetPasswordTokenExpiry.getTime() < Date.now()){
      throw new HttpException('Token expired', HttpStatus.UNAUTHORIZED);
    }

    // Update password
    const hashedPassword = await hashPassword(passwordTrimmed);
    await this.usersRepository.update(user.id, {
      password: hashedPassword,
      forgetPasswordToken: null,
      forgetPasswordTokenExpiry: null,
    })
    return { message: 'Password has been reset' };
  }

}
