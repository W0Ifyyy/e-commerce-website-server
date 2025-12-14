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
  let service: OrdersService;

  const mockOrdersService = {
    getAllOrders: jest.fn(),
    getOrderById: jest.fn(),
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
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
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
        msg: 'Orders retrieved successfully',
        orders: [mockOrder],
      };
      mockOrdersService.getAllOrders.mockResolvedValue(mockResponse);
      (canAccess as jest.Mock).mockReturnValue(true);

      const result = await controller.getOrders(mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.getAllOrders).toHaveBeenCalledTimes(1);
      expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith();
    });

    it('should return empty orders array', async () => {
      const mockResponse = {
        msg: 'Orders retrieved successfully',
        orders: [],
      };
      mockOrdersService.getAllOrders.mockResolvedValue(mockResponse);
      (canAccess as jest.Mock).mockReturnValue(true);

      const result = await controller.getOrders(mockReq);

      expect(result).toEqual(mockResponse);
      expect(result.orders).toHaveLength(0);
    });

    it('should propagate service errors', async () => {
      const error = new HttpException(
        'Database error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.getAllOrders.mockRejectedValue(error);
      (canAccess as jest.Mock).mockReturnValue(true);

      await expect(controller.getOrders(mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.getOrders(mockReq)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle unexpected errors', async () => {
      mockOrdersService.getAllOrders.mockRejectedValue(
        new Error('Unexpected error'),
      );
      (canAccess as jest.Mock).mockReturnValue(true);

      await expect(controller.getOrders(mockReq)).rejects.toThrow(
        'Unexpected error',
      );
    });

    it('should throw Unauthorized when canAccess returns false', () => {
      (canAccess as jest.Mock).mockReturnValue(false);

      expect(() => controller.getOrders(mockReq)).toThrow(HttpException);
      expect(() => controller.getOrders(mockReq)).toThrow('Unauthorized');
    });
  });

  describe('getOrderById', () => {
    it('should return an order by id', async () => {
      const mockResponse = {
        statusCode: 200,
        msg: 'Order retrieved successfully',
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
        statusCode: 200,
        msg: 'Order retrieved successfully',
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
        'An error occurred while getting order by id: Order with that id does not exist!',
        HttpStatus.INTERNAL_SERVER_ERROR,
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

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      userId: 1,
      name: 'New Order',
      items: [{ productId: 1, quantity: 2 }],
      totalAmount: 200,
      status: 'PENDING',
    };

    it('should create an order successfully', async () => {
      const mockResponse = {
        msg: 'Order created successfully!',
        order: mockOrder,
      };
      mockOrdersService.createOrder.mockResolvedValue(mockResponse);

      const result = await controller.createOrder(createOrderDto, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        createOrderDto,
        mockReq,
      );
      expect(mockOrdersService.createOrder).toHaveBeenCalledTimes(1);
    });

    it('should pass DTO to service correctly', async () => {
      mockOrdersService.createOrder.mockResolvedValue({
        msg: 'Order created successfully!',
        order: mockOrder,
      });

      await controller.createOrder(createOrderDto, mockReq);

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        createOrderDto,
        mockReq,
      );
    });

    it('should create order with multiple items', async () => {
      const dtoWithMultipleItems: CreateOrderDto = {
        ...createOrderDto,
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
        totalAmount: 300,
      };
      mockOrdersService.createOrder.mockResolvedValue({
        msg: 'Order created successfully!',
        order: mockOrder,
      });

      await controller.createOrder(dtoWithMultipleItems, mockReq);

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        dtoWithMultipleItems,
        mockReq,
      );
    });

    it('should create order without items', async () => {
      const dtoWithoutItems: CreateOrderDto = {
        userId: 1,
        name: 'Empty Order',
        items: [],
        totalAmount: 0,
      };
      mockOrdersService.createOrder.mockResolvedValue({
        msg: 'Order created successfully!',
        order: { ...mockOrder, items: [] },
      });

      await controller.createOrder(dtoWithoutItems, mockReq);

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        dtoWithoutItems,
        mockReq,
      );
    });

    it('should propagate BAD_REQUEST error for invalid user ID', async () => {
      const error = new HttpException(
        'Invalid user ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(
        controller.createOrder(createOrderDto, mockReq),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.createOrder(createOrderDto, mockReq),
      ).rejects.toThrow(
        'Invalid user ID',
      );
    });

    it('should propagate NOT_FOUND error when user does not exist', async () => {
      const error = new HttpException(
        'An error occurred while creating the order: User with ID 1 not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(
        controller.createOrder(createOrderDto, mockReq),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.createOrder(createOrderDto, mockReq),
      ).rejects.toThrow(
        'User with ID 1 not found',
      );
    });

    it('should propagate NOT_FOUND error when products are not found', async () => {
      const error = new HttpException(
        'An error occurred while creating the order: One or more products not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(
        controller.createOrder(createOrderDto, mockReq),
      ).rejects.toThrow('One or more products not found');
    });

    it('should propagate database save errors', async () => {
      const error = new HttpException(
        'An error occurred while creating the order: Database save failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(
        controller.createOrder(createOrderDto, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('updateOrder', () => {
    const updateOrderDto: UpdateOrderDto = {
      name: 'Updated Order',
      status: 'COMPLETED',
      totalAmount: 300,
    };

    it('should update an order successfully', async () => {
      const mockResponse = {
        msg: 'Order updated successfully!',
        statusCode: 200,
      };
      mockOrdersService.updateOrder.mockResolvedValue(mockResponse);

      const result = await controller.updateOrder(1, updateOrderDto, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        updateOrderDto,
        mockReq,
      );
      expect(mockOrdersService.updateOrder).toHaveBeenCalledTimes(1);
    });

    it('should pass id and DTO correctly to service', async () => {
      const orderId = 5;
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(orderId, updateOrderDto, mockReq);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        orderId,
        updateOrderDto,
        mockReq,
      );
    });

    it('should handle partial updates - name only', async () => {
      const partialDto: UpdateOrderDto = { name: 'New Name' };
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, partialDto, mockReq);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        partialDto,
        mockReq,
      );
    });

    it('should handle partial updates - status only', async () => {
      const partialDto: UpdateOrderDto = { status: 'CANCELED' };
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, partialDto, mockReq);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        partialDto,
        mockReq,
      );
    });

    it('should handle partial updates - totalAmount only', async () => {
      const partialDto: UpdateOrderDto = { totalAmount: 500 };
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, partialDto, mockReq);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        partialDto,
        mockReq,
      );
    });

    it('should handle empty update DTO', async () => {
      const emptyDto: UpdateOrderDto = {};
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, emptyDto, mockReq);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        emptyDto,
        mockReq,
      );
    });

    it('should propagate BAD_REQUEST error for invalid order ID', async () => {
      const error = new HttpException(
        'Invalid Order ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(
        controller.updateOrder(0, updateOrderDto, mockReq),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.updateOrder(0, updateOrderDto, mockReq),
      ).rejects.toThrow(
        'Invalid Order ID',
      );
    });

    it('should propagate NOT_FOUND error when order does not exist', async () => {
      const error = new HttpException(
        'An error occurred while updating the order... Error: Order with this ID does not exist!',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(
        controller.updateOrder(999, updateOrderDto, mockReq),
      ).rejects.toThrow('Order with this ID does not exist');
    });

    it('should propagate NOT_FOUND error when new user does not exist', async () => {
      const dtoWithUserId: UpdateOrderDto = { ...updateOrderDto, userId: 999 };
      const error = new HttpException(
        'An error occurred while updating the order... Error: User with ID 999 not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(
        controller.updateOrder(1, dtoWithUserId, mockReq),
      ).rejects.toThrow('User with ID 999 not found');
    });

    it('should propagate database errors', async () => {
      const error = new HttpException(
        'An error occurred while updating the order... Error: Database update failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(
        controller.updateOrder(1, updateOrderDto, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order successfully', async () => {
      const mockResponse = {
        msg: 'Order deleted successfully',
        statusCode: 200,
      };
      mockOrdersService.deleteOrder.mockResolvedValue(mockResponse);

      const result = await controller.deleteOrder(1, mockReq);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.deleteOrder).toHaveBeenCalledWith(1, mockReq);
      expect(mockOrdersService.deleteOrder).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      const orderId = 99;
      mockOrdersService.deleteOrder.mockResolvedValue({
        msg: 'Order deleted successfully',
        statusCode: 200,
      });

      await controller.deleteOrder(orderId, mockReq);

      expect(mockOrdersService.deleteOrder).toHaveBeenCalledWith(
        orderId,
        mockReq,
      );
    });

    it('should propagate BAD_REQUEST error for invalid order ID', async () => {
      const error = new HttpException(
        'Invalid Order ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.deleteOrder.mockRejectedValue(error);

      await expect(controller.deleteOrder(0, mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.deleteOrder(0, mockReq)).rejects.toThrow(
        'Invalid Order ID',
      );
    });

    it('should propagate NOT_FOUND error when order does not exist', async () => {
      const error = new HttpException(
        "An error occured while deleting the order... Error: The order you're trying to delete does not exist!",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.deleteOrder.mockRejectedValue(error);

      await expect(controller.deleteOrder(999, mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.deleteOrder(999, mockReq)).rejects.toThrow(
        "The order you're trying to delete does not exist",
      );
    });

    it('should propagate database errors', async () => {
      const error = new HttpException(
        'An error occured while deleting the order... Error: Database deletion failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.deleteOrder.mockRejectedValue(error);

      await expect(controller.deleteOrder(1, mockReq)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.deleteOrder(1, mockReq)).rejects.toThrow(
        'Database deletion failed',
      );
    });

    it('should handle unexpected errors', async () => {
      mockOrdersService.deleteOrder.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(controller.deleteOrder(1, mockReq)).rejects.toThrow(
        'Unexpected error',
      );
    });
  });
});