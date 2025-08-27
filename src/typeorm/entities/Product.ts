import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './Order';
import { Category } from './Category';
import { OrderItem } from './OrderItem';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: false })
  price: number;

  @Column({ nullable: true })
  imageUrl: string;

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems: OrderItem[];

  @ManyToOne(() => Category, (Category) => Category.products, {
    nullable: false,
  })
  category: Category;
}
