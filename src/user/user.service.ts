import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { comparePassword, hashPassword } from 'utils/creatingPassword';
import { ICreateUser, IUpdateUser } from 'utils/Interfaces';
import * as nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import * as crypto from 'crypto';

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

  // In-memory cooldown (per server instance)
  private readonly emailCooldownMs = 60_000; // 60s
  private readonly emailCooldown = new Map<string, number>();

  private sha256Hex(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

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
      message: 'If the account exists, an email has been sent.',
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

    // If user doesn't exist -> do NOT reveal it
    if (!user) {
      this.touchCooldown(cooldownKey);
      return generic;
    }

    try {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.sha256Hex(rawToken);
      const expiry = new Date(Date.now() + 3600000); // 1 hour

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
    const raw = (token ?? '').trim();
    if (!raw) throw new HttpException('Missing token', HttpStatus.BAD_REQUEST);

    const tokenHash = this.sha256Hex(raw);

    const user = await this.usersRepository.findOne({ where: { verifyToken: tokenHash } });
    if (!user) throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);

    if (!user.verifyTokenExpiry || user.verifyTokenExpiry.getTime() < Date.now()) {
      throw new HttpException('Token expired', HttpStatus.UNAUTHORIZED);
    }

    await this.usersRepository.update(user.id, {
      isEmailVerified: true,
      verifyToken: null,
      verifyTokenExpiry: null,
    });

    return { message: 'Email verified' };
  }
}

