// public/forum.js

let currentUser = null;
let currentPage = 1;
let selectedCategory = null;
let currentParentId = null; // Śledzi, w której kategorii nadrzędnej jesteśmy
const POSTS_PER_PAGE = 20;

async function init() {
  await setupAuth();
  await loadCategories(null); // Na start ładujemy tylko GŁÓWNE kategorie (parent_id = null)
  await loadPosts();
  setupPagination();

  // Ładowanie powiadomień (jeśli user zalogowany)
  if (currentUser) {
    await loadNotifications();
  }
}

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        const ordersLink = document.getElementById('ordersLink');
        if (ordersLink) ordersLink.style.display = 'block';
      }

      // Odkrywanie linków Admina/Moderatora
      if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
        const modLink = document.getElementById('moderatorLink');
        if (modLink) modLink.style.display = 'block';
      }
      if (currentUser.role === 'admin') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'block';

        const galleryManageLink = document.getElementById('galleryManageLink');
        if (galleryManageLink) galleryManageLink.style.display = 'block';
      }
    } else {
      document.getElementById('who').textContent = "Gość";
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'none';
      // Ukryj dzwonek dla gościa
      const notifBtn = document.getElementById('notificationsBtn');
      if (notifBtn) notifBtn.style.display = 'none';
    }
  } catch (error) { }
}

// --- LOGIKA POWIADOMIEŃ ---
async function loadNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const badge = document.getElementById('notificationBadge');
  const dropdown = document.getElementById('notificationsDropdown');
  const list = document.getElementById('notificationsList');

  if (!btn) return;

  try {
    const res = await fetch('/api/user/notifications');
    const notifications = await res.json();

    const unreadCount = notifications.filter(n => n.is_read === 0).length;

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }

    // Pokaż dzwoneczek
    btn.style.display = 'block';

    if (notifications.length === 0) {
      list.innerHTML = '<div class="notification-empty">Brak powiadomień.</div>';
    } else {
      list.innerHTML = notifications.map(n => `
                <div class="notification-item ${n.is_read === 0 ? 'unread' : ''}" 
                     onclick="window.handleNotificationClick(${n.id}, '${n.link || '#'}', ${n.is_read})"
                >
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-message">${n.message}</div>
                    <div class="notification-time">${new Date(n.created_at).toLocaleDateString()}</div>
                </div>
            `).join('');
    }

    btn.onclick = (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };

    document.addEventListener('click', (e) => {
      if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    const markReadBtn = document.getElementById('markAllReadBtn');
    if (markReadBtn) {
      markReadBtn.onclick = async () => {
        await fetch('/api/user/notifications/read-all', { method: 'POST' });
        loadNotifications();
      };
    }

  } catch (e) {
    console.error('Błąd powiadomień:', e);
    badge.style.display = 'none';
  }
}

window.handleNotificationClick = async (id, link, isRead) => {
  if (isRead === 0) {
    await fetch(`/api/user/notifications/${id}/read`, { method: 'POST' });
  }
  if (link && link !== '#') {
    window.location.href = link;
  } else {
    loadNotifications();
  }
};
// --- KONIEC LOGIKI POWIADOMIEŃ ---

// Funkcja ładująca kategorie (Główne lub Podkategorie)
async function loadCategories(parentId = null) {
  try {
    let categories = [];

    if (parentId) {
      // Pobieramy podkategorie konkretnego rodzica
      const res = await fetch(`/api/forum/categories/${parentId}/subcategories`);
      categories = await res.json();
    } else {
      // Pobieramy wszystko i filtrujemy tylko główne (bez rodzica)
      const res = await fetch('/api/forum/categories');
      const allCats = await res.json();
      categories = allCats.filter(c => !c.parent_id);
    }

    renderCategoriesList(categories, parentId);

  } catch (error) { console.error(error); }
}

function renderCategoriesList(categories, parentId) {
  const categoriesList = document.getElementById('categoriesList');
  if (!categoriesList) return;

  let html = '';

  // Jeśli jesteśmy "głębiej" (parentId istnieje), dodaj przycisk powrotu
  if (parentId) {
    html += `
            <div class="category-card back-card" onclick="goBackToMain()" style="cursor: pointer; border: 1px dashed var(--primary-color); display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.05);">
                <h3 style="margin:0;">⬅️ Wróć do głównych</h3>
            </div>
        `;
  }

  if (categories.length === 0 && !parentId) {
    categoriesList.innerHTML = '<p>Brak kategorii.</p>';
    return;
  }

  // Jeśli brak podkategorii, ale jesteśmy w trybie "drążenia", nic nie wyświetlamy (poza przyciskiem wstecz),
  // bo zaraz pod spodem załadują się posty.

  html += categories.map(cat => `
      <div class="category-card" style="cursor: pointer;" onclick="handleCategoryClick(${cat.id}, '${cat.name}')">
        <h3>${cat.name}</h3>
        <p>${cat.description || ''}</p>
        <div class="category-stats"><span>📄 ${cat.post_count || 0} postów</span></div>
      </div>
    `).join('');

  categoriesList.innerHTML = html;
}

// Główna logika "wchodzenia" w kategorie
window.handleCategoryClick = async (catId, catName) => {
  try {
    // 1. Sprawdź czy ta kategoria ma podkategorie
    const res = await fetch(`/api/forum/categories/${catId}/subcategories`);
    const subcategories = await res.json();

    if (subcategories.length > 0) {
      // SĄ podkategorie -> Wchodzimy głębiej (podmieniamy kafelki)
      currentParentId = catId;
      renderCategoriesList(subcategories, catId);

      // Opcjonalnie: filtrujemy też posty dla tej kategorii nadrzędnej
      filterByCategory(catId);
    } else {
      // BRAK podkategorii -> To jest kategoria końcowa, tylko filtrujemy posty
      filterByCategory(catId);
    }
  } catch (e) {
    console.error("Błąd sprawdzania podkategorii", e);
    filterByCategory(catId);
  }
};

window.goBackToMain = () => {
  currentParentId = null;
  loadCategories(null); // Załaduj główne
  filterByCategory(null); // Pokaż wszystkie posty (lub zresetuj filtr)
};

window.filterByCategory = (categoryId) => {
  selectedCategory = categoryId;
  const filter = document.getElementById('categoryFilter');
  if (filter) filter.value = categoryId || "";

  currentPage = 1;
  loadPosts();

  // Przewiń do postów
  const postsSection = document.getElementById('postsSection');
  if (postsSection) postsSection.scrollIntoView({ behavior: 'smooth' });
};

async function loadPosts() {
  const postsList = document.getElementById('postsList');
  if (!postsList) return;

  postsList.innerHTML = '<div class="loading">Ładowanie...</div>';

  try {
    const offset = (currentPage - 1) * POSTS_PER_PAGE;
    let url = `/api/forum/posts?limit=${POSTS_PER_PAGE}&offset=${offset}&t=${Date.now()}`;
    if (selectedCategory) url += `&category_id=${selectedCategory}`;

    const res = await fetch(url);
    const posts = await res.json();

    if (posts.length === 0) {
      postsList.innerHTML = '<div class="empty-state">Brak postów w tej kategorii</div>';
      return;
    }

    postsList.innerHTML = posts.map(post => {
      let plainText = post.content.replace(/<[^>]*>/g, '').trim();
      let excerpt = plainText.substring(0, 150);
      if (excerpt.length < plainText.length) excerpt += '...';
      if (excerpt.length === 0 && post.content.includes('<img')) {
        excerpt = '<span style="color: #FFD700;">📷 [Post zawiera zdjęcie]</span>';
      } else if (excerpt.length === 0) {
        excerpt = '<em>Brak treści tekstowej...</em>';
      }

      return `
          <div class="post-card">
            <div class="post-header">
              <h3><a href="post.html?id=${post.id}" style="text-decoration:none; color:#FFD700;">${post.title}</a></h3>
              <span class="post-category">${post.category_name || 'Ogólne'}</span>
            </div>
            <div class="post-meta">
              <span>👤 ${post.author_username || 'Nieznany'}</span>
              <span>💬 ${post.comment_count || 0} komentarzy</span>
              <span>🕒 ${new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <div class="post-excerpt" style="color: rgba(255,255,255,0.7); margin: 10px 0;">
              ${excerpt}
            </div>
            <a href="post.html?id=${post.id}" class="btn btn-primary btn-sm">Czytaj więcej</a>
          </div>
        `;
    }).join('');
  } catch (error) {
    postsList.innerHTML = '<div class="error-state">Błąd połączenia</div>';
  }
}

function setupPagination() {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; loadPosts(); document.getElementById('pageInfo').textContent = `Strona ${currentPage}`; }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage++; loadPosts(); document.getElementById('pageInfo').textContent = `Strona ${currentPage}`;
    });
  }
}

init();