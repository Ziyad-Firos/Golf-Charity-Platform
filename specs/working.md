# Working.md - Golf Charity Platform Documentation

## Overview

The Golf Charity Platform is a subscription-driven web application that combines golf score tracking, monthly prize draws, and charity fundraising. It's built with a React frontend and Node.js/Express backend using PostgreSQL.

---

## 🚀 How to Run the Program

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (or Supabase account)

### Setup Instructions

1. **Install Dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

2. **Environment Setup**
   ```bash
   # Server environment variables
   cd server
   cp .env.example .env
   # Edit .env with your database URL, JWT secrets, and Stripe keys
   
   # Client environment variables
   cd ../client
   cp .env.example .env
   # Edit .env with your API URL
   ```

3. **Database Setup**
   ```bash
   # Run database migrations
   cd server
   # Apply migrations to your PostgreSQL database
   # Files in ../migrations/ folder need to be executed in order
   ```

4. **Run the Application**
   ```bash
   # Terminal 1: Start backend server
   cd server
   npm run dev
   
   # Terminal 2: Start frontend development server
   cd client
   npm run dev
   ```

5. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/api/health

---

## 📁 File Structure and Functions

### SERVER FILES

#### `server/src/index.ts`
**Purpose**: Application entry point
**Input**: Environment variables (PORT)
**Output**: Console log, HTTP server
**Main Functions**:
- Imports Express app configuration
- Starts HTTP server on configured port (default 3001)
- Binds to 0.0.0.0 for network accessibility
- Logs server startup message

**Use**: Bootstraps the entire backend application

---

#### `server/src/app.ts`
**Purpose**: Express application configuration
**Input**: HTTP requests
**Output**: HTTP responses
**Main Functions**:
- Configures security headers with Helmet.js
- Sets up CORS for cross-origin requests
- Parses JSON and URL-encoded request bodies
- Parses cookies
- Defines health check endpoint `/api/health`
- Routes API requests to router middleware

**Use**: Main Express app setup and middleware configuration

---

#### `server/src/db/client.ts`
**Purpose**: Database connection management
**Input**: Database queries and parameters
**Output**: Query results
**Main Functions**:
- Creates PostgreSQL connection pool
- Provides `query()` function for parameterized queries
- Handles SSL configuration based on NODE_ENV
- Exports pool instance for direct database access

**Use**: Centralized database connection and query execution

---

#### `server/src/db/index.ts`
**Purpose**: Database module export
**Input**: None
**Output**: Database client exports
**Main Functions**:
- Re-exports database client for easy importing
- Provides centralized database access point

**Use**: Simplifies database imports across the application

---

#### `server/src/middleware/auth.middleware.ts`
**Purpose**: Authentication and authorization middleware
**Input**: HTTP requests with JWT tokens
**Output**: Authenticated requests or error responses
**Main Functions**:
- `authenticateToken()`: Validates JWT tokens and attaches user data
- `requireAdmin()`: Ensures user has admin role
- `requireActiveSubscription()`: Checks user subscription status
- Extends Express Request type with user information

**Use**: Protects API routes and enforces access controls

---

#### `server/src/routes/auth.ts`
**Purpose**: User authentication endpoints
**Input**: Registration/login data, JWT tokens
**Output**: JWT tokens, user profiles, error messages
**Main Functions**:
- `POST /api/auth/register`: User registration with password hashing
- `POST /api/auth/login`: User authentication with JWT issuance
- `GET /api/auth/profile`: Retrieve user profile data
- Password validation with bcrypt
- JWT token generation and validation

**Use**: Handles all user authentication operations

---

#### `server/src/routes/auth.routes.ts`
**Purpose**: Advanced authentication routes (alternative implementation)
**Input**: Authentication requests, refresh tokens
**Output**: Access tokens, refresh tokens, logout
**Main Functions**:
- JWT refresh token management
- HttpOnly cookie handling
- Token expiration handling
- Logout functionality

**Use**: Enhanced authentication with refresh tokens

---

#### `server/src/routes/charities.ts`
**Purpose**: Charity management endpoints
**Input**: Charity data, search queries
**Output**: Charity information, creation results
**Main Functions**:
- `GET /api/charities`: List all charities with search/filter
- `GET /api/charities/:id`: Get specific charity details
- `GET /api/charities/featured`: Get featured charity
- `POST /api/admin/charities`: Create new charity (admin)
- Charity CRUD operations with validation

**Use**: Manages charity information and public listings

---

#### `server/src/routes/subscriptions.ts`
**Purpose**: Subscription management endpoints
**Input**: Subscription plans, payment data
**Output**: Subscription status, checkout sessions
**Main Functions**:
- `GET /api/subscriptions/plans`: List available subscription plans
- `POST /api/subscriptions/checkout`: Create Stripe checkout session
- `GET /api/subscriptions/status`: Get user subscription status
- `POST /api/subscriptions/cancel`: Cancel subscription
- Stripe payment integration

**Use**: Handles subscription lifecycle and payment processing

---

#### `server/src/routes/scores.ts`
**Purpose**: Golf score management endpoints
**Input**: Score entries, score updates
**Output**: Score history, update confirmations
**Main Functions**:
- `GET /api/scores`: Get user's score history
- `POST /api/scores`: Add new score entry
- `PUT /api/scores/:id`: Update existing score
- `DELETE /api/scores/:id`: Delete score entry
- Score validation (1-45 range)
- Rolling window enforcement (max 5 scores)

**Use**: Manages user golf scores and maintains score history

---

#### `server/src/routes/draws.ts`
**Purpose**: Draw simulation endpoints
**Input**: Draw parameters, simulation requests
**Output**: Draw results, prize calculations
**Main Functions**:
- Draw number generation (random/algorithmic)
- Prize pool calculations
- Winner evaluation logic
- Draw simulation without persistence

**Use**: Provides draw simulation capabilities for testing

---

#### `server/src/routes/draw.routes.ts`
**Purpose**: Production draw management endpoints
**Input**: Draw configurations, admin actions
**Output**: Published draws, winner lists
**Main Functions**:
- `GET /api/draws`: List published draws
- `GET /api/draws/:id`: Get draw details
- `POST /api/admin/draws/simulate`: Simulate draw results
- `POST /api/admin/draws/publish`: Publish official draw
- `GET /api/admin/draws/:id/winners`: Get draw winners
- Draw persistence and winner management

**Use**: Manages official draw operations and results

---

#### `server/src/services/draw.service.ts`
**Purpose**: Draw engine business logic
**Input**: Subscriber data, draw parameters
**Output**: Draw results, prize distributions
**Main Functions**:
- `generateRandomNumbers()`: Cryptographically secure random number generation
- `generateWeightedNumbers()`: Algorithmic number generation based on score frequency
- `evaluateMatches()`: Match draw numbers against subscriber scores
- `calculatePrizePool()`: Calculate prize pool distributions
- `distributeWinnings()`: Allocate prizes to winners
- `persistDraw()`: Save draw results to database

**Use**: Core draw engine logic and prize calculations

---

#### `server/src/services/subscription.service.ts`
**Purpose**: Subscription business logic
**Input**: Subscription data, Stripe events
**Output**: Subscription states, payment processing
**Main Functions**:
- Stripe Checkout session creation
- Webhook event processing
- Subscription state management
- Payment failure handling

**Use**: Handles subscription lifecycle and payment processing

---

#### `server/src/services/notification.service.ts`
**Purpose**: Email notification service (placeholder)
**Input**: Notification triggers, user data
**Output**: Email notifications (stub implementation)
**Main Functions**:
- `sendRenewalConfirmation()`: Send renewal notifications
- `sendPaymentFailure()`: Send payment failure alerts
- `sendDrawResults()`: Send draw result notifications
- `sendWinnerNotification()`: Notify winners
- `sendVerificationRejection()`: Send rejection notices

**Use**: Manages all email communications (currently stubbed)

---

#### `server/src/types/express.d.ts`
**Purpose**: TypeScript type declarations for Express
**Input**: Type definitions
**Output**: Enhanced TypeScript support
**Main Functions**:
- Extends Express Request/Response interfaces
- Adds custom properties for user authentication
- Provides global type declarations
- Enables better TypeScript intellisense

**Use**: Enhances TypeScript development experience

---

#### `server/src/types/disable-checks.ts`
**Purpose**: TypeScript checking disable file
**Input**: None
**Output**: Disabled type checking
**Main Functions**:
- Contains `@ts-nocheck` directive
- Disables TypeScript checking for development
- Allows compilation despite type issues

**Use**: Temporary workaround for type checking issues

---

#### `server/tsconfig.json`
**Purpose**: TypeScript configuration
**Input**: TypeScript compiler options
**Output**: Compiled JavaScript files
**Main Functions**:
- Configures TypeScript compiler settings
- Sets target to ES2022
- Enables CommonJS modules
- Disables strict checking for development

**Use**: Controls TypeScript compilation behavior

---

#### `server/package.json`
**Purpose**: Server package configuration
**Input**: npm commands
**Output**: Package installation and scripts
**Main Functions**:
- Defines server dependencies
- Provides build and development scripts
- Configures package metadata
- Sets up npm scripts for development workflow

**Use**: Manages server dependencies and build process

---

### CLIENT FILES

#### `client/src/main.tsx`
**Purpose**: React application entry point
**Input**: None
**Output**: Rendered React application
**Main Functions**:
- Imports React and ReactDOM
- Sets up BrowserRouter for routing
- Renders App component in strict mode
- Applies global CSS styles

**Use**: Bootstraps the React frontend application

---

#### `client/src/App.tsx`
**Purpose**: Main application component with routing
**Input**: URL path
**Output**: Rendered page components
**Main Functions**:
- Defines all application routes
- Sets up protected routes with authentication
- Configures route-based page rendering
- Integrates Layout component

**Use**: Main routing configuration for the entire application

---

#### `client/src/lib/api.ts`
**Purpose**: API client configuration
**Input**: API requests
**Output**: HTTP responses with error handling
**Main Functions**:
- Creates Axios instance with base URL
- Sets up request/response interceptors
- Handles JWT token attachment
- Manages API error responses

**Use**: Centralized API communication layer

---

#### `client/src/store/auth.ts`
**Purpose**: Authentication state management
**Input**: User actions, authentication events
**Output**: Global auth state
**Main Functions**:
- Manages user authentication state
- Handles login/logout operations
- Persists auth data to localStorage
- Provides auth state to components

**Use**: Global authentication state management

---

#### `client/src/components/Layout.tsx`
**Purpose**: Application layout component
**Input**: Page content
**Output**: Complete page layout
**Main Functions**:
- Renders header with navigation
- Provides main content area
- Includes footer
- Handles responsive layout

**Use**: Consistent layout structure across all pages

---

#### `client/src/pages/HomePage.tsx`
**Purpose**: Public homepage
**Input**: None
**Output**: Marketing content and CTAs
**Main Functions**:
- Displays hero section with marketing copy
- Shows featured charity spotlight
- Provides navigation to key features
- Includes subscribe call-to-action

**Use**: Public landing page for visitors

---

#### `client/src/pages/LoginPage.tsx`
**Purpose**: User login page
**Input**: User credentials
**Output**: Authentication result
**Main Functions**:
- Renders login form with validation
- Handles form submission
- Manages authentication errors
- Redirects on successful login

**Use**: User authentication interface

---

#### `client/src/pages/RegisterPage.tsx`
**Purpose**: User registration page
**Input**: User registration data
**Output**: New user account creation
**Main Functions**:
- Multi-step registration form
- Form validation with Zod
- API integration for account creation
- Progress tracking through registration steps

**Use**: New user account creation interface

---

#### `client/src/pages/DashboardPage.tsx`
**Purpose**: User dashboard
**Input**: User data
**Output**: Personalized dashboard content
**Main Functions**:
- Displays subscription status
- Shows charity contribution info
- Presents recent golf scores
- Provides participation summary

**Use**: Main user interface for authenticated users

---

#### `client/src/pages/SubscribePage.tsx`
**Purpose**: Subscription selection page
**Input**: Subscription choices
**Output**: Subscription activation
**Main Functions**:
- Displays available subscription plans
- Allows charity selection
- Handles contribution percentage settings
- Integrates with Stripe checkout

**Use**: Subscription purchase and configuration interface

---

#### `client/src/pages/ScoresPage.tsx`
**Purpose**: Score management page
**Input**: Golf score data
**Output**: Score history and management
**Main Functions**:
- Displays score history (max 5 entries)
- Provides score entry form
- Enables score editing and deletion
- Validates score inputs (1-45 range)

**Use**: Golf score entry and management interface

---

#### `client/src/pages/CharitiesPage.tsx`
**Purpose**: Charity browsing page
**Input**: Charity search/filter
**Output**: Charity listings and details
**Main Functions**:
- Lists all available charities
- Provides search and filter functionality
- Shows charity details and events
- Supports charity selection

**Use**: Charity discovery and selection interface

---

#### `client/src/pages/DrawsPage.tsx`
**Purpose**: Draw history and results page
**Input**: User draw participation data
**Output**: Draw results and history
**Main Functions**:
- Displays historical draw results
- Shows user's draw participation
- Presents prize winning information
- Provides draw statistics

**Use**: Draw results and participation tracking

---

#### `client/src/pages/AdminPage.tsx`
**Purpose**: Admin dashboard
**Input**: Admin actions
**Output**: Administrative interface
**Main Functions**:
- User management interface
- Charity management tools
- Draw creation and management
- Winner verification system
- Reports and analytics

**Use**: Administrative control panel

---

#### `client/package.json`
**Purpose**: Client package configuration
**Input**: npm commands
**Output**: Frontend build and development
**Main Functions**:
- Defines React app dependencies
- Provides Vite build configuration
- Sets up development scripts
- Configures package metadata

**Use**: Manages frontend dependencies and build process

---

#### `client/vite.config.ts`
**Purpose**: Vite build configuration
**Input**: Build options
**Output**: Optimized frontend build
**Main Functions**:
- Configures Vite development server
- Sets up build optimization
- Handles plugin configuration
- Defines development settings

**Use**: Frontend build tool configuration

---

## 🔧 Configuration Files

### Environment Variables

#### Server (.env)
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
NODE_ENV=development
PORT=3001
```

#### Client (.env)
```bash
VITE_API_URL=http://localhost:3001
```

### Database Migrations

#### `migrations/001_initial_schema.sql`
**Purpose**: Creates all database tables
**Input**: SQL commands
**Output**: Database schema
**Main Functions**:
- Creates 9 core tables (subscribers, charities, scores, draws, etc.)
- Sets up foreign key relationships
- Adds constraints and indexes
- Establishes data integrity rules

#### `migrations/002_seed_plans.sql`
**Purpose**: Seeds subscription plans
**Input**: Plan data
**Output**: Initial subscription plans
**Main Functions**:
- Inserts monthly and yearly subscription plans
- Sets up pricing and contribution percentages
- Provides initial data for testing

---

## 🎯 Key Features

### Authentication System
- JWT-based authentication with refresh tokens
- Role-based access control (user/admin)
- Password hashing with bcrypt
- Protected route middleware

### Subscription Management
- Stripe payment integration
- Multiple subscription tiers
- Automated subscription state management
- Webhook processing for payment events

### Score Management
- Stableford score validation (1-45)
- Rolling window (max 5 scores)
- Score history tracking
- CRUD operations with ownership verification

### Draw Engine
- Random and algorithmic draw modes
- Prize pool calculations
- Winner evaluation and distribution
- Jackpot carry-forward logic

### Charity System
- Charity CRUD operations
- Featured charity spotlight
- Contribution percentage management
- Charity events and profiles

### Admin Dashboard
- User management tools
- Draw creation and simulation
- Charity management
- Winner verification system

---

## 🚀 Deployment Notes

### Production Build
```bash
# Build server
cd server
npm run build

# Build client
cd ../client
npm run build
```

### Environment Setup
- Configure production environment variables
- Set up PostgreSQL database
- Configure Stripe webhooks
- Set up email service (Resend/SendGrid)

### Security Considerations
- HTTPS enforcement
- Security headers (Helmet.js)
- Rate limiting on auth endpoints
- Input validation and sanitization
- CORS configuration

---

## 📊 Testing

### Running Tests
```bash
# Server tests
cd server
npm test

# Client tests
cd client
npm test

# E2E tests (if configured)
npm run test:e2e
```

### Test Coverage
- Unit tests for API endpoints
- Integration tests for database operations
- Frontend component tests
- End-to-end user flow tests

---

This documentation covers all major files and their functions in the Golf Charity Platform. The application is designed to be modular, scalable, and maintainable with clear separation of concerns between frontend and backend components.
