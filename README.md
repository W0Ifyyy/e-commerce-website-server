
# E-Commerce REST API

Backend REST API for an e-commerce application built with NestJS, TypeORM, MySQL and Stripe.

## Quick Start

```bash
cd server
npm install
cp .env.example .env   # create and fill variables
npm run start:dev
```

Health check: GET `/` returns "Hello World!" from [`AppController`](server/src/app.controller.ts) using [`AppService`](server/src/app.service.ts) inside [`AppModule`](server/src/app.module.ts).

## Features

- Auth (JWT access + hashed refresh tokens) via [`AuthModule`](server/src/auth/auth.module.ts)
- Users CRUD & preferences via [`UserService`](server/src/user/user.service.ts)
- Products & Categories with relations via [`ProductsService`](server/src/products/products.service.ts) and [`CategoryService`](server/src/category/category.service.ts)
- Orders with items & status tracking via [`OrdersService`](server/src/orders/orders.service.ts)
- Stripe checkout & webhook via [`CheckoutService`](server/src/checkout/checkout.service.ts)
- Public route decorator [`Public`](server/utils/publicDecorator.ts)
- Global validation pipe (whitelist + transform) set in [`main.ts`](server/src/main.ts)

## Tech Stack

NestJS 10, TypeORM (MySQL), Passport (local + JWT strategies), Stripe, class-validator, bcrypt.

## Environment Variables (.env)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_user
DB_PASSWORD=your_password
DB_NAME=ecommerce

PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

JWT_SECRET=your_jwt_secret_key

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Authentication Flow

1. Register (`POST /auth/register`) creates user (password hashed by [`hashPassword`](server/utils/creatingPassword.ts)).
2. Login (`POST /auth/login`) issues access + refresh (refresh hashed via [`hashToken`](server/utils/hashingTokens.ts) and stored by [`UserService.updateRefreshToken`](server/src/user/user.service.ts)).
3. Authenticated requests use cookie `access_token` extracted in [`JwtStrategy`](server/src/auth/jwt.strategy.ts).
4. Refresh (`POST /auth/refresh`) validates stored hashed token via [`compareTokens`](server/utils/hashingTokens.ts).
5. Logout removes refresh token (`UserService.removeRefreshToken`).

## API Overview

Authentication (`/auth`):
- POST /register
- POST /login
- POST /refresh
- POST /logout (protected)
- GET /profile (protected)

Users (`/user`):
- GET / (protected)
- GET /:id (protected)
- PUT /:id (protected)
- DELETE /:id (protected)
- PUT /changePassword/:id (protected)

Products (`/products`):
- GET /
- GET /search?name=term
- GET /:id
- POST /all (IDs array)
- POST / (protected)
- PUT /:id (protected)
- DELETE /:id (protected)

Categories (`/category`):
- GET /
- GET /details
- GET /details/:id
- GET /:id
- POST / (protected)
- PUT /:id (protected)
- DELETE /:id (protected)

Orders (`/orders`):
- GET /
- GET /:id
- POST /
- PUT /:id
- DELETE /:id
(all protected)

Checkout (`/checkout`):
- POST /finalize
- POST /webhook

## Data Models

- [`User`](server/src/typeorm/entities/User.ts)
- [`Product`](server/src/typeorm/entities/Product.ts)
- [`Category`](server/src/typeorm/entities/Category.ts)
- [`Order`](server/src/typeorm/entities/Order.ts)
- [`OrderItem`](server/src/typeorm/entities/OrderItem.ts)

Shared interfaces in [`Interfaces.ts`](server/utils/Interfaces.ts).

## Validation

DTOs (e.g. [`CreateProductDto`](server/src/products/dtos/CreateProductDto.ts), [`UpdateUserDto`](server/src/user/dtos/UpdateUserDto.ts), [`CreateOrderDto`](server/src/orders/dtos/CreateOrderDto.ts)) use class-validator. Transformation and whitelisting enabled in `main.ts`.

## Error Handling

Consistent `HttpException` usage with meaningful status codes:
400 invalid input, 401 unauthorized, 404 not found, 409 conflict, 500 server fault.

## Stripe Flow

1. Create order (`OrdersService.createOrder`).
2. Call `/checkout/finalize` passing products + orderId + userId.
3. Session created in [`CheckoutService.finalizeCheckout`](server/src/checkout/checkout.service.ts) using user currency.
4. Webhook `/checkout/webhook` verifies signature and sets order status to COMPLETED via [`OrdersService.updateOrder`](server/src/orders/orders.service.ts).

## Security

- Bcrypt hashing (`creatingPassword.ts`)
- Hashed refresh tokens (`hashingTokens.ts`)
- HTTP-only cookies
- CORS restricted origin
- Short-lived access tokens
- Webhook signature verification
- Global validation pipe

## Testing

Scripts:
```bash
npm run test         # unit
npm run test:cov     # coverage
npm run test:e2e     # e2e (see jest-e2e config)
```

Unit specs under `src/**/**/*.spec.ts` (e.g. comprehensive product tests in [`products.service.spec.ts`](server/src/products/products.service.spec.ts)). E2E spec in [`test/app.e2e-spec.ts`](server/test/app.e2e-spec.ts).

## Project Structure

```
server/
  src/
    auth/
    category/
    checkout/
    orders/
    products/
    user/
    typeorm/entities/
  utils/
  lib/
  test/
```

## Development

```bash
npm run format
npm run lint
```

## Future Improvements

- Add pagination & sorting on product list.
- Role-based authorization layer.
- Soft deletes / auditing.
- Docker & CI pipeline scripts.

