import 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody: Buffer;
    }

    // Augment the Passport user shape so req.user properties
    // are accessible without casting to `any`.
    interface User {
      userId: number;
      username: string;
      role: string;
    }
  }
}
