import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// For production, ensure we have the full URL
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser environment
    const origin = window.location.origin;
    return API_BASE_URL.startsWith('http') ? API_BASE_URL : `${origin}${API_BASE_URL}`;
  }
  return API_BASE_URL;
};

// Retry logic
const retryRequest = async (
  config: AxiosRequestConfig,
  retriesLeft: number = MAX_RETRIES
): Promise<AxiosResponse> => {
  try {
    return await axios(config);
  } catch (error: any) {
    // Don't retry on 4xx errors (except 429 - too many requests)
    if (error.response?.status >= 400 && error.response?.status !== 429) {
      throw error;
    }
    
    if (retriesLeft <= 0) {
      throw error;
    }
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    
    return retryRequest(config, retriesLeft - 1);
  }
};

const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor with retry logic
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-storage');
  if (token) {
    try {
      const authData = JSON.parse(token);
      if (authData.state?.token) {
        config.headers.Authorization = `Bearer ${authData.state.token}`;
      }
    } catch (error) {
      console.error('Error parsing auth token:', error);
    }
  }
  
  // Add request timestamp for performance monitoring
  config.metadata = { startTime: performance.now() };
  
  return config;
});

// Response interceptor with error handling and performance monitoring
api.interceptors.response.use(
  (response) => {
    // Log performance metrics
    const duration = performance.now() - response.config.metadata?.startTime;
    if (duration > 1000) {
      console.warn(`Slow API response: ${duration.toFixed(2)}ms for ${response.config.url}`);
    }
    
    return response;
  },
  async (error) => {
    // Handle 401 errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    
    // Handle network errors with retry
    if (!error.response && error.code === 'NETWORK_ERROR') {
      try {
        return await retryRequest(error.config);
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
    
    // Log detailed error information
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    
    return Promise.reject(error);
  }
);

// Add type for axios config metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

export default api;
