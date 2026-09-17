import express from 'express';
import request from 'supertest';
import { createLoginLimiter } from '../src/lib/rateLimit';

describe('Rate limiting', () => {
  it('blocks requests past the configured login limit with a structured error', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/login',
      createLoginLimiter({ limit: 3, windowMs: 60_000 }),
      (_req, res) => res.json({ ok: true }),
    );

    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app).post('/login').send({});
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app).post('/login').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});