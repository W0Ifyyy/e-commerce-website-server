import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dtos/CreateOrderDto';
import { UpdateOrderDto } from './dtos/UpdateOrderDto';
import { HttpException, HttpStatus } from '@nestjs/common';

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

      const result = await controller.getOrders();

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
      await expect(controller.getOrders()).rejects.toThrow('Database error');
    });

    it('should handle unexpected errors', async () => {
      mockOrdersService.getAllOrders.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(controller.getOrders()).rejects.toThrow('Unexpected error');
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

      const result = await controller.getOrderById(1);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(1);
      expect(mockOrdersService.getOrderById).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      const orderId = 42;
      mockOrdersService.getOrderById.mockResolvedValue({
        statusCode: 200,
        msg: 'Order retrieved successfully',
        order: { ...mockOrder, id: orderId },
      });

      await controller.getOrderById(orderId);

      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(orderId);
    });

    it('should propagate BAD_REQUEST error for invalid id', async () => {
      const error = new HttpException(
        'Invalid order ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.getOrderById.mockRejectedValue(error);

      await expect(controller.getOrderById(0)).rejects.toThrow(HttpException);
      await expect(controller.getOrderById(0)).rejects.toThrow(
        'Invalid order ID',
      );
    });

    it('should propagate NOT_FOUND error when order does not exist', async () => {
      const error = new HttpException(
        'An error occurred while getting order by id: Order with that id does not exist!',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.getOrderById.mockRejectedValue(error);

      await expect(controller.getOrderById(999)).rejects.toThrow(HttpException);
      await expect(controller.getOrderById(999)).rejects.toThrow(
        'Order with that id does not exist',
      );
    });

    it('should propagate database errors', async () => {
      const error = new HttpException(
        'Database connection failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.getOrderById.mockRejectedValue(error);

      await expect(controller.getOrderById(1)).rejects.toThrow(HttpException);
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

      const result = await controller.createOrder(createOrderDto);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        createOrderDto,
      );
      expect(mockOrdersService.createOrder).toHaveBeenCalledTimes(1);
    });

    it('should pass DTO to service correctly', async () => {
      mockOrdersService.createOrder.mockResolvedValue({
        msg: 'Order created successfully!',
        order: mockOrder,
      });

      await controller.createOrder(createOrderDto);

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        createOrderDto,
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

      await controller.createOrder(dtoWithMultipleItems);

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        dtoWithMultipleItems,
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

      await controller.createOrder(dtoWithoutItems);

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(
        dtoWithoutItems,
      );
    });

    it('should propagate BAD_REQUEST error for invalid user ID', async () => {
      const error = new HttpException(
        'Invalid user ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(
        'Invalid user ID',
      );
    });

    it('should propagate NOT_FOUND error when user does not exist', async () => {
      const error = new HttpException(
        'An error occurred while creating the order: User with ID 1 not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(
        'User with ID 1 not found',
      );
    });

    it('should propagate NOT_FOUND error when products are not found', async () => {
      const error = new HttpException(
        'An error occurred while creating the order: One or more products not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(
        'One or more products not found',
      );
    });

    it('should propagate database save errors', async () => {
      const error = new HttpException(
        'An error occurred while creating the order: Database save failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.createOrder.mockRejectedValue(error);

      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(
        HttpException,
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
      const mockResponse = {
        msg: 'Order updated successfully!',
        statusCode: 200,
      };
      mockOrdersService.updateOrder.mockResolvedValue(mockResponse);

      const result = await controller.updateOrder(1, updateOrderDto);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        1,
        updateOrderDto,
      );
      expect(mockOrdersService.updateOrder).toHaveBeenCalledTimes(1);
    });

    it('should pass id and DTO correctly to service', async () => {
      const orderId = 5;
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(orderId, updateOrderDto);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        orderId,
        updateOrderDto,
      );
    });

    it('should handle partial updates - name only', async () => {
      const partialDto: UpdateOrderDto = { name: 'New Name' };
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, partialDto);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(1, partialDto);
    });

    it('should handle partial updates - status only', async () => {
      const partialDto: UpdateOrderDto = { status: 'CANCELED' };
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, partialDto);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(1, partialDto);
    });

    it('should handle partial updates - totalAmount only', async () => {
      const partialDto: UpdateOrderDto = { totalAmount: 500 };
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, partialDto);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(1, partialDto);
    });

    it('should handle empty update DTO', async () => {
      const emptyDto: UpdateOrderDto = {};
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });

      await controller.updateOrder(1, emptyDto);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(1, emptyDto);
    });

    it('should propagate BAD_REQUEST error for invalid order ID', async () => {
      const error = new HttpException(
        'Invalid Order ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(controller.updateOrder(0, updateOrderDto)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.updateOrder(0, updateOrderDto)).rejects.toThrow(
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
        controller.updateOrder(999, updateOrderDto),
      ).rejects.toThrow('Order with this ID does not exist');
    });

    it('should propagate NOT_FOUND error when new user does not exist', async () => {
      const dtoWithUserId: UpdateOrderDto = { ...updateOrderDto, userId: 999 };
      const error = new HttpException(
        'An error occurred while updating the order... Error: User with ID 999 not found',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(controller.updateOrder(1, dtoWithUserId)).rejects.toThrow(
        'User with ID 999 not found',
      );
    });

    it('should propagate database errors', async () => {
      const error = new HttpException(
        'An error occurred while updating the order... Error: Database update failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.updateOrder.mockRejectedValue(error);

      await expect(controller.updateOrder(1, updateOrderDto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order successfully', async () => {
      const mockResponse = {
        msg: 'Order deleted successfully',
        statusCode: 200,
      };
      mockOrdersService.deleteOrder.mockResolvedValue(mockResponse);

      const result = await controller.deleteOrder(1);

      expect(result).toEqual(mockResponse);
      expect(mockOrdersService.deleteOrder).toHaveBeenCalledWith(1);
      expect(mockOrdersService.deleteOrder).toHaveBeenCalledTimes(1);
    });

    it('should pass correct id to service', async () => {
      const orderId = 99;
      mockOrdersService.deleteOrder.mockResolvedValue({
        msg: 'Order deleted successfully',
        statusCode: 200,
      });

      await controller.deleteOrder(orderId);

      expect(mockOrdersService.deleteOrder).toHaveBeenCalledWith(orderId);
    });

    it('should propagate BAD_REQUEST error for invalid order ID', async () => {
      const error = new HttpException(
        'Invalid Order ID',
        HttpStatus.BAD_REQUEST,
      );
      mockOrdersService.deleteOrder.mockRejectedValue(error);

      await expect(controller.deleteOrder(0)).rejects.toThrow(HttpException);
      await expect(controller.deleteOrder(0)).rejects.toThrow(
        'Invalid Order ID',
      );
    });

    it('should propagate NOT_FOUND error when order does not exist', async () => {
      const error = new HttpException(
        "An error occured while deleting the order... Error: The order you're trying to delete does not exist!",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.deleteOrder.mockRejectedValue(error);

      await expect(controller.deleteOrder(999)).rejects.toThrow(HttpException);
      await expect(controller.deleteOrder(999)).rejects.toThrow(
        "The order you're trying to delete does not exist",
      );
    });

    it('should propagate database errors', async () => {
      const error = new HttpException(
        'An error occured while deleting the order... Error: Database deletion failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockOrdersService.deleteOrder.mockRejectedValue(error);

      await expect(controller.deleteOrder(1)).rejects.toThrow(HttpException);
      await expect(controller.deleteOrder(1)).rejects.toThrow(
        'Database deletion failed',
      );
    });

    it('should handle unexpected errors', async () => {
      mockOrdersService.deleteOrder.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(controller.deleteOrder(1)).rejects.toThrow(
        'Unexpected error',
      );
    });
  });
});