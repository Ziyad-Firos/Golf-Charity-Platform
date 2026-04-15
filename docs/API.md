# Golf Charity Platform API Documentation

## Overview

The Golf Charity Platform API is a RESTful API built with Node.js, Express, and TypeScript. It provides endpoints for user authentication, charity management, subscription handling, score tracking, and prize draws.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-app.vercel.app/api`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Some endpoints require authentication via the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Types

- **Access Token**: Short-lived token (15 minutes) for API access
- **Refresh Token**: Long-lived token (7 days) stored in HTTP-only cookies

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "data": { ... },
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "fields": { ... } // Optional field validation errors
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "subscriber"
  },
  "accessToken": "jwt_token"
}
```

**Error Codes:**
- `VALIDATION_ERROR`: Invalid input data
- `USER_EXISTS`: Email already registered

#### POST /auth/login
Authenticate a user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "subscriber"
  },
  "accessToken": "jwt_token"
}
```

**Error Codes:**
- `AUTH_INVALID_CREDENTIALS`: Invalid email or password

#### POST /auth/refresh
Refresh an access token using a refresh token.

**Cookies Required:**
- `refresh_token`: HTTP-only cookie with refresh token

**Response:**
```json
{
  "accessToken": "new_jwt_token"
}
```

**Error Codes:**
- `AUTH_NO_REFRESH_TOKEN`: No refresh token provided
- `AUTH_INVALID_REFRESH_TOKEN`: Invalid or expired refresh token

#### POST /auth/logout
Logout a user by clearing the refresh token cookie.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### GET /auth/me
Get the current user's profile information.

**Authentication Required:** Yes

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "subscriber",
    "subscriptionState": "active"
  }
}
```

#### GET /auth/profile
Get extended user profile information.

**Authentication Required:** Yes

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "subscriber",
  "subscriptionState": "active",
  "stripeCustomerId": "cus_123",
  "charityId": "uuid",
  "charityContributionPct": 10,
  "currency": "GBP",
  "locale": "en-GB",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Charities

#### GET /charities
Get a list of all active charities.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term for charity names

**Response:**
```json
{
  "charities": [
    {
      "id": "uuid",
      "name": "Charity Name",
      "description": "Charity description",
      "website": "https://charity.org",
      "logoUrl": "https://example.com/logo.png",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### GET /charities/:id
Get detailed information about a specific charity.

**Response:**
```json
{
  "id": "uuid",
  "name": "Charity Name",
  "description": "Charity description",
  "website": "https://charity.org",
  "logoUrl": "https://example.com/logo.png",
  "isActive": true,
  "totalContributions": 10000,
  "contributorCount": 100,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Subscriptions

#### GET /subscriptions
Get the current user's subscription information.

**Authentication Required:** Yes

**Response:**
```json
{
  "id": "uuid",
  "state": "active",
  "planId": "uuid",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z",
  "autoRenew": true,
  "amount": 1000,
  "currency": "GBP"
}
```

#### POST /subscriptions
Create a new subscription.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "planId": "uuid",
  "paymentMethodId": "pm_123",
  "charityId": "uuid",
  "charityContributionPct": 10
}
```

**Response:**
```json
{
  "subscription": {
    "id": "uuid",
    "state": "active",
    "planId": "uuid",
    "startDate": "2024-01-01T00:00:00.000Z",
    "amount": 1000,
    "currency": "GBP"
  }
}
```

#### PUT /subscriptions/:id
Update an existing subscription.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "charityId": "uuid",
  "charityContributionPct": 15,
  "autoRenew": false
}
```

#### DELETE /subscriptions/:id
Cancel a subscription.

**Authentication Required:** Yes

**Response:**
```json
{
  "message": "Subscription cancelled successfully"
}
```

### Scores

#### GET /scores
Get the current user's golf scores.

**Authentication Required:** Yes

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `fromDate`: Filter by date (ISO string)
- `toDate`: Filter by date (ISO string)

**Response:**
```json
{
  "scores": [
    {
      "id": "uuid",
      "stablefordScore": 36,
      "playedOn": "2024-01-01T00:00:00.000Z",
      "courseName": "Golf Club",
      "notes": "Great round!"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  },
  "statistics": {
    "averageScore": 35.5,
    "bestScore": 42,
    "roundsPlayed": 25
  }
}
```

#### POST /scores
Submit a new golf score.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "stablefordScore": 36,
  "playedOn": "2024-01-01T00:00:00.000Z",
  "courseName": "Golf Club",
  "notes": "Great round!"
}
```

**Response:**
```json
{
  "score": {
    "id": "uuid",
    "stablefordScore": 36,
    "playedOn": "2024-01-01T00:00:00.000Z",
    "courseName": "Golf Club",
    "notes": "Great round!",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /scores/leaderboard
Get the monthly leaderboard.

**Query Parameters:**
- `month`: Month (default: current month)
- `year`: Year (default: current year)
- `limit`: Number of entries (default: 10)

**Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "subscriber": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe"
      },
      "bestScore": 42,
      "averageScore": 38.5,
      "roundsPlayed": 10
    }
  ],
  "month": "January",
  "year": 2024
}
```

### Draws

#### GET /draws
Get information about prize draws.

**Query Parameters:**
- `status`: Filter by status (`upcoming`, `active`, `completed`)
- `limit`: Number of entries (default: 10)

**Response:**
```json
{
  "draws": [
    {
      "id": "uuid",
      "drawMonth": "2024-01",
      "status": "active",
      "prizePool": 50000,
      "winnerCount": 3,
      "entryDeadline": "2024-01-31T23:59:59.000Z",
      "drawDate": "2024-02-01T12:00:00.000Z"
    }
  ]
}
```

#### GET /draws/:id
Get detailed information about a specific draw.

**Response:**
```json
{
  "id": "uuid",
  "drawMonth": "2024-01",
  "status": "completed",
  "prizePool": 50000,
  "winnerCount": 3,
  "entryDeadline": "2024-01-31T23:59:59.000Z",
  "drawDate": "2024-02-01T12:00:00.000Z",
  "winners": [
    {
      "rank": 1,
      "subscriber": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe"
      },
      "prizeAmount": 25000,
      "paymentState": "paid"
    }
  ]
}
```

### Contributions

#### GET /contributions
Get the current user's charity contributions.

**Authentication Required:** Yes

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `charityId`: Filter by charity

**Response:**
```json
{
  "contributions": [
    {
      "id": "uuid",
      "amount": 100,
      "charity": {
        "id": "uuid",
        "name": "Charity Name"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  },
  "totals": {
    "totalAmount": 2500,
    "totalContributions": 25
  }
}
```

## Error Codes

### Authentication Errors
- `AUTH_INVALID_TOKEN`: Invalid or missing authentication token
- `AUTH_TOKEN_EXPIRED`: Authentication token has expired
- `AUTH_INVALID_CREDENTIALS`: Invalid email or password
- `AUTH_NO_REFRESH_TOKEN`: No refresh token provided
- `AUTH_INVALID_REFRESH_TOKEN`: Invalid or expired refresh token
- `AUTH_USER_NOT_FOUND`: User not found
- `AUTH_FORBIDDEN`: Insufficient permissions

### Validation Errors
- `VALIDATION_ERROR`: Invalid input data
- `INVALID_REQUEST`: Malformed request

### Business Logic Errors
- `USER_EXISTS`: Email already registered
- `SUBSCRIPTION_INACTIVE`: Inactive subscription
- `INSUFFICIENT_PERMISSIONS`: Insufficient permissions

### System Errors
- `INTERNAL_ERROR`: Internal server error
- `DATABASE_ERROR`: Database operation failed
- `EXTERNAL_SERVICE_ERROR`: External service error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **Sensitive operations**: 10 requests per 15 minutes

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## CORS

The API supports Cross-Origin Resource Sharing (CORS) with the following settings:

- **Allowed Origins**: Configured based on environment
- **Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization
- **Credentials**: Supported

## Webhooks

The API supports webhooks for real-time notifications:

### Webhook Events
- `subscription.created`: New subscription created
- `subscription.cancelled`: Subscription cancelled
- `draw.completed`: Prize draw completed
- `contribution.made`: Charity contribution made

### Webhook Configuration
Configure webhooks in your account settings or via the API.

## Testing

### Test Environment
- **Base URL**: `http://localhost:3001/api`
- **Test User**: `test@example.com` / `TestPassword123!`

### Test Data
The API provides test endpoints for development:
- `POST /test/reset`: Reset test data
- `POST /test/seed`: Seed test data

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @golf-charity-platform/sdk
```

### Python
```bash
pip install golf-charity-platform-sdk
```

## Support

For API support and documentation updates:
- **Email**: api-support@golf-charity-platform.com
- **Documentation**: https://docs.golf-charity-platform.com
- **Status Page**: https://status.golf-charity-platform.com

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Authentication endpoints
- Charity management
- Subscription handling
- Score tracking
- Prize draws

### v1.1.0 (2024-02-01)
- Added webhook support
- Enhanced rate limiting
- Performance improvements
- Bug fixes

---

*Last updated: January 15, 2024*
