import app from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// For Vercel deployment
export default app;
