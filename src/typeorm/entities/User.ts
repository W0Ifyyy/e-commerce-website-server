import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './Order';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: 'USD' })
  preferredCurrency: string;

  @Column({ default: 'US' })
  country: string;

  @Column({ default: false })
  emailNotifications: boolean;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ nullable: true })
  refreshToken: string;

  @Column()
  forgetPasswordToken: string;
  
  @Column({ type: 'timestamp', nullable: true })
  forgetPasswordTokenExpiry: Date;

  @Column()
  verifyToken: string;

  @Column({ type: 'timestamp', nullable: true })
  verifyTokenExpiry: Date;
}
