import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { OrdersService } from '../orders/orders.service';
import { UserService } from '../user/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ProductItemDto } from './dtos/ProductDto';

jest.mock('../../lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  },
}));
import { stripe } from '../../lib/stripe';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let ordersService: OrdersService;
  let userService: UserService;

  const mockOrdersService = {
    updateOrder: jest.fn(),
  };

  const mockUserService = {
    getUserById: jest.fn(),
  };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    preferredCurrency: 'USD',
  };

  const mockProducts: ProductItemDto[] = [
    {
      name: 'Test Product 1',
      price: 100,
      quantity: 2,
    },
    {
      name: 'Test Product 2',
      price: 50,
      quantity: 1,
    },
  ];

  const mockStripeSession = {
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/test',
    payment_status: 'unpaid',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
    ordersService = module.get<OrdersService>(OrdersService);
    userService = module.get<UserService>(UserService);


    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('finalizeCheckout', () => {
    const orderId = 1;
    const userId = 1;

    beforeEach(() => {
      mockUserService.getUserById.mockResolvedValue(mockUser);
      (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue(
        mockStripeSession,
      );
    });

    it('should create a checkout session successfully', async () => {
      const result = await service.finalizeCheckout(
        mockProducts,
        orderId,
        userId,
      );

      expect(result).toEqual({ url: mockStripeSession.url });
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('should create session with correct line items', async () => {
      await service.finalizeCheckout(mockProducts, orderId, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: 'Test Product 1' },
                unit_amount: 10000, 
              },
              quantity: 2,
            },
            {
              price_data: {
                currency: 'usd',
                product_data: { name: 'Test Product 2' },
                unit_amount: 5000, 
              },
              quantity: 1,
            },
          ],
        }),
      );
    });

    it('should create session with correct URLs', async () => {
      await service.finalizeCheckout(mockProducts, orderId, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: `http://localhost:3000/success?orderId=${orderId}`,
          cancel_url: 'http://localhost:3000/cart',
        }),
      );
    });

    it('should include orderId in session metadata', async () => {
      await service.finalizeCheckout(mockProducts, orderId, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            orderId: orderId.toString(),
          },
        }),
      );
    });

    it('should set payment mode and method types correctly', async () => {
      await service.finalizeCheckout(mockProducts, orderId, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
          mode: 'payment',
        }),
      );
    });

    it('should use user preferred currency in lowercase', async () => {
      const userWithEuro = { ...mockUser, preferredCurrency: 'EUR' };
      mockUserService.getUserById.mockResolvedValue(userWithEuro);

      await service.finalizeCheckout(mockProducts, orderId, userId);

      const createCall = (stripe.checkout.sessions.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.line_items[0].price_data.currency).toBe('eur');
    });

    it('should convert price to cents correctly', async () => {
      const singleProduct: ProductItemDto[] = [
        { name: 'Product', price: 99.99, quantity: 1 },
      ];

      await service.finalizeCheckout(singleProduct, orderId, userId);

      const createCall = (stripe.checkout.sessions.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.line_items[0].price_data.unit_amount).toBe(9999);
    });

    it('should throw BAD_REQUEST when products array is empty', async () => {
      await expect(
        service.finalizeCheckout([], orderId, userId),
      ).rejects.toThrow(
        new HttpException(
          'Missing or invalid dependencies. Expect a non-empty products array and valid orderId and userId.',
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(mockUserService.getUserById).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when products is not an array', async () => {
      await expect(
        service.finalizeCheckout(null as any, orderId, userId),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(undefined as any, orderId, userId),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout({} as any, orderId, userId),
      ).rejects.toThrow(HttpException);
    });

    it('should throw BAD_REQUEST when orderId is missing', async () => {
      await expect(
        service.finalizeCheckout(mockProducts, null, userId),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(mockProducts, undefined, userId),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(mockProducts, 0, userId),
      ).rejects.toThrow(HttpException);
    });

    it('should throw BAD_REQUEST when userId is missing', async () => {
      await expect(
        service.finalizeCheckout(mockProducts, orderId, null),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(mockProducts, orderId, undefined),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(mockProducts, orderId, 0),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error when user is not found', async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      await expect(
        service.finalizeCheckout(mockProducts, orderId, userId),
      ).rejects.toThrow('User not found');

      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should propagate UserService errors', async () => {
      const error = new HttpException('Database error', HttpStatus.INTERNAL_SERVER_ERROR);
      mockUserService.getUserById.mockRejectedValue(error);

      await expect(
        service.finalizeCheckout(mockProducts, orderId, userId),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate Stripe API errors', async () => {
      const stripeError = new Error('Stripe API error');
      (stripe.checkout.sessions.create as jest.Mock).mockRejectedValue(
        stripeError,
      );

      await expect(
        service.finalizeCheckout(mockProducts, orderId, userId),
      ).rejects.toThrow('Stripe API error');
    });

    it('should handle single product checkout', async () => {
      const singleProduct: ProductItemDto[] = [
        { name: 'Single Product', price: 25.50, quantity: 1 },
      ];

      const result = await service.finalizeCheckout(
        singleProduct,
        orderId,
        userId,
      );

      expect(result).toEqual({ url: mockStripeSession.url });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: 'Single Product' },
                unit_amount: 2550,
              },
              quantity: 1,
            },
          ],
        }),
      );
    });

    it('should handle multiple quantities of same product', async () => {
      const productWithMultipleQty: ProductItemDto[] = [
        { name: 'Bulk Product', price: 10, quantity: 100 },
      ];

      await service.finalizeCheckout(productWithMultipleQty, orderId, userId);

      const createCall = (stripe.checkout.sessions.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.line_items[0].quantity).toBe(100);
    });

    it('should use different orderIds correctly', async () => {
      await service.finalizeCheckout(mockProducts, 999, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/success?orderId=999',
          metadata: { orderId: '999' },
        }),
      );
    });
  });

  describe('handleWebhookEvent', () => {
    const mockSignature = 'test_signature';
    const mockPayload = Buffer.from(JSON.stringify({ type: 'test' }));

    beforeEach(() => {
      mockOrdersService.updateOrder.mockResolvedValue({
        msg: 'Order updated successfully!',
        statusCode: 200,
      });
    });

    it('should verify webhook signature', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId: '1' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    });

    it('should update order status to COMPLETED on checkout.session.completed', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId: '42' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(42, {
        status: 'COMPLETED',
      });
    });

    it('should not update order when orderId is missing from metadata', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {},
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
      expect(mockOrdersService.updateOrder).not.toHaveBeenCalled();
    });

    it('should not update order when metadata is missing', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {},
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
      expect(mockOrdersService.updateOrder).not.toHaveBeenCalled();
    });

    it('should ignore non-checkout.session.completed events', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            metadata: { orderId: '1' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
      expect(mockOrdersService.updateOrder).not.toHaveBeenCalled();
    });

    it('should handle multiple different event types', async () => {
      const eventTypes = [
        'payment_intent.created',
        'charge.succeeded',
        'customer.created',
      ];

      for (const eventType of eventTypes) {
        const mockEvent = {
          type: eventType,
          data: { object: {} },
        };
        (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

        const result = await service.handleWebhookEvent(mockSignature, mockPayload);

        expect(result).toEqual({ received: true });
      }

      expect(mockOrdersService.updateOrder).not.toHaveBeenCalled();
    });

    it('should throw error on invalid signature', async () => {
      const signatureError = new Error('Invalid signature');
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw signatureError;
      });

      await expect(
        service.handleWebhookEvent('invalid_signature', mockPayload),
      ).rejects.toThrow('Invalid signature');

      expect(mockOrdersService.updateOrder).not.toHaveBeenCalled();
    });

    it('should log error message when webhook fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Webhook processing failed');
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(
        service.handleWebhookEvent(mockSignature, mockPayload),
      ).rejects.toThrow('Webhook processing failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Webhook Error: Webhook processing failed',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should propagate OrdersService errors', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId: '1' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const updateError = new HttpException(
        'Order not found',
        HttpStatus.NOT_FOUND,
      );
      mockOrdersService.updateOrder.mockRejectedValue(updateError);

      await expect(
        service.handleWebhookEvent(mockSignature, mockPayload),
      ).rejects.toThrow(HttpException);
    });

    it('should parse orderId as integer correctly', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId: '12345' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(12345, {
        status: 'COMPLETED',
      });
    });

    it('should return received: true for all successfully processed events', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId: '1' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
    });
  });
});