# Golf Charity Platform - README

## Overview
The Golf Charity Platform is a subscription-driven web application that combines Stableford golf score tracking, a monthly prize draw engine, and charity fundraising. Subscribers pay a recurring fee, enter their golf scores, participate in monthly draws, and direct a portion of their subscription to a charity of their choice.

## Tech Stack
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Supabase
- **Authentication**: JWT tokens
- **Payments**: Stripe
- **Deployment**: Vercel (frontend + serverless functions)

## Features
- ✅ User registration and authentication
- ✅ Subscription management with Stripe integration
- ✅ Golf score tracking (Stableford format, last 5 scores)
- ✅ Monthly prize draws with random/algorithmic selection
- ✅ Charity selection and contribution management
- ✅ Admin dashboard for platform management
- ✅ Modern, emotion-driven UI design
- ✅ Mobile-responsive design

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd golf-charity-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Development
```bash
# Start both client and server in development mode
npm run dev

# Or start individually:
npm run dev:client  # Frontend on http://localhost:5173
npm run dev:server  # Backend on http://localhost:3001
```

### Database Setup
1. Create a Supabase project
2. Run migrations in Supabase SQL editor:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_seed_plans.sql`
3. Update `DATABASE_URL` in your `.env` file

### Environment Variables
See `DEPLOYMENT.md` for complete environment setup guide.

## Project Structure
```
golf-charity-platform/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── store/        # Zustand state management
│   │   └── lib/          # Utilities and API client
├── server/                # Node.js backend
│   └── src/
│       ├── routes/        # API endpoints
│       ├── middleware/     # Auth middleware
│       └── db/           # Database connection
├── migrations/            # Database schema
└── docs/                 # Documentation
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Subscriptions
- `GET /api/subscriptions/plans` - Get available plans
- `POST /api/subscriptions/create-checkout-session` - Create Stripe session
- `GET /api/subscriptions/status` - Get subscription status

### Scores
- `GET /api/scores` - Get user scores
- `POST /api/scores` - Add new score
- `PUT /api/scores/:id` - Update score
- `DELETE /api/scores/:id` - Delete score

### Draws
- `GET /api/draws/current` - Get current draw
- `GET /api/draws/history` - Get draw history
- `POST /api/draws/publish` - Publish new draw (admin)

### Charities
- `GET /api/charities` - Get charities list
- `POST /api/charities` - Create charity (admin)

## Testing
```bash
# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## Deployment
See `DEPLOYMENT.md` for detailed deployment instructions.

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License
This project is licensed under the MIT License.

## Support
For support and questions, please open an issue on GitHub.
