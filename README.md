# E-Commerce REST API

A comprehensive backend REST API for e-commerce applications, built with NestJS, TypeORM, and MySQL. This API provides endpoints for user authentication, product management, order processing, and payment integration.

## Features

### Authentication

- JWT-based authentication with access and refresh tokens
- Token rotation for security
- Login/logout functionality
- Protected routes with customizable public endpoints
- Registration with password hashing

### User Management

- CRUD operations for user accounts
- User profile retrieval
- Secure password handling with bcrypt

### Product Management

- Complete CRUD operations for products
- Product categorization
- Product search functionality by name
- Detailed product information storage

### Category System

- Organize products in categories
- Category management (create, update, delete)
- Retrieve products by category

### Order Management

- Create and track orders
- Order status updates (PENDING, COMPLETED, CANCELED)
- Order history by user
- Detailed order items with quantities

### Payment Processing

- Stripe payment integration
- Secure checkout flow
- Success and cancel URL handling

## Tech Stack

- Framework: NestJS
- Database: MySQL with TypeORM
- Authentication: JWT with Passport
- Validation: class-validator and class-transformer
- Payment Gateway: Stripe
- Security: bcrypt for password hashing

## Installation

### Database Setup

The application uses MySQL. Make sure you have MySQL installed and running, then:

1. Create a database with the name specified in your `.env` file (default: ecommerce)
2. The application will automatically create the tables through TypeORM synchronization when it first runs

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```

```

```
# Database configuration
DB_NAME=ecommerce
DB_USERNAME=your_username
DB_PORT=3306
DB_PASSWORD=your_password
DB_HOST=localhost

# Application configuration
PORT=5000
NODE_ENV=development

# JWT configuration
JWT_SECRET=your_jwt_secret_key

# Stripe configuration
STRIPE_SECRET_KEY=your_stripe_secret_key_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and receive tokens
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and invalidate tokens
- `GET /auth/profile` - Get user profile

### Users

- `GET /user` - Get all users
- `GET /user/:id` - Get user by ID
- `PUT /user/:id` - Update user
- `DELETE /user/:id` - Delete user

### Products

- `GET /products` - Get all products
- `GET /products/:id` - Get product by ID
- `GET /products/search?name=query` - Search products by name
- `POST /products` - Create new product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product
- `POST /products/all` - Get products by IDs

### Categories

- `GET /category` - Get all categories
- `GET /category/:id` - Get category by ID
- `GET /category/details` - Get all categories with products
- `GET /category/details/:id` - Get category with its products
- `POST /category` - Create new category
- `PUT /category/:id` - Update category
- `DELETE /category/:id` - Delete category

### Orders

- `GET /orders` - Get all orders
- `GET /orders/:id` - Get order by ID
- `POST /orders` - Create new order
- `PUT /orders/:id` - Update order
- `DELETE /orders/:id` - Delete order

### Checkout

- `POST /checkout/finalize` - Create Stripe checkout session

## Data Models

### User

- `id`: number (PK)
- `name`: string
- `email`: string (unique)
- `password`: string (hashed)
- `orders`: Order[] (relation)
- `refreshToken`: string (nullable)
- `createdAt`: Date
- `updatedAt`: Date

### Product

- `id`: number (PK)
- `name`: string
- `description`: string
- `price`: number
- `imageUrl`: string (nullable)
- `category`: Category (relation)
- `orderItems`: OrderItem[] (relation)

### Category

- `id`: number (PK)
- `name`: string (unique)
- `imageUrl`: string
- `products`: Product[] (relation)
- `createdAt`: Date
- `updatedAt`: Date

### Order

- `id`: number (PK)
- `name`: string (nullable)
- `user`: User (relation)
- `items`: OrderItem[] (relation)
- `totalAmount`: number
- `status`: enum ('PENDING', 'COMPLETED', 'CANCELED')
- `createdAt`: Date
- `updatedAt`: Date

### OrderItem

- `id`: number (PK)
- `order`: Order (relation)
- `product`: Product (relation)
- `quantity`: number
- `unitPrice`: number

## Authentication Flow

1. Registration: User registers with email, name, and password
2. Login: User logs in and receives access and refresh tokens as HTTP-only cookies
3. Protected Routes: Access token is automatically used for protected routes
4. Token Refresh: When access token expires, refresh token is used to get a new pair of tokens
5. Logout: Both tokens are invalidated on logout

## Testing

_Coming soon_
