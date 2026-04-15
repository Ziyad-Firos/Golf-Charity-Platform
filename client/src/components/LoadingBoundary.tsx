import React, { Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const LoadingBoundary: React.FC<LoadingBoundaryProps> = ({ 
  children, 
  fallback 
}) => {
  const defaultFallback = (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
};

export default LoadingBoundary;
