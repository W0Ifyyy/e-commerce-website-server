import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from 'utils/rolesDecorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector){}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    //Read roles required by route
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    )
    //If no @Roles on route, allow
    if(!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    if(!user) throw new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);

    const userRole: string | undefined = user.role;
    if(!userRole) throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);

    const allowed = requiredRoles.includes(userRole);
    if(!allowed) throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
    
    return true;
  }
}
