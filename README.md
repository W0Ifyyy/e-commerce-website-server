# E-Commerce Backend 🛒

Hey! This is my e-commerce api. I've been working on this for a while now and I honestly learned a ton building it. Its built with NestJS,  MySQL + TypeORM and stripe for payments.


## Quick Start

First, get into the server folder and install everything:

```bash
cd server
npm install
```

Then you gotta set up your environment variables. Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Fill in your own values (database stuff, Stripe keys, etc - more on that below). After that just run:

```bash
npm run start:dev
```

If everything went well, you should be able to hit `http://localhost:5000` and see something. If not... well, check the console for errors 😅

## What I Built

So here's basically what this API does:

- **Authentication** - Login/register with JWT tokens. Took me forever to figure out refresh tokens but got it working
- **Users** - The usual stuff - create accounts, update profiles, reset passwords. Also added email verification
- **Products & Categories** - Products can have categories, there's search functionality, pagination... you know, the basics
- **Orders** - Users can create orders, admins can update status, etc
- **Checkout** - This is where Stripe comes in. Users can actually pay for stuff!

## Tech Stack

Here's what I used:

- **NestJS 10** ,
- **TypeORM + MySQL**,
- **Passport**,
- **Stripe**,
- **class-validator**,
- **bcrypt**.

## Environment Variables

You'll need to get:
- Stripe keys from: https://dashboard.stripe.com/apikeys
- Mailtrap stuff from: https://mailtrap.io (for testing emails without spamming real inboxes)

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_NAME=ecommerce

# Server config
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

#They need to be strong
JWT_SECRET=make_this_really_long_and_random
CSRF_SECRET=this_one_too_make_it_different

#Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Email (using Mailtrap for dev)
MAILTRAP_TOKEN=your_token_here
MAILTRAP_TEST_INBOX_ID=12345
```

**Important** The JWT_SECRET and CSRF_SECRET need to be at least 32 characters in production or the app won't start. 

## How The Auth System Works

1. User signs up at `POST /auth/register` → password gets hashed with bcrypt before saving
2. Login at `POST /auth/login` → they get an access token (expires in 15 min) and a refresh token (7 days)
3. Both tokens are stored as httpOnly cookies
4. When the access token expires, the frontend can hit `POST /auth/refresh` to get new tokens
5. The old refresh token gets invalidated so it can't be reused 
6. Logout clears all the cookies.

Any POST/PUT/DELETE request needs the `X-CSRF-Token` header when logged in. The frontend gets this token from a cookie.

## All The API Endpoints

### Auth  (`/auth`)

| Method | Endpoint | Need to be logged in? | What it does |
|--------|----------|----------------------|--------------|
| POST | /register | No | Create a new account |
| POST | /login | No | Get your tokens |
| POST | /refresh | No | Get fresh tokens |
| POST | /logout | Yes | Clears your session |
| GET | /profile | Yes | Get your own info |

### Users (`/user`)

| Method | Endpoint | Who can use it? | Notes |
|--------|----------|-----------------|-------|
| GET | / | Admin only | List everyone |
| GET | /:id | Owner or Admin | Get one user |
| PUT | /:id | Owner or Admin | Update user |
| DELETE | /:id | Owner or Admin | Delete (be careful!) |
| POST | /:id/change-password | Owner | Change your password |
| POST | /verifyEmail | Logged in | Send verification email |
| POST | /verifyEmail/confirm | Anyone | Click the link from email |
| POST | /resetPassword/request | Anyone | "Forgot password" |
| POST | /resetPassword/confirm | Anyone | Set new password with token |

### Products (`/products`)

| Method | Endpoint | Auth? |
|--------|----------|-------|
| GET | / | No, public |
| GET | /search?name=shoe | No |
| GET | /all?ids=1,2,3 | No |
| GET | /:id | No |
| POST | / | Admin only |
| PUT | /:id | Admin only |
| DELETE | /:id | Admin only |

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
| GET | / | Admin (gets all orders) |
| GET | /:id | Owner or Admin |
| GET | /user/:userId | Owner or Admin |
| POST | / | Logged in |
| PUT | /:id | Owner or Admin |
| DELETE | /:id | Owner or Admin |

### Checkout (`/checkout`)

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | /finalize | Logged in - starts the Stripe payment |
| POST | /webhook | Called by Stripe, not you |

## Database

- **User** - id, name, email, password, role, emailVerified, refreshToken
- **Product** - id, name, description, price, imageUrl, stock, categoryId
- **Category** - id, name
- **Order** - id, userId, status, total, createdAt, updatedAt
- **OrderItem** - id, orderId, productId, quantity, priceAtPurchase

## How Payments Work (Stripe)

1. User adds products to cart on frontend
2. They create an order → `POST /orders`
3. Frontend calls `POST /checkout/finalize` with the orderId
4. Backend creates a Stripe Checkout Session and sends back the URL
5. User gets redirected to Stripe's payment page
6. After they pay, Stripe calls our webhook at `/checkout/webhook`
7. We verify the Stripe webhook signature, check the amount, then mark the order as COMPLETED

**Don't forget:** Set up the webhook in Stripe and point it to `/checkout/webhook`. For local testing, you can use Stripe CLI.

## Security Things 


- Passwords hashed with bcrypt (10 salt rounds)
- Refresh tokens are also hashed before storing in DB
- JWTs stored in httpOnly cookies so JavaScript can't access them
- CSRF tokens required for all state-changing requests
- Rate limiting - 60 requests per minute normally, way stricter on login/register
- Helmet for security headers
- All inputs validated with class-validator

## Running Tests

```bash
npm run test         
npm run test:cov      
npm run test:e2e     
```

## Folder Structure

```
server/
├── src/
│   ├── auth/          # all the login/register/jwt logic
│   ├── user/          # user CRUD and profile stuff
│   ├── products/      # product endpoints
│   ├── category/      # category endpoints
│   ├── orders/        # order management
│   ├── checkout/      # stripe integration
│   └── typeorm/
│       └── entities/  # database models (User, Product, etc)
├── utils/             # random helpers - hashing, decorators, etc
├── lib/               # external stuff like stripe config
└── test/              # e2e tests live here
```

## Things I Still Wanna Do

- [ ] Docker setup so deployment is easier
- [ ] Maybe add product reviews?

## Bugs? Questions?

If something doesn't work or you're confused about something, feel free to open an issue. Im still learning after all!


