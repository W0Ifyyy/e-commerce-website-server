
# E-Commerce REST API

A comprehensive backend REST API for e-commerce applications, built with NestJS, TypeORM, and MySQL. This API provides endpoints for user authentication, product management, order processing, category organization, and Stripe payment integration.

## Features

### Authentication & Authorization

- JWT-based authentication with access and refresh tokens
- Secure token rotation and refresh mechanism
- HTTP-only cookie-based token storage
- Login/logout functionality with session management
- Protected routes with `@Public()` decorator for public endpoints
- Password hashing using bcrypt

### User Management

- Complete CRUD operations for user accounts
- User profile retrieval with order history
- Secure password change functionality
- User preferences (currency, country, email notifications)
- Refresh token management per user

### Product Management

- Full CRUD operations for products
- Product categorization system
- Product search by name with partial matching
- Bulk product retrieval by IDs
- Product-category relationships
- Product image URL support

### Category System

- Category CRUD operations
- Category with detailed product listings
- Category image support
- Retrieve all categories or specific category with products

### Order Management

- Create orders with multiple items
- Order status tracking (PENDING, COMPLETED, CANCELED)
- Order history by user with full item details
- Order items with quantity and unit price tracking
- Automatic product price capture at order time
- Complete order lifecycle management

### Payment Processing

- Stripe checkout session creation
- Webhook handling for payment confirmation
- Automatic order status updates on successful payment
- Multi-currency support based on user preferences
- Secure webhook signature verification

## Tech Stack

- **Framework**: NestJS 10.x
- **Database**: MySQL with TypeORM
- **Authentication**: JWT with Passport (Local & JWT strategies)
- **Validation**: class-validator and class-transformer
- **Payment Gateway**: Stripe
- **Security**: bcrypt for password hashing
- **Runtime**: Node.js

## Installation

```bash
# Install dependencies
npm install
```

### Database Setup

The application uses MySQL with TypeORM. Follow these steps:

1. Install and start MySQL server
2. Create a database with the name specified in your `.env` file (default: `ecommerce`)
3. TypeORM will automatically create tables on first run (synchronize: true)

### Environment Variables

Create a `.env` file in the `server` directory:

```env
# Database Configuration
DB_NAME=ecommerce
DB_USERNAME=your_username
DB_PORT=3306
DB_PASSWORD=your_password
DB_HOST=localhost

# Application Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

## API Endpoints

### Authentication
**Base URL**: `/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register a new user | No |
| POST | `/login` | Login and receive tokens | No |
| POST | `/refresh` | Refresh access token | No |
| POST | `/logout` | Logout and invalidate tokens | Yes |
| GET | `/profile` | Get authenticated user profile | Yes |

### Users
**Base URL**: `/user`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all users | Yes |
| GET | `/:id` | Get user by ID with orders | Yes |
| PUT | `/:id` | Update user details | Yes |
| DELETE | `/:id` | Delete user account | Yes |
| PUT | `/changePassword/:id` | Change user password | Yes |

### Products
**Base URL**: `/products`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all products | No |
| GET | `/search?name=query` | Search products by name | No |
| GET | `/:id` | Get product by ID | No |
| POST | `/all` | Get multiple products by IDs | No |
| POST | `/` | Create new product | Yes |
| PUT | `/:id` | Update product | Yes |
| DELETE | `/:id` | Delete product | Yes |

### Categories
**Base URL**: `/category`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all categories | No |
| GET | `/details` | Get all categories with products | No |
| GET | `/details/:id` | Get category with products | No |
| GET | `/:id` | Get category by ID | No |
| POST | `/` | Create new category | Yes |
| PUT | `/:id` | Update category | Yes |
| DELETE | `/:id` | Delete category | Yes |

### Orders
**Base URL**: `/orders`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all orders | Yes |
| GET | `/:id` | Get order by ID | Yes |
| POST | `/` | Create new order | Yes |
| PUT | `/:id` | Update order | Yes |
| DELETE | `/:id` | Delete order | Yes |

### Checkout
**Base URL**: `/checkout`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/finalize` | Create Stripe checkout session | No |
| POST | `/webhook` | Handle Stripe webhook events | No |

## Data Models

### User
```typescript
{
  id: number (PK)
  name: string (min: 5 chars)
  email: string (unique)
  password: string (hashed, strong password required)
  phone?: string
  preferredCurrency: string (default: 'USD')
  country: string (default: 'US')
  emailNotifications: boolean (default: false)
  orders: Order[]
  refreshToken?: string
  createdAt: Date
  updatedAt: Date
}
```

### Product
```typescript
{
  id: number (PK)
  name: string (max: 100 chars)
  description: string (max: 500 chars)
  price: number (min: 0)
  imageUrl?: string (valid URL)
  category: Category (relation, required)
  orderItems: OrderItem[]
}
```

### Category
```typescript
{
  id: number (PK)
  name: string (unique)
  imageUrl: string (valid URL)
  products: Product[]
  createdAt: Date
  updatedAt: Date
}
```

### Order
```typescript
{
  id: number (PK)
  name?: string
  user: User (relation)
  items: OrderItem[] (cascade: true)
  totalAmount: number (min: 0)
  status: 'PENDING' | 'COMPLETED' | 'CANCELED' (default: 'PENDING')
  createdAt: Date
  updatedAt: Date
}
```

### OrderItem
```typescript
{
  id: number (PK)
  order: Order (cascade delete)
  product: Product (eager: true)
  quantity: number (min: 1)
  unitPrice: number (decimal: 12,2)
}
```

## Authentication Flow

1. **Registration**: User registers with name, email, and strong password
2. **Login**: User logs in with username/password and receives:
   - Access token (15 min expiry) - stored in HTTP-only cookie
   - Refresh token (7 days expiry) - stored in HTTP-only cookie
3. **Protected Routes**: Access token is automatically extracted from cookies
4. **Token Refresh**: When access token expires, use refresh token to get new tokens
5. **Logout**: Clears cookies and removes refresh token from database

## Payment Flow (Stripe)

1. **Create Order**: User creates an order with items
2. **Initiate Checkout**: Frontend calls `/checkout/finalize` with:
   - Order ID
   - User ID
   - Products array (name, price, quantity)
3. **Stripe Session**: Backend creates Stripe checkout session with user's preferred currency
4. **Payment**: User completes payment on Stripe hosted page
5. **Webhook**: Stripe sends webhook to `/checkout/webhook`
6. **Order Update**: Webhook handler updates order status to 'COMPLETED'

## Validation

The API uses `class-validator` for request validation:

- **DTOs** for all endpoints with proper validation decorators
- **Transformation** enabled for type coercion
- **Whitelist** mode to strip unknown properties
- **ForbidNonWhitelisted** to reject requests with extra properties

## Error Handling

Consistent error responses using `HttpException`:

- `400 BAD_REQUEST` - Invalid input data
- `401 UNAUTHORIZED` - Authentication failure
- `404 NOT_FOUND` - Resource not found
- `409 CONFLICT` - Duplicate resource
- `500 INTERNAL_SERVER_ERROR` - Server errors

## Security Features

- Passwords hashed with bcrypt (10 salt rounds)
- Refresh tokens hashed before storage
- HTTP-only cookies prevent XSS attacks
- CORS configured for specific origin
- JWT with short-lived access tokens
- Stripe webhook signature verification
- Global validation pipe prevents injection attacks

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

Test structure:
- Unit tests for all services in `*.spec.ts` files
- E2E tests in `test/` directory
- Mock repositories for database operations

## Project Structure

```
server/
├── src/
│   ├── auth/              # Authentication module
│   ├── category/          # Category management
│   ├── checkout/          # Stripe checkout
│   ├── orders/            # Order management
│   ├── products/          # Product management
│   ├── typeorm/entities/  # Database entities
│   ├── user/              # User management
│   ├── app.module.ts      # Root module
│   └── main.ts            # Application entry point
├── utils/                 # Shared utilities
│   ├── creatingPassword.ts
│   ├── hashingTokens.ts
│   ├── Interfaces.ts
│   └── publicDecorator.ts
├── lib/                   # External libraries config
│   └── stripe.ts
└── test/                  # E2E tests
```

## Development

```bash
# Format code
npm run format

# Lint code
npm run lint
```

## Contributing

1. Create a feature branch
2. Add tests for new features
3. Ensure all tests pass
4. Submit a pull request

