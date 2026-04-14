// ===========================================
// API Client
// ===========================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Try to restore token from localStorage
    this.accessToken = localStorage.getItem('accessToken');
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Set tokens from OAuth callback (SSO flow)
   */
  setTokensFromOAuth(accessToken: string, refreshToken: string) {
    this.setAccessToken(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  /**
   * Get the OAuth URL for a platform
   */
  async initiateOAuth(platform: string) {
    return this.get<{ authUrl: string }>(`/platforms/${platform}/oauth`);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 - token expired
      if (response.status === 401) {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const refreshResponse = await this.refreshToken(refreshToken);
            if (refreshResponse.success && refreshResponse.data) {
              this.setAccessToken(refreshResponse.data.accessToken);
              localStorage.setItem('refreshToken', refreshResponse.data.refreshToken);
              // Retry original request
              return this.request<T>(endpoint, options);
            }
          } catch {
            // Refresh failed, clear tokens
            this.setAccessToken(null);
            localStorage.removeItem('refreshToken');
          }
        }
      }

      throw new ApiError(
        data.error?.message || 'An error occurred',
        data.error?.code || 'UNKNOWN_ERROR',
        response.status,
        data.error?.details
      );
    }

    return data;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.post<{
      user: any;
      organization: any;
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    }>('/auth/login', { email, password });

    if (response.success && response.data) {
      this.setAccessToken(response.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
    }

    return response;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }) {
    const response = await this.post<{
      user: any;
      organization: any;
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    }>('/auth/register', data);

    if (response.success && response.data) {
      this.setAccessToken(response.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
    }

    return response;
  }

  async refreshToken(refreshToken: string) {
    return this.post<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/refresh', { refreshToken });
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await this.post('/auth/logout', { refreshToken });
      } catch {
        // Ignore errors during logout
      }
    }
    this.setAccessToken(null);
    localStorage.removeItem('refreshToken');
  }

  async getMe() {
    return this.get<{ user: any }>('/auth/me');
  }

  // Organization endpoints
  async getOrganization() {
    return this.get<any>('/organization');
  }

  async getOrganizationStats() {
    return this.get<any>('/organization/stats');
  }

  // Brand endpoints
  async getBrands() {
    return this.get<any[]>('/brands');
  }

  async getBrand(id: string) {
    return this.get<any>(`/brands/${id}`);
  }

  async createBrand(data: any) {
    return this.post<any>('/brands', data);
  }

  async updateBrand(id: string, data: any) {
    return this.put<any>(`/brands/${id}`, data);
  }

  async submitBrand(id: string) {
    return this.post<any>(`/brands/${id}/submit`);
  }

  async deleteBrand(id: string) {
    return this.delete(`/brands/${id}`);
  }

  // Campaign endpoints
  async getCampaigns(params?: { brandId?: string; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.brandId) searchParams.set('brandId', params.brandId);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return this.get<any[]>(`/campaigns${query ? `?${query}` : ''}`);
  }

  async getCampaign(id: string) {
    return this.get<any>(`/campaigns/${id}`);
  }

  async createCampaign(data: any) {
    return this.post<any>('/campaigns', data);
  }

  async updateCampaign(id: string, data: any) {
    return this.put<any>(`/campaigns/${id}`, data);
  }

  async submitCampaign(id: string) {
    return this.post<any>(`/campaigns/${id}/submit`);
  }

  async deleteCampaign(id: string) {
    return this.delete(`/campaigns/${id}`);
  }

  // Message endpoints
  async getMessages(params?: Record<string, any>) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    const query = searchParams.toString();
    return this.get<any[]>(`/messages${query ? `?${query}` : ''}`);
  }

  async sendMessage(data: { from: string; to: string; body: string; campaignId?: string }) {
    return this.post<any>('/messages', data);
  }

  async getMessageStats(params?: { campaignId?: string; startDate?: string; endDate?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.campaignId) searchParams.set('campaignId', params.campaignId);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    const query = searchParams.toString();
    return this.get<any>(`/messages/stats${query ? `?${query}` : ''}`);
  }

  // Platform endpoints
  async getPlatformConnections() {
    return this.get<any[]>('/platforms/connections');
  }

  async getOAuthUrl(platform: string) {
    return this.get<{ url: string }>(`/platforms/${platform}/oauth`);
  }

  async disconnectPlatform(id: string) {
    return this.delete(`/platforms/connections/${id}`);
  }

  async refreshPlatformToken(id: string) {
    return this.post<any>(`/platforms/connections/${id}/refresh`);
  }

  // Campaign actions
  async pauseCampaign(id: string) {
    return this.post<any>(`/campaigns/${id}/pause`);
  }

  async resumeCampaign(id: string) {
    return this.post<any>(`/campaigns/${id}/resume`);
  }

  // User/Profile endpoints
  async updateProfile(data: { firstName: string; lastName: string; email: string }) {
    return this.put<any>('/users/profile', data);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.post<any>('/users/password', { currentPassword, newPassword });
  }

  async updateOrganization(data: { name: string; email: string }) {
    return this.put<any>('/organization', data);
  }

  // API Keys
  async getApiKeys() {
    return this.get<any[]>('/api-keys');
  }

  async createApiKey(data: { name: string }) {
    return this.post<{ key: string; id: string }>('/api-keys', data);
  }

  async deleteApiKey(id: string) {
    return this.delete(`/api-keys/${id}`);
  }

  // Phone Numbers (DIDs)
  async searchAvailableNumbers(params?: { areaCode?: string; contains?: string; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.areaCode) searchParams.set('areaCode', params.areaCode);
    if (params?.contains) searchParams.set('contains', params.contains);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return this.get<any[]>(`/phone-numbers/available${query ? `?${query}` : ''}`);
  }

  async getPhoneNumbers(params?: { status?: string; campaignId?: string; page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.campaignId) searchParams.set('campaignId', params.campaignId);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return this.get<any[]>(`/phone-numbers${query ? `?${query}` : ''}`);
  }

  async getPhoneNumberStats() {
    return this.get<any>('/phone-numbers/stats');
  }

  async getPhoneNumber(id: string) {
    return this.get<any>(`/phone-numbers/${id}`);
  }

  async purchasePhoneNumber(data: { phoneNumber: string; campaignId?: string; friendlyName?: string }) {
    return this.post<any>('/phone-numbers/purchase', data);
  }

  async updatePhoneNumber(id: string, data: { friendlyName?: string; campaignId?: string | null }) {
    return this.put<any>(`/phone-numbers/${id}`, data);
  }

  async releasePhoneNumber(id: string) {
    return this.delete(`/phone-numbers/${id}`);
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'ApiError';
  }
}

export const api = new ApiClient(API_BASE_URL);
