import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/typeorm/entities/Order';
import { Repository } from 'typeorm';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
  ) {}
  async getAllOrders() {
    try {
      let orders = await this.orderRepository.find({
        relations: ['user', 'products'],
      });
      return { msg: 'Orders retrieved succesfully', orders };
    } catch (error) {
      throw new HttpException(
        `An error occured while getting all orders: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
