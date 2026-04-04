import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';

interface Charity {
  id: string;
  name: string;
  description: string;
  image_urls: string[];
  is_featured: boolean;
  events: Array<{
    title: string;
    event_date: string;
    description: string;
  }>;
}

const CharitiesPage: React.FC = () => {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCharities = async () => {
      try {
        const response = await api.get('/charities');
        setCharities(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load charities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharities();
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
            Our Partner Charities
          </h1>
          <p className="text-xl text-gray-600">
            Support amazing causes making a difference in communities
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {charities.map((charity, index) => (
            <motion.div
              key={charity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`bg-white rounded-xl shadow-lg overflow-hidden ${
                charity.is_featured ? 'ring-2 ring-purple-600' : ''
              }`}
            >
              {charity.is_featured && (
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 text-sm font-medium">
                  Featured Charity
                </div>
              )}
              
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {charity.name}
                </h3>
                
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {charity.description}
                </p>

                {charity.events && charity.events.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Upcoming Events</h4>
                    <div className="space-y-2">
                      {charity.events.slice(0, 2).map((event, eventIndex) => (
                        <div key={eventIndex} className="text-sm">
                          <p className="font-medium text-purple-600">{event.title}</p>
                          <p className="text-gray-600">
                            {new Date(event.event_date).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button className="flex-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors">
                    Learn More
                  </button>
                  <button className="flex-1 px-4 py-2 border border-purple-600 text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors">
                    Support
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {charities.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              No charities are currently available.
            </p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 bg-gradient-to-r from-purple-100 to-pink-100 p-8 rounded-2xl text-center"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Want to make a difference?
          </h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            When you subscribe to the Golf Charity Platform, a portion of your subscription 
            goes directly to the charity of your choice. Join thousands of golfers who are 
            turning their passion into positive impact.
          </p>
          <a
            href="/subscribe"
            className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            Subscribe & Support
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default CharitiesPage;
