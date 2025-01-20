import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}
  async getAllUsers() {
    let users = await this.usersRepository.find();
    return users;
  }
  async getUserById(id: number) {
    let user = await this.usersRepository.findOne({ where: { id } });
    if (!user)
      throw new HttpException(
        `User with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    return user;
  }
}
