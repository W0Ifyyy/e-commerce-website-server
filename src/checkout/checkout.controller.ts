import { Body, Controller, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { Public } from 'utils/publicDecorator';
import { ProductItemDto } from './dtos/ProductDto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Public()
  @Post('finalize')
  async finalizeCheckout(@Body() products: ProductItemDto[]) {
    return this.checkoutService.finalizeCheckout(products);
  }
}
