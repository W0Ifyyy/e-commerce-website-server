import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Order } from 'src/typeorm/entities/Order';
import { Product } from 'src/typeorm/entities/Product';
import { User } from 'src/typeorm/entities/User';
import { In, Repository } from 'typeorm';
import { canAccessUser } from 'utils/canAccess';
import { ICreateOrder, IUpdateOrder } from 'utils/Interfaces';

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
        relations: ['user', 'items', 'items.product'],
      });
      return { msg: 'Orders retrieved successfully', orders };
    } catch (error) {
      throw new HttpException(
        `An error occurred while getting all orders: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrderById(id: number, req: Request) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST);
    }
    try {
      let order = await this.orderRepository.findOne({
        where: { id },
        relations: ['user', 'items', 'items.product'],
      });
      if (!order)
        throw new HttpException(
          'Order with that id does not exist!',
          HttpStatus.NOT_FOUND,
        );
      canAccessUser(req, order.user.id);
      return { statusCode: 200, msg: 'Order retrieved successfully', order };
    } catch (error) {
      throw new HttpException(
        `An error occurred while getting order by id: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrdersByUserId(userId: number){
    if(!userId || userId <= 0){
      throw new HttpException("Invalid user ID", HttpStatus.BAD_REQUEST);
    }
    try {
      let orders = await this.orderRepository.find(
        { where: { user: { id: userId }}, relations: ['user', 'items', 'items.product'] }
      )
      if(!orders || orders.length === 0)
        throw new HttpException("Orders of user with given id doesnt exist!", HttpStatus.NOT_FOUND);
      
      return { statusCode: 200, msg: "Orders retrieved successfully", orders};
    } catch (error) {
      throw new HttpException(
        `An error occurred while getting orders by user id: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createOrder(createOrderParams: ICreateOrder, req: Request) {
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

      canAccessUser(req, user.id);

      // If items are provided, fetch all products at once to validate and use them
      let productMap = new Map();
      if (createOrderParams.items && createOrderParams.items.length > 0) {
        const productIds = createOrderParams.items.map(
          (item) => item.productId,
        );
        const products = await this.productRepository.find({
          where: { id: In(productIds) },
        });

        if (products.length !== productIds.length) {
          throw new HttpException(
            'One or more products not found',
            HttpStatus.NOT_FOUND,
          );
        }

        // Create a map for quick product lookup
        products.forEach((product) => {
          productMap.set(product.id, product);
        });
      }

      // Create order items from the provided items
      const orderItems =
        createOrderParams.items?.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new HttpException(
              `Product with ID ${item.productId} not found`,
              HttpStatus.NOT_FOUND,
            );
          }

          return {
            product,
            quantity: item.quantity,
            unitPrice: product.price,
          };
        }) || [];

      const order = this.orderRepository.create({
        name: createOrderParams.name,
        user,
        items: orderItems,
        totalAmount: createOrderParams.totalAmount,
        status: createOrderParams.status || 'PENDING',
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
  async updateOrder(
    id: number,
    updateOrderParams: IUpdateOrder,
    req?: Request,
  ) {
    if (id <= 0 || !id)
      throw new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST);

    try {
      let order = await this.orderRepository.findOne({
        where: { id },
        relations: ['user', 'items', 'items.product'],
      });
      

      if (!order)
        throw new HttpException(
          'Order with this ID does not exist!',
          HttpStatus.NOT_FOUND,
        );

      if (req) {
        canAccessUser(req, order.user.id);
      }

      // Update basic properties
      if (updateOrderParams.name !== undefined) {
        order.name = updateOrderParams.name;
      }

      if (updateOrderParams.status !== undefined) {
        order.status = updateOrderParams.status;
      }

      if (updateOrderParams.totalAmount !== undefined) {
        order.totalAmount = updateOrderParams.totalAmount;
      }

      // Update user if needed
      if (updateOrderParams.userId) {
        const user = await this.userRepository.findOne({
          where: { id: updateOrderParams.userId },
        });

        if (!user) {
          throw new HttpException(
            `User with ID ${updateOrderParams.userId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }

        order.user = user;
      }

      await this.orderRepository.save(order);
      return { msg: 'Order updated successfully!', statusCode: 200 };
    } catch (error: any) {
      throw new HttpException(
        `An error occurred while updating the order... Error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async deleteOrder(id: number, req: any) {
    if (id <= 0 || !id)
      throw new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST);
    try {
      let order = await this.orderRepository.findOne({where: {id}});
      if(!order) throw new HttpException(
          "The order you're trying to delete does not exist!",
          HttpStatus.NOT_FOUND,
        );
      canAccessUser(req, order.user.id);
      
      let result = await this.orderRepository.delete(id);
      if (result.affected === 0)
        throw new HttpException(
          "The order you're trying to delete does not exist!",
          HttpStatus.NOT_FOUND,
        );
      return { msg: 'Order deleted successfully', statusCode: 200 };
    } catch (error: any) {
      throw new HttpException(
        `An error occured while deleting the order... Error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
