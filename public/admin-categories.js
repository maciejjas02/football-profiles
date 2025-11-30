import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let allCategories = [];
let allThemes = []; // Tablica na motywy

// Czekamy na pełne załadowanie DOM
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Zabezpieczenie przed podwójnym odpaleniem
  if (window.initStarted) return;
  window.initStarted = true;

  await checkAuth();

  // Ładowanie wszystkich sekcji
  await loadUsersManagement();
  await loadModerators();
  await loadCategories();
  await loadThemes(); // NOWE: Ładowanie motywów

  setupEventListeners();

  if (currentUser) {
    await loadNotifications();
  }
}

async function checkAuth() {
  try {
    currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }

    const whoEl = document.getElementById('who');
    if (whoEl) whoEl.textContent = (currentUser.name || currentUser.username).toLowerCase();

    // Odkrywanie linków w nawigacji
    if (['admin', 'moderator'].includes(currentUser.role)) {
      document.getElementById('ordersLink')?.style.setProperty('display', 'block');
      document.getElementById('moderatorLink')?.style.setProperty('display', 'block');
    }
    if (currentUser.role === 'admin') {
      document.getElementById('adminLink')?.style.setProperty('display', 'block');
      document.getElementById('galleryManageLink')?.style.setProperty('display', 'block');
    }
  } catch (error) {
    console.error('Auth error:', error);
    window.location.href = 'index.html';
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await handleLogout();
    window.location.href = 'index.html';
  });
}

// ==========================================
// SEKCJA 1: ZARZĄDZANIE KATEGORIAMI
// ==========================================

async function loadCategories() {
  try {
    const list = document.getElementById('categoriesList');
    if (!list) return;

    allCategories = await fetchWithAuth('/api/forum/categories');

    // Wypełnij selecty (rodzic, przypisywanie moda)
    const parentSelect = document.getElementById('parentCategory');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">Brak (główna kategoria)</option>' +
        allCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

    const assignSelect = document.getElementById('assignCategory');
    if (assignSelect) {
      assignSelect.innerHTML = '<option value="">Wybierz kategorię...</option>' +
        allCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

    if (allCategories.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak kategorii</div>';
      return;
    }

    list.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nazwa</th><th>Slug</th><th>Posty</th><th>Akcje</th></tr></thead>
        <tbody>
          ${allCategories.map(cat => `
            <tr>
              <td><strong>${cat.name}</strong></td>
              <td><code>${cat.slug}</code></td>
              <td>${cat.post_count || 0}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="window.editCategory(${cat.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteCategory(${cat.id})">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Błąd ładowania kategorii:', error);
    const list = document.getElementById('categoriesList');
    if (list) list.innerHTML = '<div class="error-state">Błąd połączenia z serwerem.</div>';
  }
}

window.editCategory = async (id) => {
  const category = allCategories.find(c => c.id === id);
  if (!category) return;

  const newName = prompt("Nowa nazwa:", category.name);
  if (newName) {
    try {
      await fetchWithAuth(`/api/forum/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName, slug: category.slug, description: category.description })
      });
      loadCategories();
    } catch (e) { alert('Błąd edycji'); }
  }
};

window.deleteCategory = async (id) => {
  if (confirm('Czy na pewno usunąć kategorię? Usunie to też wszystkie posty w niej!')) {
    try {
      await fetchWithAuth(`/api/forum/categories/${id}`, { method: 'DELETE' });
      loadCategories();
    } catch (e) { alert('Błąd usuwania'); }
  }
};

// ==========================================
// SEKCJA 2: ZARZĄDZANIE MOTYWAMI (+1.0)
// ==========================================

async function loadThemes() {
  const list = document.getElementById('themesList');
  if (!list) return;

  try {
    allThemes = await fetchWithAuth('/api/themes');

    if (allThemes.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak zdefiniowanych motywów.</div>';
      return;
    }

    list.innerHTML = allThemes.map(t => `
            <div style="background: var(--card-bg); border: 1px solid var(--glass-border); padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong>${t.name}</strong>
                    <button class="btn btn-sm btn-primary" onclick="window.editTheme(${t.id})">Edytuj</button>
                </div>
                <div class="theme-preview-box" style="
                    background: linear-gradient(135deg, ${t.background_gradient_start}, ${t.background_gradient_end});
                    color: ${t.text_color};
                    border: 1px solid ${t.secondary_color};
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold;
                ">
                    <span style="color: ${t.primary_color}; text-shadow: 0 0 2px black;">Tekst Primary</span>
                </div>
            </div>
        `).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="error-state">Błąd ładowania motywów</div>';
  }
}

window.editTheme = (id) => {
  const theme = allThemes.find(t => t.id === id);
  if (!theme) return;

  // Wypełnij formularz danymi
  document.getElementById('themeId').value = theme.id;
  document.getElementById('themeName').value = theme.name;
  document.getElementById('themePrimary').value = theme.primary_color;
  document.getElementById('themeSecondary').value = theme.secondary_color;
  document.getElementById('themeBgStart').value = theme.background_gradient_start;
  document.getElementById('themeBgEnd').value = theme.background_gradient_end;
  document.getElementById('themeTextColor').value = theme.text_color;

  // Scroll do formularza
  const form = document.getElementById('themeForm');
  if (form) form.scrollIntoView({ behavior: 'smooth' });
};

// ==========================================
// SEKCJA 3: ZARZĄDZANIE UŻYTKOWNIKAMI
// ==========================================

async function loadUsersManagement() {
  const container = document.getElementById('usersManageList');
  const loader = document.getElementById('usersListLoading');

  if (!container) return;

  try {
    const users = await fetchWithAuth('/api/admin/users');
    if (loader) loader.style.display = 'none';

    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state">Brak użytkowników.</div>';
      return;
    }

    let html = `<table class="data-table"><thead><tr><th>ID</th><th>Użytkownik</th><th>Rola</th><th>Akcja</th></tr></thead><tbody>`;

    html += users.map(u => {
      let actionBtn = '';
      if (u.role === 'user') {
        actionBtn = `<button onclick="window.changeRole(${u.id}, 'moderator')" class="btn btn-success btn-sm">⬆️ Awansuj</button>`;
      } else if (u.role === 'moderator') {
        actionBtn = `<button onclick="window.changeRole(${u.id}, 'user')" class="btn btn-danger btn-sm">⬇️ Degraduj</button>`;
      } else if (u.role === 'admin') {
        actionBtn = `<span style="color:#888; font-size:12px;">(Admin)</span>`;
      }

      let badgeColor = '#888';
      if (u.role === 'moderator') badgeColor = '#FFD700';
      if (u.role === 'admin') badgeColor = '#ff4444';

      return `
        <tr>
            <td>#${u.id}</td>
            <td><strong>${u.username}</strong><br><small>${u.email || ''}</small></td>
            <td><span class="role-badge" style="color:${badgeColor}; border:1px solid ${badgeColor};">${u.role}</span></td>
            <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (e) {
    console.error(e);
    if (loader) loader.textContent = 'Błąd ładowania listy użytkowników.';
  }
}

window.changeRole = async (id, newRole) => {
  if (!confirm(`Czy na pewno chcesz zmienić rolę tego użytkownika na ${newRole.toUpperCase()}?`)) return;

  try {
    await fetchWithAuth(`/api/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    });
    await loadUsersManagement();
    await loadModerators();
  } catch (e) {
    alert('Błąd: ' + e.message);
  }
};

// ==========================================
// SEKCJA 4: PRZYPISYWANIE MODERATORÓW
// ==========================================

async function loadModerators() {
  try {
    const users = await fetchWithAuth('/api/admin/users');
    const moderators = users.filter(u => u.role === 'moderator' || u.role === 'admin');

    const select = document.getElementById('assignModerator');
    if (!select) return;

    if (moderators.length === 0) {
      select.innerHTML = '<option value="">Brak dostępnych moderatorów</option>';
    } else {
      select.innerHTML = '<option value="">Wybierz moderatora...</option>' +
        moderators.map(mod => `<option value="${mod.id}">${mod.username} (${mod.role})</option>`).join('');
    }
  } catch (e) {
    console.error("Błąd ładowania moderatorów:", e);
  }
}

async function loadAssignments(category_id) {
  const list = document.getElementById('assignmentsList');
  if (!list) return;

  try {
    const moderators = await fetchWithAuth(`/api/forum/categories/${category_id}/moderators`);

    if (moderators.length === 0) {
      list.innerHTML = '<p style="margin-top:20px; color:#888;">Brak przypisanych moderatorów do tej kategorii.</p>';
      return;
    }

    list.innerHTML = `
        <div style="margin-top:20px;">
            <h3 style="font-size:16px; color:#FFD700;">Przypisani moderatorzy:</h3>
            ${moderators.map(mod => `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; background:rgba(255,255,255,0.05); padding:8px; border-radius:4px;">
                    <span>👤 ${mod.username}</span>
                    <button class="btn btn-danger btn-sm" onclick="window.removeModerator(${category_id}, ${mod.id})">Usuń</button>
                </div>
            `).join('')}
        </div>
    `;
  } catch (error) {
    list.innerHTML = '<p class="error">Błąd pobierania przypisań.</p>';
  }
}

window.removeModerator = async (cid, uid) => {
  if (confirm('Odebrać uprawnienia do tej kategorii?')) {
    try {
      await fetchWithAuth(`/api/forum/categories/${cid}/moderators/${uid}`, { method: 'DELETE' });
      loadAssignments(cid);
    } catch (e) { alert('Błąd usuwania przypisania'); }
  }
};

// ==========================================
// SEKCJA 5: OBSŁUGA ZDARZEŃ I FORMULARZY
// ==========================================

function setupEventListeners() {

  // 1. Tworzenie Kategorii
  document.getElementById('submitCategoryBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = document.getElementById('categoryName').value.trim();
    const slug = document.getElementById('categorySlug').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();
    const parent_id = document.getElementById('parentCategory').value || null;

    if (!name || !slug) return alert('Nazwa i slug są wymagane');

    try {
      await fetchWithAuth('/api/forum/categories', {
        method: 'POST',
        body: JSON.stringify({ name, slug, description, parent_id })
      });
      alert('✅ Kategoria utworzona');
      document.getElementById('categoryName').value = '';
      document.getElementById('categorySlug').value = '';
      document.getElementById('categoryDescription').value = '';
      loadCategories();
    } catch (error) {
      alert('Błąd tworzenia kategorii: ' + error.message);
    }
  });

  // 2. Automatyczny Slug
  document.getElementById('categoryName')?.addEventListener('input', (e) => {
    const slug = e.target.value.toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
      .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
      .replace(/ś/g, 's').replace(/ź|ż/g, 'z')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    document.getElementById('categorySlug').value = slug;
  });

  // 3. Przypisywanie Moderatora
  document.getElementById('assignBtn')?.addEventListener('click', async () => {
    const category_id = document.getElementById('assignCategory').value;
    const user_id = document.getElementById('assignModerator').value;

    if (!category_id || !user_id) return alert('Wybierz kategorię i moderatora');

    try {
      await fetchWithAuth(`/api/forum/categories/${category_id}/moderators`, {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(user_id) })
      });
      alert('✅ Przypisano moderatora');
      loadAssignments(category_id);
    } catch (error) {
      alert('Błąd przypisywania: ' + error.message);
    }
  });

  document.getElementById('assignCategory')?.addEventListener('change', (e) => {
    if (e.target.value) loadAssignments(e.target.value);
  });

  // 4. Formularz Motywów (NOWE)
  const themeForm = document.getElementById('themeForm');
  if (themeForm) {
    themeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('themeId').value;
      const data = {
        name: document.getElementById('themeName').value,
        primary_color: document.getElementById('themePrimary').value,
        secondary_color: document.getElementById('themeSecondary').value,
        background_gradient_start: document.getElementById('themeBgStart').value,
        background_gradient_end: document.getElementById('themeBgEnd').value,
        text_color: document.getElementById('themeTextColor').value
      };

      try {
        if (id) {
          // Aktualizacja
          await fetchWithAuth(`/api/themes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
          alert('✅ Motyw zaktualizowany!');
        } else {
          // Tworzenie
          await fetchWithAuth('/api/themes', { method: 'POST', body: JSON.stringify(data) });
          alert('✅ Motyw dodany!');
        }

        // Reset i odświeżenie
        document.getElementById('themeId').value = '';
        themeForm.reset();
        loadThemes();

      } catch (err) {
        alert('Błąd zapisu motywu: ' + err.message);
      }
    });
  }

  // Przycisk "Podgląd na żywo" (bez zapisu) - opcjonalny dodatek
  const previewBtn = document.getElementById('previewThemeBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', document.getElementById('themePrimary').value);
      root.style.setProperty('--secondary-color', document.getElementById('themeSecondary').value);
      root.style.setProperty('--bg-gradient-start', document.getElementById('themeBgStart').value);
      root.style.setProperty('--bg-gradient-end', document.getElementById('themeBgEnd').value);
      root.style.setProperty('--text-color', document.getElementById('themeTextColor').value);
      alert('Podgląd włączony! (Odśwież stronę, aby przywrócić obecny motyw)');
    });
  }
}

// ==========================================
// SEKCJA 6: POWIADOMIENIA
// ==========================================

async function loadNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const badge = document.getElementById('notificationBadge');
  const dropdown = document.getElementById('notificationsDropdown');
  const list = document.getElementById('notificationsList');

  if (!btn) return;

  try {
    const notifications = await fetchWithAuth('/api/user/notifications');
    const unreadCount = notifications.filter(n => n.is_read === 0).length;

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    btn.style.display = 'block';

    if (notifications.length > 0) {
      list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read === 0 ? 'unread' : ''}" onclick="window.handleNotificationClick(${n.id}, '${n.link || '#'}', ${n.is_read})">
            <div class="notification-title">${n.title}</div>
            <div class="notification-message">${n.message}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<div class="notification-empty">Brak powiadomień.</div>';
    }

    btn.onclick = (e) => { e.stopPropagation(); dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block'; };
    document.addEventListener('click', () => { dropdown.style.display = 'none'; });

    document.getElementById('markAllReadBtn').onclick = async () => {
      await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' });
      loadNotifications();
    };
  } catch (e) { console.error('Błąd powiadomień', e); }
}

window.handleNotificationClick = async (id, link, isRead) => {
  if (isRead === 0) await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  if (link && link !== '#') window.location.href = link;
  else loadNotifications();
};