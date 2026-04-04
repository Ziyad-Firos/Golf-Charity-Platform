import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const HomePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
        >
          Transform Your Golf Game Into
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
            Meaningful Change
          </span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto"
        >
          Join a community where your passion for golf supports incredible charities. 
          Track your scores, compete in monthly draws, and make a difference.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            to="/register"
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
          >
            Start Your Journey
          </Link>
          <Link
            to="/charities"
            className="px-8 py-4 bg-white text-purple-600 font-semibold rounded-lg border-2 border-purple-600 hover:bg-purple-50 transition-all"
          >
            Explore Charities
          </Link>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {[
          {
            title: 'Track Your Progress',
            description: 'Enter your Stableford scores and watch your game improve over time.',
            icon: '📊'
          },
          {
            title: 'Win Monthly Prizes',
            description: 'Participate in our draw system and win exciting rewards.',
            icon: '🏆'
          },
          {
            title: 'Support Charities',
            description: 'A portion of your subscription goes to causes you care about.',
            icon: '❤️'
          }
        ].map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
            className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="text-4xl mb-4">{feature.icon}</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600">{feature.description}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="bg-gradient-to-r from-purple-100 to-pink-100 p-8 rounded-2xl text-center"
      >
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to Make a Difference?
        </h2>
        <p className="text-lg text-gray-700 mb-6">
          Join thousands of golfers who are turning their passion into positive impact.
        </p>
        <Link
          to="/register"
          className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
        >
          Get Started Today
        </Link>
      </motion.div>
    </div>
  );
};

export default HomePage;
