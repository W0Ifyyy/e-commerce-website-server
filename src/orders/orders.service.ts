import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/typeorm/entities/Order';
import { Product } from 'src/typeorm/entities/Product';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { ICreateOrder } from 'utils/Interfaces';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(Product) private productRepository: Repository<Product>,
    @InjectRepository(User) private userRepository: Repository<User>,
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
  async getOrderById(id: number) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST);
    }
    try {
      let order = await this.orderRepository.findOne({
        where: { id },
        relations: ['user', 'products'],
      });
      if (!order)
        throw new HttpException(
          'Order with that id does not exist!',
          HttpStatus.NOT_FOUND,
        );
      return { statusCode: 200, msg: 'Order retrieved succesfully', order };
    } catch (error) {
      throw new HttpException(
        `An error occured while getting order by id: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createOrder(createOrderParams: ICreateOrder) {
    // Validate the userId
    if (!createOrderParams.userId || createOrderParams.userId <= 0) {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }

    try {
      // Resolve the user from the database
      const user = await this.userRepository.findOne({
        where: { id: createOrderParams.userId },
      });

      if (!user) {
        throw new HttpException(
          `User with ID ${createOrderParams.userId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Resolve the products from the database (if productIds are provided)
      let products = [];
      if (
        createOrderParams.productIds &&
        createOrderParams.productIds.length > 0
      ) {
        products = await this.productRepository.findByIds(
          createOrderParams.productIds,
        );

        if (products.length !== createOrderParams.productIds.length) {
          throw new HttpException(
            'One or more products not found',
            HttpStatus.NOT_FOUND,
          );
        }
      }

      const order = this.orderRepository.create({
        ...createOrderParams,
        user,
        products,
      });

      const savedOrder = await this.orderRepository.save(order);

      return {
        msg: 'Order created successfully!',
        order: savedOrder,
      };
    } catch (error) {
      throw new HttpException(
        `An error occurred while creating the order: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
