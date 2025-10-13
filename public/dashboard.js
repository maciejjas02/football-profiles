let csrfToken = null;
try {
  const r = await fetch('/api/auth/csrf-token', { credentials: 'include' });
  const j = await r.json();
  csrfToken = j.csrfToken;
} catch {}

const who = document.getElementById('who');
const userData = document.getElementById('userData');
const logoutBtn = document.getElementById('logoutBtn');

// Ochrona strony: jeśli nie zalogowany, wróć do /
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('not auth');
    const { user, via } = await res.json();
    who.textContent = `Zalogowany jako ${user.email || user.username} (${via})`;
    userData.innerHTML = `
      <ul class="bullets">
        <li><strong>ID:</strong> ${user.id}</li>
        <li><strong>Email:</strong> ${user.email || '—'}</li>
        <li><strong>Użytkownik:</strong> ${user.username || '—'}</li>
        <li><strong>Rola:</strong> ${user.role}</li>
        <li><strong>Dostawca:</strong> ${user.provider || 'local'}</li>
      </ul>`;
  } catch {
    window.location.href = '/';
  }
})();

// Wylogowanie
logoutBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'CSRF-Token': csrfToken || '' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error();
    window.location.href = '/';
  } catch {
    alert('Błąd wylogowania');
  }
});
