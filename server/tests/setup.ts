// Runs before any test file imports the app, so process.env is set before
// 'dotenv/config' loads (dotenv never overrides pre-set env vars).
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-only-secret-0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test';