import { OrderItemDto } from 'src/orders/dtos/CreateOrderDto';

export interface ICreateCategory {
  name: string;
  imageUrl: string;
}

export interface IUpdateCategory {
  name?: string;
  imageUrl?: string;
}

export interface ICreateProduct {
  name: string;
  description: string;
  price: number;
  category: number;
  imageUrl?: string;
}

export interface IUpdateProduct {
  name?: string;
  description?: string;
  price?: number;
  category?: number;
  imageUrl?: string;
}

export interface ICreateUser {
  name: string;
  email: string;
  password: string;
}

export interface IUpdateUser {
  name?: string;
  email?: string;
  password?: string;
}

export interface ICreateOrder {
  name?: string;
  userId: number;
  items?: OrderItemDto[];
  totalAmount: number;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELED';
}

export interface IUpdateOrder {
  name?: string;
  userId?: number;
  items?: OrderItemDto[];
  totalAmount?: number;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELED';
}
