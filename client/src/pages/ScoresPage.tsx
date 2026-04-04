import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

const scoreSchema = z.object({
  stablefordScore: z.number().min(1, 'Score must be between 1 and 45').max(45, 'Score must be between 1 and 45'),
  playedOn: z.string().min(1, 'Date is required'),
});

type ScoreFormData = z.infer<typeof scoreSchema>;

interface Score {
  id: string;
  stableford_score: number;
  played_on: string;
  created_at: string;
}

const ScoresPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [scores, setScores] = useState<Score[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingScore, setEditingScore] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<ScoreFormData>({
    resolver: zodResolver(scoreSchema),
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchScores = async () => {
      try {
        const response = await api.get('/scores');
        setScores(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load scores');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScores();
  }, [isAuthenticated]);

  const onSubmit = async (data: ScoreFormData) => {
    try {
      setIsSubmitting(true);
      setError('');
      
      if (editingScore) {
        await api.put(`/scores/${editingScore}`, data);
        setEditingScore(null);
      } else {
        await api.post('/scores', data);
      }
      
      reset();
      
      const response = await api.get('/scores');
      setScores(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save score');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (score: Score) => {
    setEditingScore(score.id);
    setValue('stablefordScore', score.stableford_score);
    setValue('playedOn', score.played_on.split('T')[0]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this score?')) return;
    
    try {
      await api.delete(`/scores/${id}`);
      setScores(scores.filter(score => score.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete score');
    }
  };

  const cancelEdit = () => {
    setEditingScore(null);
    reset();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to manage scores</h2>
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {editingScore ? 'Edit Score' : 'Add New Score'}
          </h1>
          <p className="text-gray-600">
            Enter your Stableford score (1-45). Only your last 5 scores are retained.
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white p-6 rounded-xl shadow-lg mb-8"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stableford Score
                </label>
                <input
                  {...register('stablefordScore', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="45"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter score (1-45)"
                />
                {errors.stablefordScore && (
                  <p className="mt-1 text-sm text-red-600">{errors.stablefordScore.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Played
                </label>
                <input
                  {...register('playedOn')}
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                />
                {errors.playedOn && (
                  <p className="mt-1 text-sm text-red-600">{errors.playedOn.message}</p>
                )}
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : (editingScore ? 'Update Score' : 'Add Score')}
              </button>
              
              {editingScore && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Scores</h3>
          
          {scores.length > 0 ? (
            <div className="space-y-3">
              {scores.map((score) => (
                <div key={score.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      Stableford Score: <span className="text-purple-600 font-bold">{score.stableford_score}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Played on {new Date(score.played_on).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(score)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(score.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No scores recorded yet</p>
              <p className="text-sm text-gray-500">
                Add your first score to start tracking your golf performance
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ScoresPage;
