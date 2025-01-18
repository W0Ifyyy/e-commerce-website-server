export interface ICreateProduct {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}

export interface IUpdateProduct {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
}
