import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';

interface Draw {
  id: string;
  draw_month: string;
  draw_numbers: number[];
  prize_pool_total: number;
  tier_5_amount: number;
  tier_4_amount: number;
  tier_3_amount: number;
  active_subscriber_count: number;
  status: string;
  published_at: string;
}

const DrawsPage: React.FC = () => {
  const [currentDraw, setCurrentDraw] = useState<Draw | null>(null);
  const [drawHistory, setDrawHistory] = useState<Draw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDrawData = async () => {
      try {
        const [currentResponse, historyResponse] = await Promise.all([
          api.get('/draws/current'),
          api.get('/draws/history')
        ]);
        
        setCurrentDraw(currentResponse.data);
        setDrawHistory(historyResponse.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load draw data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrawData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Monthly Prize Draws
          </h1>
          <p className="text-xl text-gray-600">
            Win exciting prizes while supporting charities
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {currentDraw && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-8 mb-12"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-6">Current Draw</h2>
              
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div>
                  <p className="text-purple-100 text-sm mb-2">Draw Numbers</p>
                  <div className="flex justify-center space-x-2">
                    {currentDraw.draw_numbers.map((number, index) => (
                      <div key={index} className="w-12 h-12 bg-white text-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
                        {number}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-purple-100 text-sm mb-2">Prize Pool</p>
                  <p className="text-3xl font-bold">
                    £{(currentDraw.prize_pool_total / 100).toFixed(2)}
                  </p>
                </div>
                
                <div>
                  <p className="text-purple-100 text-sm mb-2">Participants</p>
                  <p className="text-3xl font-bold">
                    {currentDraw.active_subscriber_count}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-purple-100 text-sm mb-1">5 Number Match</p>
                  <p className="text-xl font-bold">£{(currentDraw.tier_5_amount / 100).toFixed(2)}</p>
                  <p className="text-purple-100 text-xs">Jackpot Prize</p>
                </div>
                
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-purple-100 text-sm mb-1">4 Number Match</p>
                  <p className="text-xl font-bold">£{(currentDraw.tier_4_amount / 100).toFixed(2)}</p>
                  <p className="text-purple-100 text-xs">Major Prize</p>
                </div>
                
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-purple-100 text-sm mb-1">3 Number Match</p>
                  <p className="text-xl font-bold">£{(currentDraw.tier_3_amount / 100).toFixed(2)}</p>
                  <p className="text-purple-100 text-xs">Minor Prize</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-purple-100 text-sm mb-2">
                  Draw Date: {new Date(currentDraw.draw_month).toLocaleDateString()}
                </p>
                <p className="text-purple-100 text-sm">
                  Status: <span className="font-semibold capitalize">{currentDraw.status}</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Draw History</h3>
          
          {drawHistory.length > 0 ? (
            <div className="space-y-4">
              {drawHistory.slice(0, 6).map((draw) => (
                <div key={draw.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(draw.draw_month).toLocaleDateString('en-US', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        Numbers: {draw.draw_numbers.join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-purple-600">
                        £{(draw.prize_pool_total / 100).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {draw.active_subscriber_count} participants
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">
                No draw history available yet
              </p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 bg-gradient-to-r from-purple-100 to-pink-100 p-8 rounded-2xl text-center"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            How to Participate
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-3">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Subscribe</h3>
              <p className="text-gray-600 text-sm">
                Choose a subscription plan to enter the monthly draws
              </p>
            </div>
            
            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-3">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Enter Scores</h3>
              <p className="text-gray-600 text-sm">
                Add your golf scores to be eligible for prize draws
              </p>
            </div>
            
            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-3">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Win Prizes</h3>
              <p className="text-gray-600 text-sm">
                Match numbers to win cash prizes while supporting charity
              </p>
            </div>
          </div>
          
          <a
            href="/subscribe"
            className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            Subscribe to Enter Draws
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DrawsPage;
