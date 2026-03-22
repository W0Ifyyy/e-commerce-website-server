import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(Product) private productRepository: Repository<Product>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async getOrderForCheckout(orderId: number) {
    if (!orderId || orderId <= 0) {
      throw new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST);
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) {
      throw new HttpException('Order with that id does not exist!', HttpStatus.NOT_FOUND);
    }

    return order;
  }

  async completeOrderFromWebhook(orderId: number, expectedTotalCents?: number) {
    const order = await this.getOrderForCheckout(orderId);

    if (typeof expectedTotalCents === 'number' && Number.isFinite(expectedTotalCents)) {
      const orderTotalCents = Math.round(Number(order.totalAmount) * 100);
      if (orderTotalCents !== expectedTotalCents) {
        throw new HttpException('Webhook total mismatch', HttpStatus.BAD_REQUEST);
      }
    }

    if (order.status !== 'PENDING') {
      return { received: true, ignored: true };
    }

    order.status = 'COMPLETED';
    await this.orderRepository.save(order);
    return { received: true };
  }
  async getAllOrders() {
    try {
      const orders = await this.orderRepository.find({
        relations: ['user', 'items', 'items.product'],
      });
      return { message: 'Orders retrieved successfully', orders };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get all orders', (error as any)?.stack ?? String(error));
      throw new HttpException(
        'An error occurred while getting all orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrderById(id: number, req: Request) {
    if (!id || id <= 0) {
      throw new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST);
    }
    try {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['user', 'items', 'items.product'],
      });
      if (!order)
        throw new HttpException(
          'Order with that id does not exist!',
          HttpStatus.NOT_FOUND,
        );
      canAccessUser(req, order.user.id);
      return { message: 'Order retrieved successfully', order };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get order by id', (error as any)?.stack ?? String(error));
      throw new HttpException(
        'An error occurred while getting order by id',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrdersByUserId(userId: number, req: Request){
    if(!userId || userId <= 0){
      throw new HttpException("Invalid user ID", HttpStatus.BAD_REQUEST);
    }
    canAccessUser(req, userId);
    try {
      const orders = await this.orderRepository.find(
        { where: { user: { id: userId } }, relations: ['user', 'items', 'items.product'] }
      );
      if (!orders || orders.length === 0)
        throw new HttpException("Orders of user with given id doesnt exist!", HttpStatus.NOT_FOUND);
      
      return { message: 'Orders retrieved successfully', orders };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get orders by user id', (error as any)?.stack ?? String(error));
      throw new HttpException(
        'An error occurred while getting orders by user id',
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

          if (!item.quantity || item.quantity <= 0) {
            throw new HttpException('Invalid quantity', HttpStatus.BAD_REQUEST);
          }

          return {
            product,
            quantity: item.quantity,
            unitPrice: Number(product.price),
          };
        }) || [];

      // Compute totalAmount server-side to prevent tampering
      const computedTotal = orderItems.reduce((sum, item) => {
        const unitPrice = Number((item as any).unitPrice);
        const quantity = Number((item as any).quantity);
        return sum + unitPrice * quantity;
      }, 0);

      // Orders are always created as PENDING - status changes only via payment webhook or admin
      const order = this.orderRepository.create({
        name: createOrderParams.name,
        user,
        items: orderItems,
        totalAmount: computedTotal,
        status: 'PENDING',
      });

      const savedOrder = await this.orderRepository.save(order);

      return {
        message: 'Order created successfully!',
        order: savedOrder,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create order', (error as any)?.stack ?? String(error));
      throw new HttpException(
        'An error occurred while creating the order',
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
      const order = await this.orderRepository.findOne({
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

      // Only admins can modify status and totalAmount to prevent payment bypass
      const isAdmin = req?.user?.role === 'admin';

      if (updateOrderParams.status !== undefined) {
        if (!isAdmin) {
          // Users can only cancel their pending orders
          if (updateOrderParams.status !== 'CANCELED' || order.status !== 'PENDING') {
            throw new HttpException(
              'Users can only cancel pending orders',
              HttpStatus.FORBIDDEN,
            );
          }
        }
        order.status = updateOrderParams.status;
      }

      // totalAmount can only be modified by admins - users cannot bypass payment
      if (updateOrderParams.totalAmount !== undefined && !isAdmin) {
        throw new HttpException(
          'Users cannot modify order total amount',
          HttpStatus.FORBIDDEN,
        );
      }
      if (updateOrderParams.totalAmount !== undefined && isAdmin) {
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
      return { message: 'Order updated successfully!' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update order', (error as any)?.stack ?? String(error));
      throw new HttpException(
        'An error occurred while updating the order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async deleteOrder(id: number, req: any) {
    if (id <= 0 || !id)
      throw new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST);
    try {
      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['user'],
      });
      if(!order) throw new HttpException(
          "The order you're trying to delete does not exist!",
          HttpStatus.NOT_FOUND,
        );
      canAccessUser(req, order.user.id);
      // Use remove() instead of delete() to prevent TOCTOU race condition
      await this.orderRepository.remove(order);
      return { message: 'Order deleted successfully' };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete order', (error as any)?.stack ?? String(error));
      throw new HttpException(
        'An error occurred while deleting the order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
