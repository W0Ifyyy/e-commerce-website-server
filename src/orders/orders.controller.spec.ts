// mock auth helpers
jest.mock('utils/canAccess', () => ({
  canAccess: jest.fn(),
  canAccessUser: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dtos/CreateOrderDto';
import { UpdateOrderDto } from './dtos/UpdateOrderDto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { canAccess, canAccessUser } from 'utils/canAccess';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    getAllOrders: jest.fn(),
    getOrderById: jest.fn(),
    getOrdersByUserId: jest.fn(),
    createOrder: jest.fn(),
    updateOrder: jest.fn(),
    deleteOrder: jest.fn(),
  };

  const mockOrder = {
    id: 1,
    name: 'Test Order',
    user: { id: 1, name: 'Test User', email: 'test@test.com' },
    items: [
      {
        id: 1,
        product: { id: 1, name: 'Test Product', price: 100 },
        quantity: 2,
        unitPrice: 100,
      },
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
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOrders', () => {
    it('should return all orders', async () => {
      const mockResponse = {
        message: 'Orders retrieved successfully',
        orders: [mockOrder],
      };

      mockOrdersService.getAllOrders.mockResolvedValue(mockResponse);

      const result = await controller.getOrders();

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.getAllOrders).toHaveBeenCalledTimes(1);
      expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith();
    });

    it('should return empty orders array', async () => {
      const mockResponse = { message: 'Orders retrieved successfully', orders: [] };

      mockOrdersService.getAllOrders.mockResolvedValue(mockResponse);

      const result = await controller.getOrders();

      expect(result).toEqual(mockResponse);
      expect(result.orders).toHaveLength(0);
    });

    it('should propagate service errors', async () => {
      const error = new HttpException(
        'Database error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.getAllOrders.mockRejectedValue(error);

      await expect(controller.getOrders()).rejects.toThrow(HttpException);
      await expect(controller.getOrders()).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle unexpected errors', async () => {
      mockOrdersService.getAllOrders.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(controller.getOrders()).rejects.toThrow(
        'Unexpected error',
      );
    });
  });

  describe('getOrderById', () => {
    it('should return an order by id', async () => {
      const mockResponse = {
        message: 'Order retrieved successfully',
        order: mockOrder,
      };
      mockOrdersService.getOrderById.mockResolvedValue(mockResponse);

      const result = await controller.getOrderById(1, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(1, mockReq);
      expect(mockOrdersService.getOrderById).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      const orderId = 42;
      mockOrdersService.getOrderById.mockResolvedValue({
        message: 'Order retrieved successfully',
        order: { ...mockOrder, id: orderId },
      });

      await controller.getOrderById(orderId, mockReq);

      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(
        orderId,
        mockReq,
      );
    });

    it('should propagate BAD_REQUEST error for invalid id', async () => {
      const error = new HttpException(
        'Invalid order ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.getOrderById.mockRejectedValue(error);

      await expect(controller.getOrderById(0, mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.getOrderById(0, mockReq)).rejects.toThrow(
        'Invalid order ID',
      );
    });

    it('should propagate NOT_FOUND error when order does not exist', async () => {
      const error = new HttpException(
        'Order with that id does not exist!',
        HttpStatus.NOT_FOUND,
      );
      mockOrdersService.getOrderById.mockRejectedValue(error);

      await expect(controller.getOrderById(999, mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.getOrderById(999, mockReq)).rejects.toThrow(
        'Order with that id does not exist',
      );
    });

    it('should propagate database errors', async () => {
      const error = new HttpException(
        'Database connection failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.getOrderById.mockRejectedValue(error);

      await expect(controller.getOrderById(1, mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getOrdersByUserId', () => {
    it('should return orders for a userId and call canAccessUser', async () => {
      const mockResponse = {
        message: 'Orders retrieved successfully',
        orders: [mockOrder],
      };

      (canAccessUser as jest.Mock).mockImplementation(() => undefined);
      mockOrdersService.getOrdersByUserId.mockResolvedValue(mockResponse);

      const result = await controller.getOrdersByUserId(1, mockReq);

      expect(canAccessUser).toHaveBeenCalledWith(mockReq, 1);
      expect(mockOrdersService.getOrdersByUserId).toHaveBeenCalledWith(1, mockReq);
      expect(result).toEqual(mockResponse);
    });

    it('should throw Unauthorized when canAccessUser throws', () => {
      (canAccessUser as jest.Mock).mockImplementation(() => {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      });

      expect(() => controller.getOrdersByUserId(1, mockReq)).toThrow(HttpException);
      expect(() => controller.getOrdersByUserId(1, mockReq)).toThrow('Unauthorized');
      expect(mockOrdersService.getOrdersByUserId).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      (canAccessUser as jest.Mock).mockImplementation(() => undefined);

      mockOrdersService.getOrdersByUserId.mockRejectedValue(
        new HttpException('Service error', HttpStatus.INTERNAL_SERVER_ERROR),
      );

      await expect(controller.getOrdersByUserId(1, mockReq)).rejects.toThrow(
        'Service error',
      );
    });
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      userId: 1,
      name: 'New Order',
      items: [{ productId: 1, quantity: 2 }],
    };

    it('should create an order successfully', async () => {
      const mockResponse = { message: 'Order created successfully!', order: mockOrder };
      mockOrdersService.createOrder.mockResolvedValue(mockResponse);

      const result = await controller.createOrder(createOrderDto, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        createOrderDto,
        mockReq,
      );
      expect(mockOrdersService.createOrder).toHaveBeenCalledTimes(1);
    });

    it('should propagate BAD_REQUEST error for invalid user ID', async () => {
      const error = new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(controller.createOrder(createOrderDto, mockReq)).rejects.toThrow(
        'Invalid user ID',
      );
    });
  });

  describe('updateOrder', () => {
    const updateOrderDto: UpdateOrderDto = {
      name: 'Updated Order',
      status: 'COMPLETED',
      totalAmount: 300,
    };

    it('should update an order successfully', async () => {
      const mockResponse = { message: 'Order updated successfully!' };
      mockOrdersService.updateOrder.mockResolvedValue(mockResponse);

      const result = await controller.updateOrder(1, updateOrderDto, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        updateOrderDto,
        mockReq,
      );
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order successfully', async () => {
      const mockResponse = { message: 'Order deleted successfully' };
      mockOrdersService.deleteOrder.mockResolvedValue(mockResponse);

      const result = await controller.deleteOrder(1, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.deleteOrder).toHaveBeenCalledWith(1, mockReq);
    });

    it('should propagate database errors', async () => {
      mockOrdersService.deleteOrder.mockRejectedValue(
        new HttpException(
          'An error occurred while deleting the order',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(controller.deleteOrder(1, mockReq)).rejects.toThrow(
        'An error occurred while deleting the order',
      );
    });
  });
});