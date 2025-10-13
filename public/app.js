// --- ELEMENTY WSPÓLNE ---
const banner = document.getElementById('banner');
const authStatus = document.getElementById('authStatus');
const logoutBtn = document.getElementById('logoutBtn');
const oauthBox = document.getElementById('oauthBox');
const goDash = document.getElementById('goDash');

// --- LOGOWANIE ---
const form = document.getElementById('loginForm');
const loginInput = document.getElementById('login');
const pwInput = document.getElementById('password');
const remember = document.getElementById('remember');
const errorEl = document.getElementById('error');
const togglePw = document.getElementById('togglePw');
const checkMe = document.getElementById('checkMe');

// --- REJESTRACJA ---
const regForm = document.getElementById('registerForm');
const regEmail = document.getElementById('reg_email');
const regUsername = document.getElementById('reg_username');
const regName = document.getElementById('reg_name');
const regPw = document.getElementById('reg_password');
const regPw2 = document.getElementById('reg_password2');
const regError = document.getElementById('reg_error');

// --- TABS ---
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const viewLogin = document.getElementById('viewLogin');
const viewRegister = document.getElementById('viewRegister');

function activateTab(which) {
  const isLogin = which === 'login';
  tabLogin?.classList.toggle('active', isLogin);
  tabRegister?.classList.toggle('active', !isLogin);
  if (viewLogin) viewLogin.style.display = isLogin ? '' : 'none';
  if (viewRegister) viewRegister.style.display = isLogin ? 'none' : '';
}
tabLogin?.addEventListener('click', () => activateTab('login'));
tabRegister?.addEventListener('click', () => activateTab('register'));

// --- CSRF ---
let csrfToken = null;
try {
  const r = await fetch('/api/auth/csrf-token', { credentials: 'include' });
  const j = await r.json();
  csrfToken = j.csrfToken;
} catch (e) {
  alert('Nie udało się pobrać CSRF tokenu. Odśwież stronę (Ctrl+F5).');
}

// --- Przywrócenie loginu ---
const savedLogin = localStorage.getItem('login');
if (savedLogin && loginInput) loginInput.value = savedLogin;

// --- Remember me ---
loginInput?.addEventListener('input', () => {
  if (remember?.checked) localStorage.setItem('login', loginInput.value);
});
remember?.addEventListener('change', () => {
  if (!remember.checked) localStorage.removeItem('login');
  else localStorage.setItem('login', loginInput?.value || '');
});
togglePw?.addEventListener('click', () => {
  if (!pwInput) return;
  pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
});

// --- UI helpers ---
function showBanner(msg, ok = true) {
  if (!banner) return;
  banner.textContent = msg;
  banner.classList.toggle('banner--ok', ok);
  banner.classList.toggle('banner--err', !ok);
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 3000);
}
function setLoggedInUI(user) {
  const fallbackFromEmail = (user?.email || '').split('@')[0] || 'Użytkownik';
  const name = user?.display_name || user?.username || user?.name || fallbackFromEmail;

  if (authStatus) authStatus.textContent = `Zalogowany jako ${name}`;
  if (logoutBtn) logoutBtn.hidden = false;
  if (oauthBox) oauthBox.style.display = 'none';
  if (goDash) goDash.hidden = false;
}

function setLoggedOutUI() {
  if (authStatus) authStatus.textContent = 'Nie zalogowany';
  if (logoutBtn) logoutBtn.hidden = true;
  if (oauthBox) oauthBox.style.display = '';
  if (goDash) goDash.hidden = true;
}

// --- Sprawdzenie stanu na starcie ---
await (async function onLoad() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setLoggedInUI(data.user);
  } catch { setLoggedOutUI(); }
})();

// --- LOGOWANIE ---
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!loginInput || !pwInput || !errorEl) return;
  errorEl.textContent = '';

  const payload = { login: (loginInput.value || '').trim(), password: pwInput.value || '' };
  if (!payload.login || !payload.password) { errorEl.textContent = 'Wypełnij oba pola.'; return; }
  if (payload.login.length < 3) { errorEl.textContent = 'Login za krótki.'; return; }
  if (payload.password.length < 6) { errorEl.textContent = 'Hasło za krótkie.'; return; }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd logowania');

    if (remember?.checked) localStorage.setItem('login', payload.login);
    errorEl.style.color = '#0ad39a';
    errorEl.textContent = 'Zalogowano pomyślnie!';
    setLoggedInUI(data.user);
    showBanner('Jesteś zalogowany ✅', true);
    setTimeout(() => window.location.href = '/dashboard.html', 600);
  } catch (err) {
    errorEl.style.color = '#d33';
    errorEl.textContent = err.message;
    showBanner('Nie udało się zalogować', false);
  }
});

// --- REJESTRACJA ---
regForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!regEmail || !regUsername || !regPw || !regPw2 || !regError) return;
  regError.textContent = '';

  const email = (regEmail.value || '').trim();
  const username = (regUsername.value || '').trim();
  const name = (regName?.value || '').trim();
  const password = regPw.value || '';
  const password2 = regPw2.value || '';

  if (!email || !username || !password || !password2) {
    regError.textContent = 'Wypełnij wszystkie wymagane pola.'; return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) { regError.textContent = 'Nieprawidłowy email.'; return; }
  if (username.length < 3) { regError.textContent = 'Nazwa użytkownika za krótka (min 3).'; return; }
  if (password.length < 6) { regError.textContent = 'Hasło za krótkie (min 6).'; return; }
  if (password !== password2) { regError.textContent = 'Hasła się nie zgadzają.'; return; }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' },
      credentials: 'include',
      body: JSON.stringify({ email, username, name, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd rejestracji');

    showBanner('Konto utworzone. Zalogowano ✅', true);
    setLoggedInUI(data.user);
    setTimeout(() => window.location.href = '/dashboard.html', 600);
  } catch (err) {
    regError.textContent = err.message;
    showBanner(err.message, false);
  }
});

// --- WYLOGOWANIE ---
logoutBtn?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken || '' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Błąd wylogowania');
    setLoggedOutUI();
    showBanner('Wylogowano pomyślnie 👋', true);
  } catch {
    showBanner('Błąd wylogowania', false);
  }
});

// --- Ręczny check ---
checkMe?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    alert(res.ok ? `Jesteś zalogowany jako ${data.user?.email || data.user?.username}` : 'Nie jesteś zalogowany');
  } catch { alert('Błąd sprawdzania sesji'); }
});
