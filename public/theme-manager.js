// public/theme-manager.js
import { fetchWithAuth } from './utils/api-client.js';

export const ThemeManager = {
    async init() {
        try {
            const res = await fetch('/api/user/theme');
            if (res.ok) {
                const theme = await res.json();
                this.applyTheme(theme);
            }
        } catch (e) {
        }

        await this.initSelector();
    },

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
        return '255, 255, 255';
    },

    applyTheme(theme) {
        if (!theme) return;
        const root = document.documentElement;

        root.style.setProperty('--primary-color', theme.primary_color);
        root.style.setProperty('--secondary-color', theme.secondary_color);
        root.style.setProperty('--bg-gradient-start', theme.background_gradient_start);
        root.style.setProperty('--bg-gradient-end', theme.background_gradient_end);
        root.style.setProperty('--text-color', theme.text_color);

        root.style.setProperty('--primary-rgb', this.hexToRgbString(theme.primary_color));
        root.style.setProperty('--secondary-rgb', this.hexToRgbString(theme.secondary_color));
    },

    async initSelector() {
        if (document.querySelector('.theme-selector-panel')) return;

        try {
            const response = await fetch('/api/themes');
            if (!response.ok) return;

            const themes = await response.json();
            if (!themes || themes.length === 0) return;

            const container = document.createElement('div');
            container.className = 'theme-selector-panel';
            container.innerHTML = `
                <div class="theme-selector-title">Motyw</div>
                <div class="theme-buttons-container" id="themeButtons"></div>
            `;
            document.body.appendChild(container);

            const buttonsContainer = container.querySelector('#themeButtons');

            themes.forEach(theme => {
                const btn = document.createElement('div');
                btn.className = 'theme-btn-circle';
                btn.style.background = `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})`;
                btn.title = theme.name;

                btn.onclick = async () => {
                    this.applyTheme(theme);
                    try {
                        await fetchWithAuth('/api/user/theme', {
                            method: 'PUT',
                            body: JSON.stringify({ themeId: theme.id })
                        });
                    } catch (e) {
                        console.warn("Błąd zapisu motywu (może brak logowania):", e);
                    }
                };

                buttonsContainer.appendChild(btn);
            });

        } catch (e) {
            console.error("Błąd selektora motywów:", e);
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
    ThemeManager.init();
}