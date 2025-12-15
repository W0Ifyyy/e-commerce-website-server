import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'utils/rolesDecorator';
import { RolesGuard } from './roles.guard';

type MockReq = { user?: any };

const createExecutionContext = (req: MockReq = {}): ExecutionContext => {
  // stable references so repeated calls return the same values
  const handlerRef = function handler() {};
  class TestClassRef {}

  return ({
    getHandler: jest.fn(() => handlerRef),
    getClass: jest.fn(() => TestClassRef),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => req),
    })),
  } as unknown) as ExecutionContext;
};

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined as any);

    const ctx = createExecutionContext({ user: { role: 'admin' } });
    expect(guard.canActivate(ctx)).toBe(true);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });

  it('should allow when required roles is an empty array', () => {
    reflector.getAllAndOverride.mockReturnValueOnce([]);

    const ctx = createExecutionContext({ user: { role: 'admin' } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw 401 when roles are required but user is missing', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);

    const ctx = createExecutionContext({});
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('should throw 403 when roles are required but user.role is missing', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);

    const ctx = createExecutionContext({ user: {} });
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('should throw 403 when user role is not allowed', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);

    const ctx = createExecutionContext({ user: { role: 'customer' } });
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('should allow when user role is included in required roles', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin', 'manager']);

    const ctx = createExecutionContext({ user: { role: 'manager' } });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
