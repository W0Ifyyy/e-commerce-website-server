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

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}
  @Get()
  getOrders(@Req() req: any) {
    if(!canAccess(req)) throw new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);
    return this.ordersService.getAllOrders();
  }
  @Get(':id')
  getOrderById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.ordersService.getOrderById(id, req);
  }
  @Get("/user/:userId")
  getOrdersByUserId(@Param('userId', ParseIntPipe) userId: number, @Req() req: Request){
    canAccessUser(req, userId);
    return this.ordersService.getOrdersByUserId(userId);
  }
  @Post()
  createOrder(@Body() createOrderDto: CreateOrderDto, @Req() req: Request) {
    return this.ordersService.createOrder(createOrderDto, req);
  }
  @Put(':id')
  updateOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
    @Req() req: Request,
  ) {
    return this.ordersService.updateOrder(id, updateOrderDto, req);
  }
  @Delete(':id')
  deleteOrder(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ordersService.deleteOrder(id, req);
  }
}
