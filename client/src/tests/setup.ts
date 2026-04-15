import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock environment variables
beforeAll(() => {
  // Mock Vite environment
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: 'http://localhost:5173' },
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  // Mock fetch
  global.fetch = vi.fn();
});

afterAll(() => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Setup before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
});

// Test utilities
export const createMockUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  subscriptionState: 'active'
});

export const createMockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(data),
    data,
    headers: new Headers(),
    config: {},
  });
};

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
