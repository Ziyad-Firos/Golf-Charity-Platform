import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { config } from '../config';

// Test configuration
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock environment variables for testing
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_test';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_test';
  process.env.RESEND_API_KEY = 're_test_test';
  process.env.CLIENT_URL = 'http://localhost:5173';
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('All tests completed');
});

beforeEach(async () => {
  // Setup before each test
  console.log('Starting test...');
});

afterEach(async () => {
  // Cleanup after each test
  console.log('Test completed');
});

// Global test utilities
export const testUtils = {
  createTestUser: () => ({
    email: 'test@example.com',
    password: 'testPassword123',
    firstName: 'Test',
    lastName: 'User'
  }),
  
  createTestAuth: () => ({
    sub: 'test-user-id',
    email: 'test@example.com',
    role: 'user'
  }),
  
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};
