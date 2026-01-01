import {
  Body,
  Controller,
  Header,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { Public } from 'utils/publicDecorator';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt.auth.guard';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @UseGuards(JwtAuthGuard)
  @Post('finalize')
  async finalizeCheckout(
    @Body()
    body: {
      orderId: number;
    },
    @Req() req: Request,
  ) {
    const userId = (req as any)?.user?.userId as number | undefined;
    return this.checkoutService.finalizeCheckout(body.orderId, userId);
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
