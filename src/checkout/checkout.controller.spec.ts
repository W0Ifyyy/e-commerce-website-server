jest.mock('../../lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

describe('CheckoutController', () => {
  let controller: CheckoutController;

  const mockCheckoutService = {
    finalizeCheckout: jest.fn(),
    handleWebhookEvent: jest.fn(),
  };

  const makeReq = (userId?: number) =>
    ({
      user: userId === undefined ? undefined : { userId },
    }) as any as Request;

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
    it('should call service with orderId and userId', async () => {
      const mockResponse = { url: 'https://checkout.stripe.com/test' };
      mockCheckoutService.finalizeCheckout.mockResolvedValue(mockResponse);

      const result = await controller.finalizeCheckout({ orderId: 123 }, makeReq(7));

      expect(result).toEqual(mockResponse);
      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(123, 7);
      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledTimes(1);
    });

    it('should pass undefined userId when req.user is missing', async () => {
      mockCheckoutService.finalizeCheckout.mockResolvedValue({ url: 'x' });

      await controller.finalizeCheckout({ orderId: 1 }, makeReq(undefined));

      expect(mockCheckoutService.finalizeCheckout).toHaveBeenCalledWith(1, undefined);
    });

    it('should propagate HttpException from service', async () => {
      const error = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      mockCheckoutService.finalizeCheckout.mockRejectedValue(error);

      await expect(
        controller.finalizeCheckout({ orderId: 1 }, makeReq(1)),
      ).rejects.toThrow(HttpException);
    });

    it('should propagate generic errors from service', async () => {
      mockCheckoutService.finalizeCheckout.mockRejectedValue(new Error('Stripe API error'));

      await expect(
        controller.finalizeCheckout({ orderId: 1 }, makeReq(1)),
      ).rejects.toThrow('Stripe API error');
    });
  });

  describe('handleWebhook', () => {
    it('should pass signature and rawBody to service', async () => {
      const mockResponse = { received: true };
      mockCheckoutService.handleWebhookEvent.mockResolvedValue(mockResponse);

      const signature = 'whsec_test_signature';
      const rawBody = Buffer.from(JSON.stringify({ type: 'test' }));
      const req = { rawBody } as any as Request;

      const result = await controller.handleWebhook(signature, req);

      expect(result).toEqual(mockResponse);
      expect(mockCheckoutService.handleWebhookEvent).toHaveBeenCalledWith(signature, rawBody);
    });

    it('should wrap service error as BAD_REQUEST with Webhook Error prefix', async () => {
      mockCheckoutService.handleWebhookEvent.mockRejectedValue(new Error('Invalid signature'));

      const signature = 'bad_sig';
      const rawBody = Buffer.from('x');
      const req = { rawBody } as any as Request;

      await expect(controller.handleWebhook(signature, req)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        message: 'Webhook Error: Invalid signature',
      });
    });
  });
});