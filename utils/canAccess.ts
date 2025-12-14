import { HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

export function canAccess(req: Request & { user?: any }, userId?: number) {
  const role = req.user?.role;
  if (role === 'admin') return;

  const currentUserId = req.user?.userId;

  if (userId !== undefined && currentUserId !== userId) {
    throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }
  if (userId === undefined) {
    throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }
}