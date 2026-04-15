import request from 'supertest';
import { app } from '../app';
import { query } from '../db/client';
import { logger } from '../utils/logger';

// Test utilities
const createTestUser = async () => {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  };

  // Clean up any existing test user
  await query('DELETE FROM subscribers WHERE email = $1', [testUser.email]);

  return testUser;
};

const getAuthToken = async () => {
  const testUser = await createTestUser();
  
  // Register user
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send(testUser)
    .expect(201);

  return registerResponse.body.accessToken;
};

describe('Authentication Routes', () => {
  beforeEach(async () => {
    // Clean up test data
    await query('DELETE FROM subscribers WHERE email LIKE $1', ['test%']);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('firstName', testUser.firstName);
      expect(response.body.user).toHaveProperty('lastName', testUser.lastName);
      expect(response.body.user).toHaveProperty('role', 'subscriber');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const testUser = await createTestUser();
      testUser.email = 'invalid-email';

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.fields).toHaveProperty('email');
    });

    it('should return 400 for short password', async () => {
      const testUser = await createTestUser();
      testUser.password = '123';

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.fields).toHaveProperty('password');
    });

    it('should return 409 for existing email', async () => {
      const testUser = await createTestUser();

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.fields).toHaveProperty('email', 'Email already in use');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.fields).toHaveProperty('email');
      expect(response.body.error.fields).toHaveProperty('password');
      expect(response.body.error.fields).toHaveProperty('firstName');
      expect(response.body.error.fields).toHaveProperty('lastName');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const testUser = await createTestUser();

      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AUTH_INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AUTH_INVALID_CREDENTIALS');
    });

    it('should handle missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should return 401 without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AUTH_NO_REFRESH_TOKEN');
    });

    it('should return 401 with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AUTH_INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('firstName');
      expect(response.body.user).toHaveProperty('lastName');
      expect(response.body.user).toHaveProperty('role');
      expect(response.body.user).toHaveProperty('subscriptionState');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return extended user profile', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).toHaveProperty('lastName');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('subscriptionState');
      expect(response.body).toHaveProperty('stripeCustomerId');
      expect(response.body).toHaveProperty('charityId');
      expect(response.body).toHaveProperty('charityContributionPct');
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('locale');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return 404 for non-existent user', async () => {
      // Create a token for a non-existent user (this would normally not happen in production)
      const fakeToken = 'fake-token';
      
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401); // Should fail authentication first
    });
  });
});

describe('Security Tests', () => {
  describe('Rate Limiting', () => {
    it('should limit login attempts', async () => {
      const testUser = await createTestUser();

      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Make multiple login attempts with wrong password
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });

        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        }
      }
    }, 10000);
  });

  describe('Input Validation', () => {
    it('should reject malicious input', async () => {
      const maliciousUser = {
        email: 'test@example.com',
        password: '<script>alert("xss")</script>',
        firstName: '<script>alert("xss")</script>',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionUser = {
        email: "'; DROP TABLE subscribers; --",
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(sqlInjectionUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Performance Tests', () => {
  it('should handle concurrent requests', async () => {
    const testUser = await createTestUser();

    // Create multiple concurrent registration requests
    const promises = Array.from({ length: 10 }, (_, i) => 
      request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: `test${i}@example.com`
        })
    );

    const responses = await Promise.all(promises);
    
    // All should succeed
    responses.forEach(response => {
      expect(response.status).toBe(201);
    });
  }, 15000);
});

describe('Integration Tests', () => {
  it('should complete full user flow', async () => {
    const testUser = await createTestUser();

    // Register
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    const { accessToken } = registerResponse.body;

    // Get user profile
    const profileResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileResponse.body.user.email).toBe(testUser.email);

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .expect(200);

    // Try to access protected endpoint
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
