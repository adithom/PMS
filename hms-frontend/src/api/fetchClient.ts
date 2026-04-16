// src/api/fetchClient.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

class ApiError extends Error {
  status?: number;
  response?: any;

  constructor(message: string, status?: number, response?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

const buildOptions = (method: string, body?: any): RequestInit => {
  const token = localStorage.getItem('accessToken');
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
};

const fetchApi = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, options);

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    let data: any;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch {
      data = null;
    }

    if (!response.ok) {
      // Auto-logout on expired/invalid token
      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }

      const errorMessage = data?.message || data?.error || `HTTP ${response.status}`;

      console.error(`API Error [${response.status}]:`, errorMessage);

      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Network error:', error);
    throw new Error(`Network error: ${(error as Error).message}`);
  }
};

const api = {
  get: <T>(endpoint: string, params?: Record<string, any>): Promise<T> => {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v != null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return fetchApi<T>(endpoint + queryString, buildOptions('GET'));
  },

  post: <T>(endpoint: string, body?: any): Promise<T> => {
    return fetchApi<T>(endpoint, buildOptions('POST', body));
  },

  put: <T>(endpoint: string, body?: any): Promise<T> => {
    return fetchApi<T>(endpoint, buildOptions('PUT', body));
  },

  patch: <T>(endpoint: string, body?: any): Promise<T> => {
    return fetchApi<T>(endpoint, buildOptions('PATCH', body));
  },

  delete: <T>(endpoint: string): Promise<T> => {
    return fetchApi<T>(endpoint, buildOptions('DELETE'));
  },
};

export default api;
export { ApiError };