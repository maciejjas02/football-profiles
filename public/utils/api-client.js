// public/utils/api-client.js

// Pominięto zaawansowany cache PlayerCache, by utrzymać minimalizm
const apiClient = {
    // Mock Cache - nieużywany, ale zachowany dla kompatybilności
    cache: {
        get: () => null,
        set: () => { },
        clear: () => { }
    },

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                // Rzuć błąd, aby obsłużyć 401, 403, 404, 500
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return response.json();
        } catch (error) {
            console.error(`API Error: ${endpoint}`, error);
            throw error;
        }
    },

    async getCurrentUser() {
        return this.request('/api/auth/me');
    },

    async logout() {
        const csrfResponse = await this.request('/api/auth/csrf-token');

        const result = await this.request('/api/auth/logout', {
            method: 'POST',
            headers: {
                'CSRF-Token': csrfResponse.csrfToken
            }
        });

        // Wyczyść cache (mock)
        this.cache.clear();
        return result;
    }
};


export async function fetchWithAuth(endpoint, options = {}) {
    const headers = {
        ...options.headers
    };

    // WAŻNE: Tylko dodaj Content-Type: application/json, jeśli NIE jest to FormData.
    // Dla FormData przeglądarka musi sama ustawić boundary.
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // Automatycznie dodaj CSRF token dla metod zmieniających stan (POST, PUT, DELETE)
    if (options.method !== 'GET' && options.method !== 'HEAD' && !headers['CSRF-Token']) {
        const token = await getCsrfToken();
        if (token) {
            headers['CSRF-Token'] = token;
        }
    }

    const response = await fetch(endpoint, {
        credentials: 'include',
        headers,
        ...options
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
}

async function getCsrfToken() {
    try {
        const r = await fetch('/api/auth/csrf-token', { credentials: 'include' });
        if (!r.ok) return '';
        const j = await r.json();
        return j.csrfToken;
    } catch (e) {
        console.error('Failed to fetch CSRF token:', e);
        return '';
    }
}

export async function getCurrentUser() {
    try {
        const response = await apiClient.getCurrentUser();
        return response.user || response;
    } catch (error) {
        return null;
    }
}

export async function handleLogout() {
    try {
        await apiClient.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
}