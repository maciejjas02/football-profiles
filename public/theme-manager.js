// public/theme-manager.js
import { fetchWithAuth } from './utils/api-client.js';

export const ThemeManager = {
    async init() {
        const userTheme = await this.fetchUserTheme();
        if (userTheme) {
            this.applyTheme(userTheme);
        }
    },

    async fetchUserTheme() {
        try {
            // Jeśli zalogowany, pobierz z API, w przeciwnym razie z localStorage lub domyślny
            const res = await fetch('/api/user/theme'); // Endpoint powinien zwracać domyślny, jeśli user niezalogowany
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('Theme fetch error', e);
        }
        return null;
    },

    applyTheme(theme) {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', theme.primary_color);
        root.style.setProperty('--secondary-color', theme.secondary_color); // np. kolor obramowań
        root.style.setProperty('--bg-start', theme.background_gradient_start);
        root.style.setProperty('--bg-end', theme.background_gradient_end);
        root.style.setProperty('--text-color', theme.text_color);

        // Zapisz ID w pamięci, by UI wiedziało co zaznaczyć
        localStorage.setItem('currentThemeId', theme.id);
    }
};

// Automatyczny start
document.addEventListener('DOMContentLoaded', () => ThemeManager.init());