import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dtos/CreateOrderDto';
import { UpdateOrderDto } from './dtos/UpdateOrderDto';
import { canAccess, canAccessUser } from 'utils/canAccess';
import { Request } from 'express';
import { Roles } from 'utils/rolesDecorator';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Roles('admin')
  @Get()
  getOrders() {
    return this.ordersService.getAllOrders();
  }
  @Roles("admin", "user")
  @Get(':id')
  getOrderById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.ordersService.getOrderById(id, req);
  }

  @Roles("admin", "user")
  @Get("/user/:userId")
  getOrdersByUserId(@Param('userId', ParseIntPipe) userId: number, @Req() req: Request){
    canAccessUser(req, userId);
    return this.ordersService.getOrdersByUserId(userId, req);
  }

  @Roles("admin", "user")
  @Post()
  createOrder(@Body() createOrderDto: CreateOrderDto, @Req() req: Request) {
    return this.ordersService.createOrder(createOrderDto, req);
  }

  @Roles("admin", "user")
  @Put(':id')
  updateOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
    @Req() req: Request,
  ) {
    return this.ordersService.updateOrder(id, updateOrderDto, req);
  }

  @Roles("admin", "user")
  @Delete(':id')
  deleteOrder(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ordersService.deleteOrder(id, req);
  }
}
