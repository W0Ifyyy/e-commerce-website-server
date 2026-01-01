import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { OrdersService } from '../orders/orders.service';
import { UserService } from '../user/user.service';
import { HttpException, HttpStatus } from '@nestjs/common';

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
    getOrderForCheckout: jest.fn(),
    completeOrderFromWebhook: jest.fn(),
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

  const mockOrder = {
    id: 1,
    status: 'PENDING',
    user: { id: 1 },
    items: [
      { quantity: 2, product: { name: 'Test Product 1', price: 100 } },
      { quantity: 1, product: { name: 'Test Product 2', price: 50 } },
    ],
    totalAmount: 250,
  };

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
      mockOrdersService.getOrderForCheckout.mockResolvedValue(mockOrder);
      (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue(
        mockStripeSession,
      );
    });

    it('should create a checkout session successfully', async () => {
      const result = await service.finalizeCheckout(orderId, userId);

      expect(result).toEqual({ url: mockStripeSession.url });
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockOrdersService.getOrderForCheckout).toHaveBeenCalledWith(orderId);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('should create session with correct line items', async () => {
      await service.finalizeCheckout(orderId, userId);

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
      await service.finalizeCheckout(orderId, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: `http://localhost:3000/success?orderId=${orderId}`,
          cancel_url: 'http://localhost:3000/cart',
        }),
      );
    });

    it('should include orderId in session metadata', async () => {
      await service.finalizeCheckout(orderId, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            orderId: orderId.toString(),
            userId: userId.toString(),
            expectedTotalCents: '25000',
            currency: 'usd',
          }),
        }),
      );
    });

    it('should set payment mode and method types correctly', async () => {
      await service.finalizeCheckout(orderId, userId);

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

      await service.finalizeCheckout(orderId, userId);

      const createCall = (stripe.checkout.sessions.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.line_items[0].price_data.currency).toBe('eur');
    });

    it('should throw BAD_REQUEST when orderId is missing', async () => {
      await expect(
        service.finalizeCheckout(null as any, userId),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(undefined as any, userId),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(0 as any, userId),
      ).rejects.toThrow(HttpException);
    });

    it('should throw BAD_REQUEST when userId is missing', async () => {
      await expect(
        service.finalizeCheckout(orderId, null as any),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(orderId, undefined as any),
      ).rejects.toThrow(HttpException);

      await expect(
        service.finalizeCheckout(orderId, 0 as any),
      ).rejects.toThrow(HttpException);
    });

    it('should throw NOT_FOUND when user is not found', async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      await expect(
        service.finalizeCheckout(orderId, userId),
      ).rejects.toThrow(HttpException);

      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when order does not belong to user', async () => {
      mockOrdersService.getOrderForCheckout.mockResolvedValue({
        ...mockOrder,
        user: { id: 999 },
      });

      await expect(service.finalizeCheckout(orderId, userId)).rejects.toThrow(
        new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      );
    });

    it('should throw CONFLICT when order is not payable', async () => {
      mockOrdersService.getOrderForCheckout.mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      await expect(service.finalizeCheckout(orderId, userId)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw BAD_REQUEST when order has no items', async () => {
      mockOrdersService.getOrderForCheckout.mockResolvedValue({
        ...mockOrder,
        items: [],
      });

      await expect(service.finalizeCheckout(orderId, userId)).rejects.toThrow(
        HttpException,
      );
    });

    it('should propagate UserService errors', async () => {
      const error = new HttpException('Database error', HttpStatus.INTERNAL_SERVER_ERROR);
      mockUserService.getUserById.mockRejectedValue(error);

      await expect(
        service.finalizeCheckout(orderId, userId),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate Stripe API errors', async () => {
      const stripeError = new Error('Stripe API error');
      (stripe.checkout.sessions.create as jest.Mock).mockRejectedValue(
        stripeError,
      );

      await expect(
        service.finalizeCheckout(orderId, userId),
      ).rejects.toThrow('Stripe API error');
    });

    it('should use different orderIds correctly', async () => {
      mockOrdersService.getOrderForCheckout.mockResolvedValue({
        ...mockOrder,
        id: 999,
      });

      await service.finalizeCheckout(999, userId);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/success?orderId=999',
          metadata: expect.objectContaining({ orderId: '999' }),
        }),
      );
    });
  });

  describe('handleWebhookEvent', () => {
    const mockSignature = 'test_signature';
    const mockPayload = Buffer.from(JSON.stringify({ type: 'test' }));

    beforeEach(() => {
      mockOrdersService.completeOrderFromWebhook.mockResolvedValue({ received: true });
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
            payment_status: 'paid',
            amount_total: 25000,
            metadata: { orderId: '42', expectedTotalCents: '25000' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
      expect(mockOrdersService.completeOrderFromWebhook).toHaveBeenCalledWith(42, 25000);
    });

    it('should not update order when orderId is missing from metadata', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            payment_status: 'paid',
            metadata: {},
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const result = await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(result).toEqual({ received: true });
      expect(mockOrdersService.completeOrderFromWebhook).not.toHaveBeenCalled();
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
      expect(mockOrdersService.completeOrderFromWebhook).not.toHaveBeenCalled();
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
      expect(mockOrdersService.completeOrderFromWebhook).not.toHaveBeenCalled();
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

      expect(mockOrdersService.completeOrderFromWebhook).not.toHaveBeenCalled();
    });

    it('should throw error on invalid signature', async () => {
      const signatureError = new Error('Invalid signature');
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw signatureError;
      });

      await expect(
        service.handleWebhookEvent('invalid_signature', mockPayload),
      ).rejects.toThrow('Invalid signature');

      expect(mockOrdersService.completeOrderFromWebhook).not.toHaveBeenCalled();
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
            payment_status: 'paid',
            amount_total: 25000,
            metadata: { orderId: '1', expectedTotalCents: '25000' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      const updateError = new HttpException(
        'Order not found',
        HttpStatus.NOT_FOUND,
      );
      mockOrdersService.completeOrderFromWebhook.mockRejectedValue(updateError);

      await expect(
        service.handleWebhookEvent(mockSignature, mockPayload),
      ).rejects.toThrow(HttpException);
    });

    it('should parse orderId as integer correctly', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            payment_status: 'paid',
            amount_total: 25000,
            metadata: { orderId: '12345', expectedTotalCents: '25000' },
          },
        },
      };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.handleWebhookEvent(mockSignature, mockPayload);

      expect(mockOrdersService.completeOrderFromWebhook).toHaveBeenCalledWith(12345, 25000);
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