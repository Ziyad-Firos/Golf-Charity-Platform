# Golf Charity Platform - Enterprise Edition

## Overview
The Golf Charity Platform is an enterprise-grade subscription-driven web application that combines Stableford golf score tracking, a monthly prize draw engine, and charity fundraising. Built with advanced software engineering principles, it features comprehensive monitoring, scalability, security, and production-ready infrastructure.

## Tech Stack
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Supabase with connection pooling
- **Authentication**: JWT tokens with refresh token rotation
- **Payments**: Stripe with webhook handling
- **Monitoring**: Real-time metrics, alerting, and business intelligence
- **Caching**: Multi-tier caching with Redis support
- **Security**: Advanced security middleware and rate limiting
- **Testing**: Comprehensive test suite with unit, integration, and e2e tests
- **Deployment**: Production-ready with CI/CD pipelines

## Features
- **Core Features**:
  - User registration and authentication with JWT
  - Subscription management with Stripe integration
  - Golf score tracking (Stableford format, last 5 scores)
  - Monthly prize draws with random/algorithmic selection
  - Charity selection and contribution management
  - Admin dashboard for platform management
  - Modern, emotion-driven UI design
  - Mobile-responsive design

- **Enterprise Features**:
  - Real-time monitoring and alerting
  - Performance optimization and caching
  - Advanced security with rate limiting
  - Scalability with clustering support
  - Business metrics and KPI dashboard
  - Automated testing and CI/CD
  - Infrastructure monitoring
  - Load balancing and auto-scaling
  - Circuit breaker pattern
  - Performance benchmarking

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (or Supabase account)
- Redis (optional, for production caching)

### Installation
```bash
# Clone the repository
git clone https://github.com/Ziyad-Firos/Golf-Charity-Platform.git
cd golf-charity-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start both client and server in development mode
npm run dev

# Or start individually:
npm run dev:client  # Frontend on http://localhost:5173
npm run dev:server  # Backend on http://localhost:3001

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Format code
npm run format
```

### Database Setup
1. Create a Supabase project
2. Run migrations in Supabase SQL editor:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_seed_plans.sql`
   - `migrations/003_performance_indexes.sql`
3. Update `DATABASE_URL` in your `.env` file

### Environment Variables
```bash
# Core Configuration
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
BCRYPT_COST=12
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Monitoring
MONITORING_ENABLED=true
ALERTING_ENABLED=true
LOG_LEVEL=info

# Caching
CACHING_ENABLED=true
CACHE_STRATEGY=memory
CACHE_TTL=300000

# Production (optional)
CLUSTERING_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Project Structure
```
golf-charity-platform/
  client/                 # React frontend
    src/
      components/          # Reusable components
      pages/              # Page components
      store/              # Zustand state management
      lib/                # Utilities and API client
  server/                 # Node.js backend
    src/
      routes/             # API endpoints
      middleware/          # Auth and security middleware
      db/                 # Database connection and migrations
      utils/               # Utility functions
      config/              # Configuration management
      monitoring/          # Monitoring and alerting
      tests/               # Test suites
  migrations/             # Database schema
  docs/                   # Documentation
  .github/                # GitHub workflows and templates
```

## API Documentation

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/profile` - Get extended user profile

### Subscriptions
- `GET /api/subscriptions/plans` - Get available plans
- `POST /api/subscriptions/create-checkout-session` - Create Stripe session
- `GET /api/subscriptions/status` - Get subscription status
- `PUT /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Cancel subscription

### Scores
- `GET /api/scores` - Get user scores
- `POST /api/scores` - Add new score
- `PUT /api/scores/:id` - Update score
- `DELETE /api/scores/:id` - Delete score
- `GET /api/scores/leaderboard` - Get monthly leaderboard

### Draws
- `GET /api/draws/current` - Get current draw
- `GET /api/draws/history` - Get draw history
- `GET /api/draws/:id` - Get draw details
- `POST /api/draws/publish` - Publish new draw (admin)

### Charities
- `GET /api/charities` - Get charities list
- `POST /api/charities` - Create charity (admin)
- `PUT /api/charities/:id` - Update charity (admin)

### Monitoring
- `GET /api/health` - Health check
- `GET /api/health/database` - Database health
- `GET /api/metrics` - Performance metrics
- `GET /api/alerts` - System alerts

## Testing

### Test Suite
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test files
npm test auth.test.ts
npm test performance.test.ts
```

### Test Categories
- **Unit Tests**: Individual function and component tests
- **Integration Tests**: API endpoint and database tests
- **E2E Tests**: Full user journey tests
- **Performance Tests**: Load testing and benchmarking
- **Security Tests**: Security vulnerability tests

### Test Coverage
The application maintains >90% test coverage across all critical components.

## Performance & Monitoring

### Performance Monitoring
- Real-time response time tracking
- Memory usage monitoring
- Database query performance
- Cache hit rate analysis
- Error rate tracking

### Business Metrics
- User engagement metrics
- Revenue analytics
- Subscription conversion rates
- Churn analysis
- Customer lifetime value

### Alerting
- Automated alert system with severity levels
- Threshold-based notifications
- Performance regression detection
- System health monitoring

### Benchmarking
```bash
# Run performance benchmarks
npm run benchmark

# Run load tests
npm run load-test

# Compare with baseline
npm run benchmark:compare
```

## Security

### Security Features
- JWT token authentication with refresh tokens
- Rate limiting with configurable thresholds
- Input sanitization and validation
- SQL injection protection
- XSS protection
- CSRF protection
- Security headers (HSTS, CSP, etc.)
- Password hashing with bcrypt

### Security Monitoring
- Failed login attempt tracking
- Suspicious activity detection
- Security event logging
- Automated security alerts

## Deployment

### Production Deployment
```bash
# Build for production
npm run build

# Start production server
npm start

# Run with clustering
npm run cluster
```

### Environment Setup
1. **Development**: Local development with hot reload
2. **Staging**: Pre-production testing environment
3. **Production**: Live environment with full monitoring

### Deployment Options
- **Vercel**: Serverless deployment (recommended)
- **Docker**: Containerized deployment
- **Traditional**: VPS or dedicated server
- **Cloud**: AWS, Google Cloud, Azure

### CI/CD Pipeline
- Automated testing on pull requests
- Code quality checks
- Security scanning
- Automated deployment to staging
- Manual approval for production

## Scaling & Performance

### Horizontal Scaling
- Multi-process clustering
- Load balancing support
- Database connection pooling
- Read replica support
- Auto-scaling configuration

### Caching Strategy
- In-memory caching for frequently accessed data
- Redis support for distributed caching
- Cache invalidation strategies
- Cache warming utilities

### Database Optimization
- Connection pooling
- Query optimization
- Index management
- Performance monitoring
- Backup and recovery

## Monitoring & Observability

### Health Checks
- Application health endpoints
- Database connectivity checks
- External service monitoring
- System resource monitoring

### Metrics Collection
- Application metrics (response time, throughput)
- Business metrics (user activity, revenue)
- Infrastructure metrics (CPU, memory, disk)
- Error tracking and alerting

### Logging
- Structured logging with JSON format
- Log levels and filtering
- Log aggregation support
- Security event logging

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Run linting and formatting
7. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Conventional commits for commit messages
- Comprehensive test coverage

### Review Process
- Automated checks on pull requests
- Code review by maintainers
- Security review for sensitive changes
- Performance review for optimization changes

## Support

### Documentation
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Guidelines](./docs/SECURITY.md)

### Community
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Wiki for additional documentation
- Roadmap for upcoming features

### Enterprise Support
For enterprise support, custom development, or consulting services, please contact the maintainers.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with modern web technologies and best practices
- Comprehensive testing and monitoring
- Enterprise-grade security and scalability
- Community-driven development approach

---

**Version**: 2.0.0 (Enterprise Edition)  
**Last Updated**: 2024-01-15  
**Maintainers**: Golf Charity Platform Team
