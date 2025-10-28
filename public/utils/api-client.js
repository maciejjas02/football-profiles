// API client z cache'owaniem i error handling
import { PlayerCache } from '../data/players-config.js';

export class ApiClient {
  constructor() {
    this.cache = new PlayerCache();
    this.baseUrl = '';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${options.method || 'GET'}_${url}`;
    
    // Sprawdź cache dla GET requests
    if (!options.method || options.method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache successful GET responses
      if (!options.method || options.method === 'GET') {
        this.cache.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      console.error(`API Error: ${endpoint}`, error);
      throw error;
    }
  }

  async getPlayers(category) {
    return this.request(`/api/players/category/${category}`);
  }

  async getPlayer(playerId) {
    return this.request(`/api/players/${playerId}`);
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async login(credentials) {
    const csrfResponse = await this.request('/api/auth/csrf-token');
    
    return this.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfResponse.csrfToken
      },
      body: JSON.stringify(credentials)
    });
  }

  async logout() {
    const csrfResponse = await this.request('/api/auth/csrf-token');
    
    const result = await this.request('/api/auth/logout', {
      method: 'POST',
      headers: {
        'CSRF-Token': csrfResponse.csrfToken
      }
    });

    this.cache.clear();
    return result;
  }
}

export const apiClient = new ApiClient();