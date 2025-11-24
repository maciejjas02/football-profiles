// public/utils/ui.js

// Funkcja Toast (znikające powiadomienie)
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <span style="display:flex; align-items:center; gap:10px;">
            <span>${icon}</span> ${message}
        </span>
    `;

    container.appendChild(toast);

    // Usuń po 3 sekundach
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Funkcja Modal (Potwierdzenie Tak/Nie)
// Zwraca Promise: true (jeśli potwierdzono), false (jeśli anulowano)
export function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';

        overlay.innerHTML = `
            <div class="custom-modal">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="modal-actions">
                    <button id="modal-cancel" class="modal-btn cancel">Anuluj</button>
                    <button id="modal-confirm" class="modal-btn confirm">Potwierdź</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const btnConfirm = overlay.querySelector('#modal-confirm');
        const btnCancel = overlay.querySelector('#modal-cancel');

        function close(result) {
            overlay.style.opacity = '0'; // animate out
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        }

        btnConfirm.addEventListener('click', () => close(true));
        btnCancel.addEventListener('click', () => close(false));

        // Zamknij klikając w tło
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
}