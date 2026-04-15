import { useState, useEffect, useCallback } from 'react';
import { AxiosRequestConfig } from 'axios';
import api from '../lib/api';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (config?: AxiosRequestConfig) => Promise<T>;
  reset: () => void;
}

export const useApi = <T = any>(
  config: AxiosRequestConfig,
  options: UseApiOptions<T> = {}
): UseApiResult<T> => {
  const { immediate = false, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (overrideConfig?: AxiosRequestConfig) => {
    try {
      setLoading(true);
      setError(null);
      
      const finalConfig = { ...config, ...overrideConfig };
      const response = await api(finalConfig);
      
      setData(response.data);
      onSuccess?.(response.data);
      
      return response.data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [config, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, execute, reset };
};

export const useApiMutation = <T = any, V = any>(
  config: AxiosRequestConfig,
  options: UseApiOptions<T> = {}
) => {
  const { onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables?: V) => {
    try {
      setLoading(true);
      setError(null);
      
      const finalConfig = { ...config, data: variables };
      const response = await api(finalConfig);
      
      setData(response.data);
      onSuccess?.(response.data);
      
      return response.data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [config, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return { data, loading, error, mutate, reset };
};
