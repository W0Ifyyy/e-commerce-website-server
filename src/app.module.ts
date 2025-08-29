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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
        synchronize: true,
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
  providers: [AppService],
})
export class AppModule {}
