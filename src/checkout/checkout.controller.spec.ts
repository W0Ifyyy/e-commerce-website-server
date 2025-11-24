// Add the mock BEFORE importing controller/service so Stripe constructor never runs
jest.mock('../../lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  },
}));

// Provide a dummy secret to satisfy any code paths that read it (defensive)
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ProductItemDto } from './dtos/ProductDto';
import { Request } from 'express';

describe('CheckoutController', () => {
  let controller: CheckoutController;

  const mockCheckoutService = {
    finalizeCheckout: jest.fn(),
    handleWebhookEvent: jest.fn(),
  };

  const mockProducts: ProductItemDto[] = [
    { name: 'Test Product 1', price: 100, quantity: 2 },
    { name: 'Test Product 2', price: 50, quantity: 1 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        {
          provide: CheckoutService,
          useValue: mockCheckoutService,
        },
      ],
    }).compile();

    controller = module.get<CheckoutController>(CheckoutController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('finalizeCheckout', () => {
    const mockBody = {
      orderId: 1,
      userId: 1,
      products: mockProducts,
    };

    it('should finalize checkout successfully', async () => {
      const mockResponse = { url: 'https://checkout.stripe.com/test' };
      mockCheckoutService.finalizeCheckout.mockResolvedValue(mockResponse);

      const result = await controller.finalizeCheckout(mockBody);

      expect(result).toEqual(mockResponse);
      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(
        mockBody.products,
        mockBody.orderId,
        mockBody.userId,
      );
      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledTimes(1);
    });

    it('should pass products, orderId, and userId to service in correct order', async () => {
      mockCheckoutService.finalizeCheckout.mockResolvedValue({
        url: 'https://test.com',
      });

      await controller.finalizeCheckout(mockBody);

      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(
        mockBody.products,
        mockBody.orderId,
        mockBody.userId,
      );
    });

    it('should handle single product checkout', async () => {
      const singleProductBody = {
        orderId: 2,
        userId: 1,
        products: [{ name: 'Single Product', price: 25.5, quantity: 1 }],
      };
      mockCheckoutService.finalizeCheckout.mockResolvedValue({
        url: 'https://checkout.stripe.com/single',
      });

      const result = await controller.finalizeCheckout(singleProductBody);

      expect(result.url).toBeDefined();
      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(
        singleProductBody.products,
        singleProductBody.orderId,
        singleProductBody.userId,
      );
    });

    it('should handle multiple products checkout', async () => {
      const multipleProductsBody = {
        orderId: 3,
        userId: 2,
        products: [
          { name: 'Product A', price: 10, quantity: 5 },
          { name: 'Product B', price: 20, quantity: 3 },
          { name: 'Product C', price: 15, quantity: 2 },
        ],
      };
      mockCheckoutService.finalizeCheckout.mockResolvedValue({
        url: 'https://checkout.stripe.com/multi',
      });

      await controller.finalizeCheckout(multipleProductsBody);

      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(
        multipleProductsBody.products,
        multipleProductsBody.orderId,
        multipleProductsBody.userId,
      );
    });

    it('should handle different orderIds', async () => {
      const customBody = { ...mockBody, orderId: 999 };
      mockCheckoutService.finalizeCheckout.mockResolvedValue({
        url: 'https://test.com',
      });

      await controller.finalizeCheckout(customBody);

      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(
        customBody.products,
        999,
        customBody.userId,
      );
    });

    it('should handle different userIds', async () => {
      const customBody = { ...mockBody, userId: 42 };
      mockCheckoutService.finalizeCheckout.mockResolvedValue({
        url: 'https://test.com',
      });

      await controller.finalizeCheckout(customBody);

      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(
        customBody.products,
        customBody.orderId,
        42,
      );
    });

    it('should propagate BAD_REQUEST error from service', async () => {
      const error = new HttpException(
        'Missing or invalid dependencies',
        HttpStatus.BAD_REQUEST,
      );
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(controller.finalizeCheckout(mockBody)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.finalizeCheckout(mockBody)).rejects.toThrow(
        'Missing or invalid dependencies',
      );
    });

    it('should propagate error when products array is empty', async () => {
      const emptyProductsBody = {
        orderId: 1,
        userId: 1,
        products: [],
      };
      const error = new HttpException(
        'Missing or invalid dependencies. Expect a non-empty products array and valid orderId and userId.',
        HttpStatus.BAD_REQUEST,
      );
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(
        controller.finalizeCheckout(emptyProductsBody),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate error when orderId is invalid', async () => {
      const invalidOrderBody = { ...mockBody, orderId: 0 };
      const error = new HttpException(
        'Missing or invalid dependencies',
        HttpStatus.BAD_REQUEST,
      );
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(
        controller.finalizeCheckout(invalidOrderBody),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate error when userId is invalid', async () => {
      const invalidUserBody = { ...mockBody, userId: 0 };
      const error = new HttpException(
        'Missing or invalid dependencies',
        HttpStatus.BAD_REQUEST,
      );
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(
        controller.finalizeCheckout(invalidUserBody),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate error when user is not found', async () => {
      const error = new Error('User not found');
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(controller.finalizeCheckout(mockBody)).rejects.toThrow(
        'User not found',
      );
    });

    it('should propagate Stripe API errors', async () => {
      const stripeError = new Error('Stripe API error');
      mockCheckoutService.finalizeCheckout.mockRejectedValue(stripeError);

      await expect(controller.finalizeCheckout(mockBody)).rejects.toThrow(
        'Stripe API error',
      );
    });

    it('should propagate INTERNAL_SERVER_ERROR from service', async () => {
      const error = new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(controller.finalizeCheckout(mockBody)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('handleWebhook', () => {
    const mockSignature = 'whsec_test_signature';
    const mockRawBody = Buffer.from(JSON.stringify({ type: 'test' }));
    const mockRequest = {
      rawBody: mockRawBody,
    } as Request;

    it('should handle webhook successfully', async () => {
      const mockResponse = { received: true };
      mockCheckoutService.handleWebhookEvent.mockResolvedValue(mockResponse);

      const result = await controller.handleWebhook(mockSignature, mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockCheckoutService.handleWebhookEvent).toHaveBeenCalledWith(
        mockSignature,
        mockRawBody,
      );
      expect(mockCheckoutService.handleWebhookEvent).toHaveBeenCalledTimes(1);
    });

    it('should pass signature and rawBody to service', async () => {
      mockCheckoutService.handleWebhookEvent.mockResolvedValue({
        received: true,
      });

      await controller.handleWebhook(mockSignature, mockRequest);

      expect(mockCheckoutService.handleWebhookEvent).toHaveBeenCalledWith(
        mockSignature,
        mockRawBody,
      );
    });

    it('should handle different signature values', async () => {
      const differentSignature = 'whsec_different_signature';
      mockCheckoutService.handleWebhookEvent.mockResolvedValue({
        received: true,
      });

      await controller.handleWebhook(differentSignature, mockRequest);

      expect(mockCheckoutService.handleWebhookEvent).toHaveBeenCalledWith(
        differentSignature,
        mockRawBody,
      );
    });

    it('should handle different payload bodies', async () => {
      const differentPayload = Buffer.from(
        JSON.stringify({ type: 'checkout.session.completed' }),
      );
      const requestWithDifferentPayload = {
        rawBody: differentPayload,
      } as Request;
      mockCheckoutService.handleWebhookEvent.mockResolvedValue({
        received: true,
      });

      await controller.handleWebhook(
        mockSignature,
        requestWithDifferentPayload,
      );

      expect(mockCheckoutService.handleWebhookEvent).toHaveBeenCalledWith(
        mockSignature,
        differentPayload,
      );
    });

    it('should throw BAD_REQUEST on invalid signature', async () => {
      const error = new Error('Invalid signature');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(error);

      await expect(
        controller.handleWebhook('invalid_signature', mockRequest),
      ).rejects.toThrow(HttpException);

      await expect(
        controller.handleWebhook('invalid_signature', mockRequest),
      ).rejects.toThrow('Webhook Error: Invalid signature');

      await expect(
        controller.handleWebhook('invalid_signature', mockRequest),
      ).rejects.toMatchObject({
        message: 'Webhook Error: Invalid signature',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should wrap service errors as BAD_REQUEST', async () => {
      const serviceError = new Error('Webhook processing failed');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(serviceError);

      try {
        await controller.handleWebhook(mockSignature, mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.message).toBe('Webhook Error: Webhook processing failed');
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should handle signature verification errors', async () => {
      const verificationError = new Error('Signature verification failed');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(
        verificationError,
      );

      await expect(
        controller.handleWebhook(mockSignature, mockRequest),
      ).rejects.toThrow('Webhook Error: Signature verification failed');
    });

    it('should handle malformed payload errors', async () => {
      const malformedError = new Error('Malformed webhook payload');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(malformedError);

      await expect(
        controller.handleWebhook(mockSignature, mockRequest),
      ).rejects.toThrow('Webhook Error: Malformed webhook payload');
    });

    it('should handle missing signature header', async () => {
      const error = new Error('Missing signature');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(error);

      await expect(
        controller.handleWebhook(undefined, mockRequest),
      ).rejects.toThrow(HttpException);
    });

    it('should handle empty signature', async () => {
      const error = new Error('Empty signature');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(error);

      await expect(controller.handleWebhook('', mockRequest)).rejects.toThrow(
        'Webhook Error: Empty signature',
      );
    });

    it('should handle missing rawBody in request', async () => {
      const requestWithoutRawBody = {} as Request;
      const error = new Error('Missing raw body');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(error);

      await expect(
        controller.handleWebhook(mockSignature, requestWithoutRawBody),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate OrdersService errors wrapped as BAD_REQUEST', async () => {
      const ordersError = new HttpException(
        'Order not found',
        HttpStatus.NOT_FOUND,
      );
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(ordersError);

      try {
        await controller.handleWebhook(mockSignature, mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should handle webhook timeout errors', async () => {
      const timeoutError = new Error('Webhook processing timeout');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(timeoutError);

      await expect(
        controller.handleWebhook(mockSignature, mockRequest),
      ).rejects.toThrow('Webhook Error: Webhook processing timeout');
    });

    it('should preserve error message in wrapped exception', async () => {
      const originalError = new Error('Original error message');
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(originalError);

      try {
        await controller.handleWebhook(mockSignature, mockRequest);
      } catch (error) {
        expect(error.message).toContain('Original error message');
        expect(error.message).toContain('Webhook Error:');
      }
    });
  });
});