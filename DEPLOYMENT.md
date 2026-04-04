# Golf Charity Platform - Deployment Guide

## Overview
This guide covers deploying the Golf Charity Platform to production using Vercel (frontend) and Supabase (database).

## Prerequisites
- Node.js 18+ installed
- Vercel account
- Supabase account
- Stripe account (for payments)

## Environment Variables

### Client (.env)
```
VITE_API_URL=https://your-api-url.vercel.app
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key
```

### Server (.env)
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key
CLIENT_URL=https://your-domain.vercel.app
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## Deployment Steps

### 1. Database Setup (Supabase)
1. Create new Supabase project
2. Run migrations in Supabase SQL editor:
   - `001_initial_schema.sql`
   - `002_seed_plans.sql`
3. Enable Row Level Security (RLS)
4. Get connection string from Supabase settings

### 2. Frontend Deployment (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Set build command: `npm run build`
4. Set output directory: `client/dist`
5. Deploy

### 3. Backend Deployment (Vercel Serverless)
1. Create `vercel.json` in root:
```json
{
  "functions": {
    "server/src/index.ts": {
      "runtime": "@vercel/node"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/server/src/index.ts"
    }
  ]
}
```

### 4. Stripe Configuration
1. Set up webhook endpoints:
   - `https://your-domain.vercel.app/api/webhooks/stripe`
2. Configure webhook events:
   - checkout.session.completed
   - invoice.payment_succeeded
   - customer.subscription.deleted

## Testing Checklist

### Pre-deployment
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Stripe webhooks configured
- [ ] CORS settings correct

### Post-deployment
- [ ] User registration works
- [ ] Login/logout functionality
- [ ] Subscription flow with Stripe
- [ ] Score entry and management
- [ ] Draw engine functioning
- [ ] Admin dashboard accessible
- [ ] Charity pages load correctly

## Monitoring
- Use Vercel Analytics for frontend metrics
- Use Supabase Dashboard for database monitoring
- Set up error logging (Sentry recommended)

## Scaling Considerations
- Database: Supabase auto-scales, monitor query performance
- API: Vercel serverless functions scale automatically
- CDN: Vercel provides global CDN
- Consider Redis for caching if needed

## Security
- HTTPS enforced by Vercel
- JWT tokens with proper expiration
- Stripe handles PCI compliance
- Enable Supabase RLS for data security
- Rate limiting on API endpoints

## Backup Strategy
- Supabase provides automatic backups
- Export regular database dumps
- Version control for code recovery
- Document all manual configurations
