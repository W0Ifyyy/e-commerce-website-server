export interface ICreateProduct {
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
}

export interface IUpdateProduct {
  name?: string;
  description?: string;
  price?: number;
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
  productIds?: number[];
  totalAmount: number;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELED';
}
