export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler =
  (fn: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>) =>
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
