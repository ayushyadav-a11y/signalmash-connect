// ===========================================
// Admin Auth Store
// ===========================================

import { create } from 'zustand';

interface Admin {
  id: string;
  email: string;
  name: string;
}

interface AdminAuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const ADMIN_API_URL = import.meta.env.VITE_API_URL || '/api';

export const useAdminStore = create<AdminAuthState>((set, get) => ({
  admin: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${ADMIN_API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      localStorage.setItem('adminAccessToken', data.data.tokens.accessToken);
      localStorage.setItem('adminRefreshToken', data.data.tokens.refreshToken);

      set({
        admin: data.data.admin,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('adminRefreshToken');
    if (refreshToken) {
      try {
        await fetch(`${ADMIN_API_URL}/admin/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore errors during logout
      }
    }

    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminRefreshToken');

    set({
      admin: null,
      isAuthenticated: false,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('adminAccessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const response = await fetch(`${ADMIN_API_URL}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // Try refresh
        const refreshToken = localStorage.getItem('adminRefreshToken');
        if (refreshToken) {
          const refreshResponse = await fetch(`${ADMIN_API_URL}/admin/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            localStorage.setItem('adminAccessToken', refreshData.data.accessToken);
            localStorage.setItem('adminRefreshToken', refreshData.data.refreshToken);

            // Retry with new token
            const retryResponse = await fetch(`${ADMIN_API_URL}/admin/me`, {
              headers: { Authorization: `Bearer ${refreshData.data.accessToken}` },
            });

            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              set({
                admin: retryData.data.admin,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
          }
        }

        throw new Error('Auth failed');
      }

      const data = await response.json();
      set({
        admin: data.data.admin,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRefreshToken');
      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// Admin API helper
class AdminApiClient {
  private getToken(): string | null {
    return localStorage.getItem('adminAccessToken');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${ADMIN_API_URL}/admin${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Settings
  async getSettings() {
    return this.get<{ success: boolean; data: any[] }>('/settings');
  }

  async updateSetting(key: string, value: string, description?: string) {
    return this.put<{ success: boolean; data: any }>(`/settings/${key}`, { value, description });
  }

  // Dashboard
  async getDashboard() {
    return this.get<{ success: boolean; data: any }>('/dashboard');
  }

  // Organizations
  async getOrganizations(page = 1, limit = 20) {
    return this.get<{ success: boolean; data: any[]; meta: any }>(`/organizations?page=${page}&limit=${limit}`);
  }

  // Audit logs
  async getAuditLogs(page = 1, limit = 50) {
    return this.get<{ success: boolean; data: any[]; meta: any }>(`/audit-logs?page=${page}&limit=${limit}`);
  }

  // Setup
  async setup(data: { email: string; password: string; name: string; signalmashApiKey?: string; signalmashApiUrl?: string }) {
    return this.post<{ success: boolean; data: any }>('/setup', data);
  }
}

export const adminApi = new AdminApiClient();
