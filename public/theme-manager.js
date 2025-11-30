import { fetchWithAuth } from './utils/api-client.js';

export const ThemeManager = {
    async init() {
        try {
            // Próba pobrania motywu zalogowanego użytkownika
            const res = await fetch('/api/user/theme');
            if (res.ok) {
                const theme = await res.json();
                this.applyTheme(theme);
            }
        } catch (e) {
            console.warn('Theme fetch error', e);
        }
    },

    // Funkcja pomocnicza: Zamienia #FFD700 na "255, 215, 0"
    hexToRgbString(hex) {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(', ');
        }
        return '255, 255, 255'; // Fallback
    },

    applyTheme(theme) {
        if (!theme) return;
        const root = document.documentElement;

        // Ustawianie kolorów HEX (dla tekstów i tła)
        root.style.setProperty('--primary-color', theme.primary_color);
        root.style.setProperty('--secondary-color', theme.secondary_color);
        root.style.setProperty('--bg-gradient-start', theme.background_gradient_start);
        root.style.setProperty('--bg-gradient-end', theme.background_gradient_end);
        root.style.setProperty('--text-color', theme.text_color);

        // Ustawianie kolorów RGB (dla przezroczystości i cieni)
        root.style.setProperty('--primary-rgb', this.hexToRgbString(theme.primary_color));
        root.style.setProperty('--secondary-rgb', this.hexToRgbString(theme.secondary_color));
    }
};

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());