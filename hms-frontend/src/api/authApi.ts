// src/api/authApi.ts
import api from './fetchClient';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  role: string;
  properties: Array<{
    id: string;
    name: string;
  }>;
  posLocationId?: string;
  posLocationName?: string;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  properties: Array<{
    id: string;
    name: string;
  }>;
  posLocationId?: string;
  posLocationName?: string;
}

const authApi = {
  login: (credentials: LoginRequest) => 
    api.post<AuthResponse>('/auth/login', credentials),
  
  getCurrentUser: () => 
    api.get<UserInfo>('/auth/me'),
  
  logout: () => {
    localStorage.removeItem('accessToken');
  }
};

export default authApi;