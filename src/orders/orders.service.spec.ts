// mock auth helper used in OrdersService
jest.mock('utils/canAccess', () => ({
  canAccessUser: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from 'src/typeorm/entities/Order';
import { Product } from 'src/typeorm/entities/Product';
import { User } from 'src/typeorm/entities/User';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { canAccessUser } from 'utils/canAccess';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockProductRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    password: 'hashedPassword',
  };

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 100,
    description: 'Test description',
  };

  const mockOrder = {
    id: 1,
    name: 'Test Order',
    user: mockUser,
    items: [
      { id: 1, product: mockProduct, quantity: 2, unitPrice: 100 },
    ],
    totalAmount: 200,
    status: 'PENDING',
    createdAt: new Date(),
  };

  const mockReq: any = {
    user: { userId: 1, role: 'admin' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        { provide: getRepositoryToken(Product), useValue: mockProductRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllOrders', () => {
    it('should return all orders with relations', async () => {
      const mockOrders = [mockOrder];
      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const result = await service.getAllOrders();

      expect(result).toEqual({ msg: 'Orders retrieved successfully', orders: mockOrders });
      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        relations: ['user', 'items', 'items.product'],
      });
    });

    it('should return empty array when no orders exist', async () => {
      mockOrderRepository.find.mockResolvedValue([]);

      const result = await service.getAllOrders();

      expect(result).toEqual({
        msg: 'Orders retrieved successfully',
        orders: [],
      });
    });

    it('should throw INTERNAL_SERVER_ERROR on database failure', async () => {
      mockOrderRepository.find.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getAllOrders()).rejects.toThrow(HttpException);
      await expect(service.getAllOrders()).rejects.toThrow(
        'An error occurred while getting all orders',
      );
    });

    it('should wrap any error as INTERNAL_SERVER_ERROR', async () => {
      mockOrderRepository.find.mockRejectedValue(new Error('Unexpected error'));

      try {
        await service.getAllOrders();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('getOrderById', () => {
    it('should return an order by id with relations and check access', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);

      const result = await service.getOrderById(1, mockReq);

      expect(result).toEqual({
        statusCode: 200,
        msg: 'Order retrieved successfully',
        order: mockOrder,
      });
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['user', 'items', 'items.product'],
      });
      expect(canAccessUser).toHaveBeenCalledWith(mockReq, mockOrder.user.id);
    });

    it('should throw BAD_REQUEST for invalid order ID (zero)', async () => {
      await expect(service.getOrderById(0 as any, mockReq)).rejects.toThrow(
        new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockOrderRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid order ID (negative)', async () => {
      await expect(service.getOrderById(-1, mockReq)).rejects.toThrow(
        new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockOrderRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for null order ID', async () => {
      await expect(service.getOrderById(null, mockReq)).rejects.toThrow(
        new HttpException('Invalid order ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw NOT_FOUND when order does not exist', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrderById(999, mockReq)).rejects.toThrow(
        new HttpException('Order with that id does not exist!', HttpStatus.NOT_FOUND),
      );
    });

    it('should propagate database errors', async () => {
      mockOrderRepository.findOne.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getOrderById(1, mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(service.getOrderById(1, mockReq)).rejects.toThrow(
        'An error occurred while getting order by id',
      );
    });
  });

  describe('getOrdersByUserId', () => {
    it('should return orders for a user with relations', async () => {
      mockOrderRepository.find.mockResolvedValue([mockOrder]);
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);

      const result = await service.getOrdersByUserId(1, mockReq);

      expect(canAccessUser).toHaveBeenCalledWith(mockReq, 1);
      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        where: { user: { id: 1 } },
        relations: ['user', 'items', 'items.product'],
      });
      expect(result).toEqual({
        statusCode: 200,
        msg: 'Orders retrieved successfully',
        orders: [mockOrder],
      });
    });

    it('should throw BAD_REQUEST for invalid userId', async () => {
      await expect(service.getOrdersByUserId(0 as any, mockReq)).rejects.toThrow(
        new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST),
      );
      expect(canAccessUser).not.toHaveBeenCalled();
      expect(mockOrderRepository.find).not.toHaveBeenCalled();
    });

    it('should propagate canAccessUser errors (it is called before try/catch)', async () => {
      (canAccessUser as jest.Mock).mockImplementation(() => {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      });

      await expect(service.getOrdersByUserId(1, mockReq)).rejects.toThrow(
        'Unauthorized',
      );
      expect(mockOrderRepository.find).not.toHaveBeenCalled();
    });

    it('should wrap NOT_FOUND as INTERNAL_SERVER_ERROR when no orders exist', async () => {
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);
      mockOrderRepository.find.mockResolvedValue([]);

      await expect(service.getOrdersByUserId(1, mockReq)).rejects.toThrow(
        new HttpException(
          'Orders of user with given id doesnt exist!',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('createOrder', () => {
    const createOrderParams = {
      userId: 1,
      name: 'New Order',
      items: [{ productId: 1, quantity: 2 }],
      totalAmount: 200,
      status: 'PENDING' as 'PENDING' | 'COMPLETED' | 'CANCELED',
    };

    it('should create an order successfully and check access', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockProductRepository.find.mockResolvedValue([mockProduct]);
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);

      const result = await service.createOrder(createOrderParams, mockReq);

      expect(canAccessUser).toHaveBeenCalledWith(mockReq, mockUser.id);
      expect(result).toEqual({ msg: 'Order created successfully!', order: mockOrder });
    });

    it('should throw BAD_REQUEST for invalid user ID (zero)', async () => {
      await expect(
        service.createOrder({ ...createOrderParams, userId: 0 }, mockReq),
      ).rejects.toThrow(new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST));
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid user ID (negative)', async () => {
      await expect(
        service.createOrder({ ...createOrderParams, userId: -1 }, mockReq),
      ).rejects.toThrow(
        new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BAD_REQUEST for null user ID', async () => {
      await expect(
        service.createOrder({ ...createOrderParams, userId: null }, mockReq),
      ).rejects.toThrow(
        new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.createOrder(createOrderParams, mockReq)).rejects.toThrow(
        new HttpException('User with ID 1 not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw NOT_FOUND when products are not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockProductRepository.find.mockResolvedValue([]); // No products found

      try {
        await service.createOrder(createOrderParams, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.message).toContain('One or more products not found');
      }
    });

    it('should throw NOT_FOUND when some products are missing', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockProductRepository.find.mockResolvedValue([mockProduct]); // Only 1 product

      const paramsWithMultipleProducts = {
        ...createOrderParams,
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
      };

      try {
        await service.createOrder(paramsWithMultipleProducts, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.message).toContain('One or more products not found');
      }
    });

    it('should create order without items', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      const orderWithoutItems = { ...mockOrder, items: [] };
      mockOrderRepository.create.mockReturnValue(orderWithoutItems);
      mockOrderRepository.save.mockResolvedValue(orderWithoutItems);

      const paramsWithoutItems = {
        userId: 1,
        name: 'Order without items',
        totalAmount: 0,
        items: [],
      };

      const result = await service.createOrder(paramsWithoutItems, mockReq);

      expect(result.msg).toBe('Order created successfully!');
      expect(mockProductRepository.find).not.toHaveBeenCalled();
    });

    it('should default status to PENDING when not provided', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockProductRepository.find.mockResolvedValue([mockProduct]);
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const paramsWithoutStatus = {
        userId: 1,
        name: 'Order',
        items: [{ productId: 1, quantity: 1 }],
        totalAmount: 100,
      };

      await service.createOrder(paramsWithoutStatus, mockReq);

      expect(mockOrderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      );
    });

    it('should calculate unit price from product price', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockProductRepository.find.mockResolvedValue([mockProduct]);
      mockOrderRepository.create.mockImplementation((order) => order);
      mockOrderRepository.save.mockImplementation((order) => order);

      await service.createOrder(createOrderParams, mockReq);

      const createCall = mockOrderRepository.create.mock.calls[0][0];
      expect(createCall.items[0].unitPrice).toBe(mockProduct.price);
    });

    it('should propagate database save errors', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockProductRepository.find.mockResolvedValue([mockProduct]);
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockRejectedValue(
        new Error('Database save failed'),
      );

      await expect(
        service.createOrder(createOrderParams, mockReq),
      ).rejects.toThrow(
        'An error occurred while creating the order',
      );
    });
  });

  describe('updateOrder', () => {
    const updateOrderParams = {
      name: 'Updated Order',
      status: 'COMPLETED' as 'PENDING' | 'COMPLETED' | 'CANCELED',
      totalAmount: 300,
    };

    it('should update an order successfully', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue({
        ...mockOrder,
        ...updateOrderParams,
      });
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);

      const result = await service.updateOrder(1, updateOrderParams, mockReq);

      expect(canAccessUser).toHaveBeenCalledWith(mockReq, mockOrder.user.id);
      expect(result).toEqual({ msg: 'Order updated successfully!', statusCode: 200 });
    });

    it('should throw BAD_REQUEST for invalid order ID (zero)', async () => {
      await expect(
        service.updateOrder(0, updateOrderParams, mockReq),
      ).rejects.toThrow(
        new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockOrderRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid order ID (negative)', async () => {
      await expect(
        service.updateOrder(-5, updateOrderParams, mockReq),
      ).rejects.toThrow(
        new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BAD_REQUEST for null order ID', async () => {
      await expect(
        service.updateOrder(null, updateOrderParams, mockReq),
      ).rejects.toThrow(
        new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw NOT_FOUND when order does not exist', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      try {
        await service.updateOrder(999, updateOrderParams, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.message).toContain('Order with this ID does not exist!');
      }
    });

    it('should update only name when provided', async () => {
      const updatedOrder = { ...mockOrder, name: 'New Name' };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(updatedOrder);

      await service.updateOrder(1, { name: 'New Name' }, mockReq);

      const savedOrder = mockOrderRepository.save.mock.calls[0][0];
      expect(savedOrder.name).toBe('New Name');
    });

    it('should update only status when provided', async () => {
      const updatedOrder = { ...mockOrder, status: 'CANCELED' };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(updatedOrder);

      await service.updateOrder(1, { status: 'CANCELED' }, mockReq);

      const savedOrder = mockOrderRepository.save.mock.calls[0][0];
      expect(savedOrder.status).toBe('CANCELED');
    });

    it('should update only totalAmount when provided', async () => {
      const updatedOrder = { ...mockOrder, totalAmount: 500 };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(updatedOrder);

      await service.updateOrder(1, { totalAmount: 500 }, mockReq);

      const savedOrder = mockOrderRepository.save.mock.calls[0][0];
      expect(savedOrder.totalAmount).toBe(500);
    });

    it('should update user when userId is provided', async () => {
      const newUser = { ...mockUser, id: 2, name: 'New User' };
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockUserRepository.findOne.mockResolvedValue(newUser);
      mockOrderRepository.save.mockResolvedValue({
        ...mockOrder,
        user: newUser,
      });

      await service.updateOrder(1, { userId: 2 }, mockReq);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 2 },
      });
      const savedOrder = mockOrderRepository.save.mock.calls[0][0];
      expect(savedOrder.user).toEqual(newUser);
    });

    it('should throw NOT_FOUND when new user does not exist', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.updateOrder(1, { userId: 999 }, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.message).toContain('User with ID 999 not found');
      }
    });

    it('should handle empty update params', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const result = await service.updateOrder(1, {}, mockReq);

      expect(result.msg).toBe('Order updated successfully!');
      expect(mockOrderRepository.save).toHaveBeenCalledWith(mockOrder);
    });

    it('should propagate database save errors', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockRejectedValue(
        new Error('Database update failed'),
      );

      await expect(
        service.updateOrder(1, updateOrderParams, mockReq),
      ).rejects.toThrow(
        'An error occurred while updating the order',
      );
    });

    it('should wrap all errors as INTERNAL_SERVER_ERROR', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockRejectedValue(new Error('Some error'));

      try {
        await service.updateOrder(1, updateOrderParams, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order successfully', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.delete.mockResolvedValue({ affected: 1 });
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);

      const result = await service.deleteOrder(1, mockReq);

      expect(canAccessUser).toHaveBeenCalledWith(mockReq, mockOrder.user.id);
      expect(result).toEqual({ msg: 'Order deleted successfully', statusCode: 200 });
      expect(mockOrderRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw BAD_REQUEST for invalid order ID (zero)', async () => {
      await expect(service.deleteOrder(0, mockReq)).rejects.toThrow(
        new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST),
      );
      expect(mockOrderRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid order ID (negative)', async () => {
      await expect(service.deleteOrder(-10, mockReq)).rejects.toThrow(
        new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw BAD_REQUEST for null order ID', async () => {
      await expect(service.deleteOrder(null, mockReq)).rejects.toThrow(
        new HttpException('Invalid Order ID', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw NOT_FOUND when order does not exist', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      try {
        await service.deleteOrder(999, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.message).toContain(
          "The order you're trying to delete does not exist!",
        );
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should propagate database errors', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.delete.mockRejectedValue(
        new Error('Database deletion failed'),
      );

      await expect(service.deleteOrder(1, mockReq)).rejects.toThrow(
        'An error occurred while deleting the order',
      );
    });

    it('should wrap all errors as INTERNAL_SERVER_ERROR', async () => {
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.delete.mockRejectedValue(
        new Error('Unexpected error'),
      );

      try {
        await service.deleteOrder(1, mockReq);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  });
});