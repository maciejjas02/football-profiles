// public/app.js
// DOM Elements
const banner = document.getElementById('banner');
const authStatus = document.getElementById('authStatus');
const logoutBtn = document.getElementById('logoutBtn');

// Formularze
const loginForm = document.getElementById('loginForm');
const regForm = document.getElementById('registerForm');

// Pola logowania
const loginInput = document.getElementById('login');
const pwInput = document.getElementById('password');
const loginErrorEl = document.getElementById('error');

// Pola rejestracji
const regEmail = document.getElementById('reg_email');
const regUsername = document.getElementById('reg_username');
const regName = document.getElementById('reg_name');
const regPw = document.getElementById('reg_password');
const regPwConfirm = document.getElementById('reg_password2'); // ID z HTML
const regErrorEl = document.getElementById('reg_error');
const passwordStrengthBar = document.getElementById('password-strength-bar');

// Zakładki
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const viewLogin = document.getElementById('viewLogin');
const viewRegister = document.getElementById('viewRegister');

// --- UI HELPERS ---
function showBanner(msg, success) {
    if (!banner) return;
    banner.textContent = msg;
    banner.className = 'banner';
    banner.classList.add(success ? 'banner--ok' : 'banner--err');
    banner.hidden = false;
    setTimeout(() => { banner.hidden = true; }, 3000);
}

// --- FUNKCJA POMOCNICZA: OBSŁUGA "OCZKA" ---
function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Zapobiegaj wysłaniu formularza
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            btn.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }
}

// Konfiguracja oczek
setupPasswordToggle('togglePw', 'password');           // Logowanie
setupPasswordToggle('toggleRegPw', 'reg_password');    // Rejestracja - hasło 1
setupPasswordToggle('toggleRegPw2', 'reg_password2');  // Rejestracja - powtórz hasło

// --- WSKAŹNIK SIŁY HASŁA ---
function updateRequirement(id, valid) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('met', valid);
}

if (regPw && passwordStrengthBar) {
    regPw.addEventListener('input', () => {
        const val = regPw.value;
        let strength = 0;
        if (val.length >= 6) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/[0-9]/.test(val)) strength++;

        passwordStrengthBar.className = 'password-strength-bar';
        if (val.length === 0) {
            passwordStrengthBar.style.width = '0%';
        } else if (strength <= 1) {
            passwordStrengthBar.classList.add('weak');
            passwordStrengthBar.style.width = '33%';
        } else if (strength === 2) {
            passwordStrengthBar.classList.add('medium');
            passwordStrengthBar.style.width = '66%';
        } else {
            passwordStrengthBar.classList.add('strong');
            passwordStrengthBar.style.width = '100%';
        }

        updateRequirement('req-length', val.length >= 6);
        updateRequirement('req-uppercase', /[A-Z]/.test(val));
        updateRequirement('req-number', /[0-9]/.test(val));
    });
}

// --- PRZEŁĄCZANIE ZAKŁADEK ---
if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        viewLogin.style.display = 'block';
        viewRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        viewLogin.style.display = 'none';
        viewRegister.style.display = 'block';
    });
}

// --- LOGOWANIE ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const login = loginInput.value.trim();
        const password = pwInput.value;
        loginErrorEl.textContent = "";

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            });
            const data = await res.json();

            if (res.ok) {
                showBanner('Zalogowano pomyślnie!', true);
                // 🚀 Przekierowanie tylko po udanym logowaniu
                setTimeout(() => window.location.href = '/dashboard.html', 500);
            } else {
                loginErrorEl.textContent = data.error || "Błąd logowania";
                loginErrorEl.style.color = "red";
            }
        } catch (err) {
            loginErrorEl.textContent = "Błąd serwera";
        }
    });
}

// --- REJESTRACJA ---
if (regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = regEmail.value.trim();
        const username = regUsername.value.trim();
        const name = regName ? regName.value.trim() : '';
        const password = regPw.value;
        const passwordConfirm = regPwConfirm.value;

        regErrorEl.textContent = "";
        regErrorEl.style.color = "red";

        // Walidacja
        if (!email || !username || !password) {
            regErrorEl.textContent = "Wypełnij wymagane pola.";
            return;
        }
        if (password.length < 6) {
            regErrorEl.textContent = "Hasło za krótkie (min. 6 znaków).";
            return;
        }
        if (password !== passwordConfirm) {
            regErrorEl.textContent = "Hasła nie są identyczne.";
            return;
        }

        const submitBtn = regForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Rejestracja...";

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password, name })
            });
            const data = await res.json();

            if (res.ok) {
                showBanner('Konto utworzone! Logowanie...', true);
                setTimeout(() => window.location.href = '/dashboard.html', 1000);
            } else {
                regErrorEl.textContent = data.error || "Błąd rejestracji";
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        } catch (err) {
            regErrorEl.textContent = "Błąd połączenia z serwerem";
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// --- INICJALIZACJA: Sprawdzenie stanu logowania i opcjonalne przekierowanie ---
(async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            // 🚀 Delikatne przekierowanie, jeśli user próbuje wejść na /logowanie będąc zalogowanym.
            window.location.href = '/dashboard.html';
        }
    } catch (e) {
        // Jeśli błąd autoryzacji (np. token wygasł), pozostaw na stronie logowania.
    }
})();