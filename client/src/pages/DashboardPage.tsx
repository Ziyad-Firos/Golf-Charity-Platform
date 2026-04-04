import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/auth';
import api from '../lib/api';

interface Score {
  id: string;
  stableford_score: number;
  played_on: string;
  created_at: string;
}

interface DashboardData {
  subscriptionState: string;
  scores: Score[];
  charityContribution: number;
}

const DashboardPage: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchDashboardData = async () => {
      try {
        const [profileResponse, scoresResponse] = await Promise.all([
          api.get('/auth/profile'),
          api.get('/scores')
        ]);
        
        setDashboardData({
          subscriptionState: profileResponse.data.subscriptionState,
          scores: scoresResponse.data,
          charityContribution: profileResponse.data.charityContributionPct || 10
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to access your dashboard</h2>
          <a href="/login" className="text-purple-600 hover:text-purple-500">Go to login</a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-600">
            Here's your golf performance and charity impact overview
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white p-6 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Subscription Status</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                dashboardData?.subscriptionState === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {dashboardData?.subscriptionState || 'Unknown'}
              </span>
            </div>
            <p className="text-gray-600 text-sm">
              {dashboardData?.subscriptionState === 'active' 
                ? 'You\'re actively contributing to charity and eligible for draws'
                : 'Subscribe to participate in draws and support charities'
              }
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white p-6 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Charity Impact</h3>
              <span className="text-2xl">❤️</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mb-2">
              {dashboardData?.charityContribution}%
            </p>
            <p className="text-gray-600 text-sm">
              of your subscription goes to charity
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white p-6 rounded-xl shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Score Entries</h3>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mb-2">
              {dashboardData?.scores.length || 0}
            </p>
            <p className="text-gray-600 text-sm">
              scores on record (last 5 retained)
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Scores</h3>
          {dashboardData?.scores && dashboardData.scores.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.scores.map((score) => (
                <div key={score.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Stableford Score: {score.stableford_score}</p>
                    <p className="text-sm text-gray-600">
                      Played on {new Date(score.played_on).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                      score.stableford_score >= 36 ? 'bg-green-100 text-green-800' :
                      score.stableford_score >= 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {score.stableford_score >= 36 ? 'Excellent' :
                       score.stableford_score >= 30 ? 'Good' : 'Needs Practice'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No scores recorded yet</p>
              <a
                href="/scores"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Add Your First Score
              </a>
            </div>
          )}
        </motion.div>

        {dashboardData?.subscriptionState !== 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-xl"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to unlock full features?</h3>
            <p className="text-gray-700 mb-4">
              Subscribe to participate in monthly draws, track your scores, and support amazing charities.
            </p>
            <a
              href="/subscribe"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Subscribe Now
            </a>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default DashboardPage;
