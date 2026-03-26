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

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  role: string;
  propertyIds?: string[];
  posLocationId?: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  role: string;
  propertyIds: string[];
  posLocationId?: string | null;
}

const authApi = {
  login: (credentials: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', credentials),

  getCurrentUser: () =>
    api.get<UserInfo>('/auth/me'),

  register: (data: CreateUserRequest) =>
    api.post<AuthResponse>('/auth/register', data),

  listUsers: () =>
    api.get<UserInfo[]>('/auth/users'),

  updateUser: (id: string, data: UpdateUserRequest) =>
    api.put<UserInfo>(`/auth/users/${id}`, data),

  deleteUser: (id: string) =>
    api.delete<void>(`/auth/users/${id}`),

  logout: () => {
    localStorage.removeItem('accessToken');
  }
};

export default authApi;