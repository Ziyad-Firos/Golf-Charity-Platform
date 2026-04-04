import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

const charitySchema = z.object({
  name: z.string().min(1, 'Charity name is required'),
  description: z.string().min(1, 'Description is required'),
});

type CharityFormData = z.infer<typeof charitySchema>;

const drawSchema = z.object({
  drawMonth: z.string().min(1, 'Draw month is required'),
  drawMode: z.enum(['random', 'algorithmic']),
  drawNumbers: z.array(z.number()).min(5).max(5),
  prizePoolTotal: z.number().min(0, 'Prize pool total is required'),
});

type DrawFormData = z.infer<typeof drawSchema>;

interface Charity {
  id: string;
  name: string;
  description: string;
  image_urls: string[];
  is_featured: boolean;
  is_active: boolean;
}

interface Draw {
  id: string;
  draw_month: string;
  draw_numbers: number[];
  prize_pool_total: number;
  status: string;
  active_subscriber_count: number;
}

const AdminPage: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'charities' | 'draws'>('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscribers: 0,
    totalPrizePool: 0,
    totalCharityContributions: 0,
  });
  const [users, setUsers] = useState([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const {
    register: registerCharity,
    handleSubmit: handleSubmitCharity,
    reset: resetCharity,
  } = useForm<CharityFormData>({
    resolver: zodResolver(charitySchema),
  });

  const {
    register: registerDraw,
    handleSubmit: handleSubmitDraw,
    reset: resetDraw,
  } = useForm<DrawFormData>({
    resolver: zodResolver(drawSchema),
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    
    const fetchData = async () => {
      try {
        const [usersResponse, charitiesResponse, drawsResponse] = await Promise.all([
          api.get('/admin/users'),
          api.get('/charities'),
          api.get('/draws/history')
        ]);
        
        setUsers(usersResponse.data);
        setCharities(charitiesResponse.data);
        setDraws(drawsResponse.data);
        
        setStats({
          totalUsers: usersResponse.data.length,
          activeSubscribers: usersResponse.data.filter((u: any) => u.subscription_state === 'active').length,
          totalPrizePool: drawsResponse.data.reduce((sum: number, draw: any) => sum + (draw.prize_pool_total || 0), 0),
          totalCharityContributions: 0, // Would need separate endpoint
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load admin data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, user]);

  const onCharitySubmit = handleSubmitCharity(async (data: CharityFormData) => {
    console.log('Charity data:', data);
    try {
      await api.post('/charities', data);
      resetCharity();
      const response = await api.get('/charities');
      setCharities(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create charity');
    }
  });

  const onDrawSubmit = handleSubmitDraw(async (data: DrawFormData) => {
    try {
      await api.post('/draws/publish', data);
      resetDraw();
      const response = await api.get('/draws/history');
      setDraws(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to publish draw');
    }
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">Admin access required</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Manage the Golf Charity Platform</p>
          </div>

          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-5 gap-2 mb-8">
            {['overview', 'users', 'charities', 'draws'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid md:grid-cols-4 gap-6"
            >
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Users</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.totalUsers}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Subscribers</h3>
                <p className="text-3xl font-bold text-green-600">{stats.activeSubscribers}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Prize Pool</h3>
                <p className="text-3xl font-bold text-blue-600">£{(stats.totalPrizePool / 100).toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Charity Contributions</h3>
                <p className="text-3xl font-bold text-pink-600">£{(stats.totalCharityContributions / 100).toFixed(2)}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">User Management</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.slice(0, 10).map((user: any) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.subscription_state === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.subscription_state}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-indigo-600 hover:text-indigo-900">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'charities' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Charity</h2>
                <form onSubmit={onCharitySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Charity Name</label>
                    <input
                      {...registerCharity('name')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      {...registerCharity('description')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add Charity
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Existing Charities</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {charities.map((charity) => (
                    <div key={charity.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900">{charity.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{charity.description}</p>
                      <div className="mt-3 flex space-x-2">
                        <button className="text-sm text-blue-600 hover:text-blue-900">Edit</button>
                        <button className="text-sm text-red-600 hover:text-red-900">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'draws' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Draw</h2>
                <form onSubmit={onDrawSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Draw Month</label>
                      <input
                        {...registerDraw('drawMonth')}
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Draw Mode</label>
                      <select
                        {...registerDraw('drawMode')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="random">Random</option>
                        <option value="algorithmic">Algorithmic</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Draw Numbers (5 numbers)</label>
                    <input
                      {...registerDraw('drawNumbers', { valueAsNumber: true })}
                      type="text"
                      placeholder="e.g., 5,12,23,34,45"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prize Pool Total (£)</label>
                    <input
                      {...registerDraw('prizePoolTotal', { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Publish Draw
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Draw History</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numbers</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prize Pool</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {draws.map((draw) => (
                        <tr key={draw.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(draw.draw_month).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {draw.draw_numbers.join(', ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            £{(draw.prize_pool_total / 100).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              draw.status === 'published' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {draw.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminPage;
