import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-32-chars-long-minimum-xx',
      JWT_REFRESH_SECRET: 'test-refresh-32-chars-long-minimum-x',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      NODE_ENV: 'test',
      PORT: '3001',
    },
  },
});
