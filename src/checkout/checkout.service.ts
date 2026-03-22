import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { stripe } from '../../lib/stripe';
import { OrdersService } from 'src/orders/orders.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  async finalizeCheckout(orderId: number, userId: number | undefined) {
    if (!orderId || orderId <= 0 || !userId || userId <= 0) {
      throw new HttpException(
        'Missing or invalid dependencies. Expect a valid orderId and authenticated user.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const order = await this.ordersService.getOrderForCheckout(orderId);
    if (!order?.user?.id || order.user.id !== userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    if (order.status !== 'PENDING') {
      throw new HttpException('Order is not payable', HttpStatus.CONFLICT);
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new HttpException('Order has no items', HttpStatus.BAD_REQUEST);
    }

    const currency = (order.user.preferredCurrency ?? 'USD').toLowerCase();

    const line_items = order.items.map((item: any) => {
      const name = item?.product?.name ?? 'Item';
      // Use unitPrice (locked at order creation) — not current product price,
      // so price changes after order creation don't break the amount check.
      const unitPrice = Number(item?.unitPrice ?? 0);
      const quantity = Number(item?.quantity ?? 0);

      if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity) || quantity <= 0) {
        throw new HttpException('Invalid order item', HttpStatus.BAD_REQUEST);
      }

      const unit_amount = Math.round(unitPrice * 100);
      return {
        price_data: {
          currency,
          product_data: { name },
          unit_amount,
        },
        quantity,
      };
    });

    const expectedTotalCents = line_items.reduce((sum: number, li: any) => {
      return sum + Number(li.price_data.unit_amount) * Number(li.quantity);
    }, 0);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?orderId=${orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
      metadata: {
        orderId: orderId.toString(),
        userId: userId.toString(),
        expectedTotalCents: expectedTotalCents.toString(),
        currency,
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
        const session: any = event.data.object;
        const orderIdRaw = session?.metadata?.orderId;
        const expectedTotalCentsRaw = session?.metadata?.expectedTotalCents;

        const orderId = Number(orderIdRaw);
        const expectedTotalCents = expectedTotalCentsRaw
          ? Number(expectedTotalCentsRaw)
          : undefined;

        // Only complete when Stripe says it was paid
        if (session?.payment_status && session.payment_status !== 'paid') {
          return { received: true, ignored: true };
        }

        if (Number.isFinite(orderId) && orderId > 0) {
          // Best-effort amount check
          if (
            typeof expectedTotalCents === 'number' &&
            Number.isFinite(session?.amount_total) &&
            session.amount_total !== expectedTotalCents
          ) {
            throw new Error('Webhook amount mismatch');
          }

          return await this.ordersService.completeOrderFromWebhook(
            orderId,
            expectedTotalCents,
          );
        }
      }

      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook error: ${err.message}`);
      throw err;
    }
  }
}
