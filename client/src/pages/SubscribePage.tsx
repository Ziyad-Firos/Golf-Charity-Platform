import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

interface Plan {
  id: string;
  name: string;
  price_pence: number;
  interval: string;
  stripe_price_id: string;
  active: boolean;
}

interface Charity {
  id: string;
  name: string;
  description: string;
  is_featured: boolean;
}

const SubscribePage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedCharity, setSelectedCharity] = useState<string>('');
  const [charityContribution, setCharityContribution] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansResponse, charitiesResponse] = await Promise.all([
          api.get('/subscriptions/plans'),
          api.get('/charities')
        ]);
        
        setPlans(plansResponse.data);
        setCharities(charitiesResponse.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load data');
      }
    };

    fetchData();
  }, []);

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      setError('Please select a plan');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const response = await api.post('/subscriptions/create-checkout-session', {
        priceId: selectedPlan.stripe_price_id,
        charityId: selectedCharity || undefined,
        charityContributionPct: charityContribution
      });
      
      alert('In production, this would redirect to Stripe checkout. For demo: ' + JSON.stringify(response.data));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create checkout session');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to subscribe</h2>
          <a href="/login" className="text-purple-600 hover:text-purple-500">Go to login</a>
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Support amazing charities while tracking your golf progress
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: plans.indexOf(plan) * 0.1 }}
              className={`relative bg-white p-8 rounded-xl shadow-lg cursor-pointer transition-all ${
                selectedPlan?.id === plan.id 
                  ? 'ring-2 ring-purple-600 shadow-xl' 
                  : 'hover:shadow-xl'
              }`}
              onClick={() => setSelectedPlan(plan)}
            >
              {plan.name === 'yearly' && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-sm font-medium">
                  Best Value
                </div>
              )}
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2 capitalize">
                {plan.name}
              </h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-purple-600">
                  £{(plan.price_pence / 100).toFixed(2)}
                </span>
                <span className="text-gray-600">/{plan.interval === 'month' ? 'month' : 'year'}</span>
              </div>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Track up to 5 golf scores
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Enter monthly prize draws
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Support chosen charities
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Performance analytics
                </li>
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white p-8 rounded-xl shadow-lg mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Choose Your Charity Impact</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Charity (Optional)
              </label>
              <select
                value={selectedCharity}
                onChange={(e) => setSelectedCharity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">No specific charity</option>
                {charities.map((charity) => (
                  <option key={charity.id} value={charity.id}>
                    {charity.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Charity Contribution: {charityContribution}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={charityContribution}
                onChange={(e) => setCharityContribution(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={handleSubscribe}
            disabled={!selectedPlan || isLoading}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {isLoading ? 'Processing...' : 'Subscribe Now'}
          </button>
          <p className="mt-4 text-sm text-gray-600">
            Secure payment powered by Stripe. Cancel anytime.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default SubscribePage;
