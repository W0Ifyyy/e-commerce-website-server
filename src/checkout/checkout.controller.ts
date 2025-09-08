import {
  Body,
  Controller,
  Header,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { Public } from 'utils/publicDecorator';
import { ProductItemDto } from './dtos/ProductDto';
import { Request } from 'express';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Public()
  @Post('finalize')
  async finalizeCheckout(
    @Body() body: { orderId: number; products: ProductItemDto[] },
  ) {
    return this.checkoutService.finalizeCheckout(body.products, body.orderId);
  }

  @Post('/webhook')
  @Public()
  @Header('Content-Type', 'application/json')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: Request,
  ) {
    try {
      return await this.checkoutService.handleWebhookEvent(
        signature,
        request.rawBody,
      );
    } catch (err) {
      throw new HttpException(
        `Webhook Error: ${err.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
