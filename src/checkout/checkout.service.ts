import { Injectable, Redirect } from '@nestjs/common';
import { stripe } from 'lib/stripe';
import { ProductItemDto } from './dtos/ProductDto';
import { OrdersService } from 'src/orders/orders.service';

@Injectable()
export class CheckoutService {
  constructor(private readonly ordersService: OrdersService) {}
  async finalizeCheckout(products: ProductItemDto[], orderId: number) {
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
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?orderId=${orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
      metadata: {
        orderId: orderId.toString(),
      },
    });

    return { url: session.url };
  }

  async handleWebhookEvent(signature: string, payload: Buffer) {
    try {
      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );

      // Handle checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          // Update the order status to COMPLETED
          await this.ordersService.updateOrder(parseInt(orderId), {
            status: 'COMPLETED',
          });
        }
      }

      return { received: true };
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      throw err;
    }
  }
}
