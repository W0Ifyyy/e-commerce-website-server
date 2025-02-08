# NestJS E-Commerce Backend

A robust and scalable e-commerce backend built with NestJS, TypeORM, and MySQL. This application provides APIs for user authentication, product management, and order processing.

## Features

### User Authentication:

- Register, login, and refresh token.
- JWT-based authentication with access and refresh tokens.
- Password hashing using bcrypt.

### Product Management:

- Create, update, delete, and retrieve products.
- Product details include name, description, price, and image URL.

### Order Management:

- Create, update, delete, and retrieve orders.
- Orders are linked to users and products.
- Order status tracking (PENDING, COMPLETED, CANCELED).

### Database:

- MySQL database with TypeORM for entity management.
- Relationships between users, orders, and products.

### Security:

- JWT token validation and refresh token rotation.
- Role-based access control (RBAC) for future admin features.

## Technologies Used

- **Backend Framework**: NestJS
- **Database**: MySQL
- **ORM**: TypeORM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Validation**: class-validator, class-transformer
- **Environment Management**: @nestjs/config
