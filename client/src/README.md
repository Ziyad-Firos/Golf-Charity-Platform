# Golf Charity Platform - Client

## Overview

This is the React frontend for the Golf Charity Platform, a subscription-driven web application that combines golf performance tracking, charity fundraising, and a monthly draw-based reward engine.

## Architecture

### Technology Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Zustand** for state management
- **React Query** for server state
- **React Hook Form** with Zod validation
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Axios** for API communication

### Project Structure

```
src/
  components/          # Reusable UI components
    ErrorBoundary.tsx  # Error handling component
    LoadingSpinner.tsx # Loading indicator
    LoadingBoundary.tsx # Suspense wrapper
    Layout.tsx         # Main layout component
  pages/              # Route components
    HomePage.tsx       # Landing page
    LoginPage.tsx      # Authentication
    RegisterPage.tsx   # User registration
    DashboardPage.tsx  # User dashboard
    ScoresPage.tsx     # Score tracking
    CharitiesPage.tsx  # Charity listings
    DrawsPage.tsx      # Monthly draws
    AdminPage.tsx      # Admin interface
  hooks/              # Custom React hooks
    useApi.ts          # API request hook
    useApiMutation.ts  # API mutation hook
  lib/                # Utility libraries
    api.ts             # Axios configuration
  store/              # State management
    auth.ts            # Authentication state
  schemas/            # Validation schemas
    auth.schema.ts     # Form validation
  utils/              # Utility functions
    performance.ts     # Performance monitoring
  tests/              # Test setup and utilities
    setup.ts           # Test configuration
```

## Key Features

### Error Handling
- **React Error Boundaries** catch and handle component errors
- **API Error Handling** with retry logic and detailed logging
- **User-Friendly Error Messages** with recovery options

### Performance
- **Performance Monitoring** tracks API response times and render performance
- **Lazy Loading** with React Suspense
- **Optimized API Calls** with request deduplication and caching
- **Memory Usage Tracking** for development optimization

### Security
- **Input Validation** with Zod schemas
- **XSS Protection** through React's built-in sanitization
- **CSRF Protection** via same-site cookies
- **Secure Token Storage** in localStorage with expiration

### Developer Experience
- **TypeScript** for type safety
- **Hot Module Replacement** for fast development
- **Comprehensive Error Logging** for debugging
- **Component Reusability** with consistent patterns
- **Environment Configuration** for different deployment stages

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### Environment Variables
Copy `.env.example` to `.env.local` and configure:
```bash
cp .env.example .env.local
```

Required variables:
- `VITE_API_URL` - Backend API URL
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## API Integration

### Authentication
The app uses JWT tokens for authentication:
- Access tokens stored in Zustand state
- Refresh tokens in HTTP-only cookies
- Automatic token refresh on API calls

### Error Handling
API errors are handled through:
- Axios interceptors for 401 redirects
- Retry logic for network failures
- User-friendly error messages
- Performance monitoring for slow responses

## Testing

### Unit Tests
```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch
```

### Test Utilities
- `createMockUser()` - Generate test user data
- `createMockApiResponse()` - Mock API responses
- `waitFor()` - Async test utilities

## Performance

### Monitoring
- API response time tracking
- Component render performance
- Memory usage monitoring
- Bundle size optimization

### Optimization Techniques
- Code splitting with dynamic imports
- Image lazy loading
- API request deduplication
- Component memoization

## Deployment

### Build Process
```bash
# Production build
npm run build

# Preview build
npm run preview
```

### Environment Configuration
- Development: Local development with hot reload
- Staging: Pre-production testing
- Production: Optimized build with minification

## Contributing

### Code Standards
- TypeScript strict mode enabled
- ESLint and Prettier configured
- Component naming conventions
- File organization patterns

### Best Practices
- Error boundaries for all major components
- Loading states for async operations
- Proper TypeScript types
- Comprehensive error logging

## Security Considerations

### Frontend Security
- Input validation and sanitization
- XSS protection through React
- Secure token handling
- HTTPS enforcement in production

### API Security
- Request rate limiting
- CORS configuration
- Token-based authentication
- Error message sanitization

## Monitoring and Observability

### Performance Metrics
- Page load times
- API response times
- Component render times
- Memory usage

### Error Tracking
- Component error boundaries
- API error logging
- User interaction errors
- Performance warnings

## Future Enhancements

### Planned Features
- Progressive Web App (PWA) support
- Offline functionality
- Push notifications
- Advanced analytics

### Technical Improvements
- Server-side rendering (SSR)
- Micro-frontend architecture
- Advanced caching strategies
- Real-time updates
