import { Injectable, Redirect } from '@nestjs/common';
import { stripe } from 'lib/stripe';
import { ProductItemDto } from './dtos/ProductDto';

@Injectable()
export class CheckoutService {
  async finalizeCheckout(products: ProductItemDto[]) {
    const line_items = products.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
    });

    return { url: session.url };
  }
}
