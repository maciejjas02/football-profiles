// Globalny error handler
export class ErrorHandler {
  static init() {
    // Global error handler
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.showUserFriendlyError('Wystąpił nieoczekiwany błąd');
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.showUserFriendlyError('Błąd połączenia z serwerem');
      event.preventDefault();
    });
  }

  static showUserFriendlyError(message, duration = 5000) {
    // Usuń poprzednie powiadomienia o błędach
    const existingErrors = document.querySelectorAll('.global-error');
    existingErrors.forEach(el => el.remove());

    // Stwórz nowe powiadomienie
    const errorDiv = document.createElement('div');
    errorDiv.className = 'global-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
        <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Dodaj style
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: rgba(220, 38, 38, 0.95);
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    // Dodaj do body
    document.body.appendChild(errorDiv);

    // Auto-usuń po czasie
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => errorDiv.remove(), 300);
      }
    }, duration);
  }

  static addErrorStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      .global-error .error-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .global-error .error-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
      }

      .global-error .error-close:hover {
        opacity: 0.7;
      }
    `;
    document.head.appendChild(style);
  }
}

// Auto-inicjalizacja
if (typeof window !== 'undefined') {
  ErrorHandler.addErrorStyles();
  ErrorHandler.init();
}