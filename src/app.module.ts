import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProductsModule } from './products/products.module';
import { Module } from '@nestjs/common';
import { Product } from './typeorm/entities/Product';
import { User } from './typeorm/entities/User';
import { UserModule } from './user/user.module';
import { OrdersModule } from './orders/orders.module';
import { Order } from './typeorm/entities/Order';
import { AuthModule } from './auth/auth.module';
import { Category } from './typeorm/entities/Category';
import { CategoryModule } from './category/category.module';
import { OrderItem } from './typeorm/entities/OrderItem';
import { CheckoutModule } from './checkout/checkout.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 60,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        password: configService.get<string>('DB_PASSWORD'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        database: configService.get<string>('DB_NAME'),
        entities: [Product, User, Order, Category, OrderItem],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ProductsModule,
    UserModule,
    OrdersModule,
    AuthModule,
    CategoryModule,
    CheckoutModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
