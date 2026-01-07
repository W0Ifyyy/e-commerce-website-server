
# E-Commerce Backend

My e-commerce REST API. Built with NestJS + MySQL + Stripe. This is the backend that powers the store - handles auth, products, orders, payments, etc.

## Getting Started

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and fill in your values (db credentials, stripe keys, etc). Then:

```bash
npm run start:dev
```

Hit `http://localhost:5000` - server should be running!

## What's in here

- **Auth** - JWT tokens stored in httpOnly cookies, refresh token rotation, 
- **Users** - basic CRUD, password reset via email, email verification
- **Products & Categories** - products can belong to categories, search, pagination
- **Orders** - create orders, track status, order items with quantities
- **Checkout** - Stripe integration with webhooks

## Tech

- NestJS 10
- TypeORM + MySQL
- Passport (JWT + local strategies)  
- Stripe for payments
- class-validator for DTOs
- bcrypt for password hashing

## Environment Variables

Here's what you need in your `.env`:

Stripe api key from here: https://dashboard.stripe.com/apikeys
Mailtrap api keys: https://mailtrap.io

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_NAME=ecommerce

PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

JWT_SECRET=strong_string_value
CSRF_SECRET=another_strong_string_value

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# for email stuff (using mailtrap for testing)
MAILTRAP_TOKEN=your_token
MAILTRAP_TEST_INBOX_ID=12345
```

**Important:** In production, JWT_SECRET and CSRF_SECRET need to be at least 32 characters. The app will yell at you on startup if they're not.

## How Auth Works

1. User registers at `POST /auth/register` - password gets hashed with bcrypt
2. Login at `POST /auth/login` - returns access token (15min) + refresh token (7 days), both as cookies
3. Access token is in a httpOnly cookie, gets extracted automatically by the JWT strategy
4. When access token expires, hit `POST /auth/refresh` to get new tokens (old refresh token gets invalidated)
5. Logout clears everything

There's also CSRF protection on all POST/PUT/DELETE requests when you're logged in. Frontend needs to send the `X-CSRF-Token` header.

## API Endpoints

### Auth (`/auth`)
| Method | Endpoint | Auth? | What it does |
|--------|----------|-------|--------------|
| POST | /register | No | Create account |
| POST | /login | No | Get tokens |
| POST | /refresh | No | Refresh tokens |
| POST | /logout | Yes | Clear session |
| GET | /profile | Yes | Get current user |

### Users (`/user`)
| Method | Endpoint | Auth? | Notes |
|--------|----------|-------|-------|
| GET | / | Admin | List all users |
| GET | /:id | Yes | Get user (own or admin) |
| PUT | /:id | Yes | Update user |
| DELETE | /:id | Yes | Delete user |
| POST | /:id/change-password | Yes | Change password |
| POST | /verifyEmail | Yes | Send verification email |
| POST | /verifyEmail/confirm | No | Confirm with token |
| POST | /resetPassword/request | No | Request password reset |
| POST | /resetPassword/confirm | No | Reset with token |

### Products (`/products`)
| Method | Endpoint | Auth? |
|--------|----------|-------|
| GET | / | No |
| GET | /search?name=... | No |
| GET | /all?ids=1,2,3 | No |
| GET | /:id | No |
| POST | / | Admin |
| PUT | /:id | Admin |
| DELETE | /:id | Admin |

### Categories (`/category`)
| Method | Endpoint | Auth? |
|--------|----------|-------|
| GET | / | No |
| GET | /details | No |
| GET | /:id | No |
| POST | / | Admin |
| PUT | /:id | Admin |
| DELETE | /:id | Admin |

### Orders (`/orders`)
| Method | Endpoint | Auth? |
|--------|----------|-------|
| GET | / | Admin |
| GET | /:id | Yes |
| GET | /user/:userId | Yes |
| POST | / | Yes |
| PUT | /:id | Yes |
| DELETE | /:id | Yes |

### Checkout (`/checkout`)
| Method | Endpoint | Auth? |
|--------|----------|-------|
| POST | /finalize | Yes |
| POST | /webhook | No (Stripe) |

## Database Models

Pretty standard stuff:
- **User** - id, name, email, password, role, preferences, tokens
- **Product** - id, name, description, price, image, stock, category
- **Category** - id, name, products
- **Order** - id, user, items, status, total, timestamps  
- **OrderItem** - links orders to products with quantity and price

## Stripe Payment Flow

1. Frontend creates an order via `POST /orders`
2. Then calls `POST /checkout/finalize` with the orderId
3. Backend creates a Stripe checkout session and returns the URL
4. User pays on Stripe's hosted page
5. Stripe sends webhook to `/checkout/webhook`
6. We verify the signature, check the amount, mark order as COMPLETED

Make sure to set up the webhook in Stripe dashboard pointing to your `/checkout/webhook` endpoint.

## Security Stuff

Things I've implemented:
- Passwords hashed with bcrypt (10 rounds)
- Refresh tokens also hashed before storing
- JWTs in httpOnly cookies (not localStorage)
- CSRF tokens for state-changing requests
- Rate limiting (60 req/min default, stricter on auth endpoints)
- Helmet for security headers
- Input validation on everything via class-validator
- Generic error messages to prevent user enumeration

## Running Tests

```bash
npm run test          # unit tests
npm run test:cov      # with coverage
npm run test:e2e      # end to end
```

## Project Structure

```
server/
├── src/
│   ├── auth/          # login, register, jwt stuff
│   ├── user/          # user management
│   ├── products/      # product CRUD
│   ├── category/      # categories
│   ├── orders/        # order management  
│   ├── checkout/      # stripe integration
│   └── typeorm/
│       └── entities/  # database models
├── utils/             # helpers (hashing, decorators, etc)
├── lib/               # external service configs (stripe)
└── test/              # e2e tests
```

## TODO

- [ ] Add image uploads for products
- [ ] Soft deletes instead of hard deletes
- [ ] Better logging
- [ ] Docker setup
- [ ] CI/CD pipeline

---

Feel free to open an issue if something's broken or doesn't make sense.

