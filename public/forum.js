// public/forum.js

import { fetchWithAuth } from './utils/api-client.js';

let currentUser = null;
let currentPage = 1;
let selectedCategory = null;
let currentParentId = null;
let currentCategoryPath = [{ id: null, name: 'Główne' }];
const POSTS_PER_PAGE = 20;

async function init() {
  await setupAuth();
  await loadCategories(null);
  await loadPosts();
  setupPagination();

  if (currentUser) {
    await loadNotifications();
  }
}

// --- FUNKCJE AUTH/NOTIFICATIONS ---

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
          await fetchWithAuth('/api/auth/logout', { method: 'POST' });
          window.location.href = '/';
        } catch (e) {
          window.location.href = '/';
        }
      });
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        const ordersLink = document.getElementById('ordersLink');
        if (ordersLink) ordersLink.style.display = 'block';
      }

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
      const notifBtn = document.getElementById('notificationsBtn');
      if (notifBtn) notifBtn.style.display = 'none';
    }
  } catch (error) { }
}

async function loadNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const badge = document.getElementById('notificationBadge');
  const dropdown = document.getElementById('notificationsDropdown');
  const list = document.getElementById('notificationsList');
  if (!btn) return;
  try {
    const notifications = await fetchWithAuth('/api/user/notifications');
    const unreadCount = notifications.filter(n => n.is_read === 0).length;
    if (unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = 'block'; } else { badge.style.display = 'none'; }
    btn.style.display = 'block';
    if (notifications.length === 0) { list.innerHTML = '<div class="notification-empty">Brak powiadomień.</div>'; return; }
    list.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.is_read === 0 ? 'unread' : ''}" 
                 onclick="window.handleNotificationClick(${n.id}, '${n.link || '#'}', ${n.is_read})"
            >
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${new Date(n.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    btn.onclick = (e) => { e.stopPropagation(); dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block'; };
    document.addEventListener('click', (e) => { if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !btn.contains(e.target)) { dropdown.style.display = 'none'; } });
    document.getElementById('markAllReadBtn').onclick = async () => {
      await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' });
      loadNotifications();
    };
  } catch (e) { console.error('Błąd powiadomień:', e); badge.style.display = 'none'; }
}

window.handleNotificationClick = async (id, link, isRead) => {
  if (isRead === 0) {
    await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  }
  if (link && link !== '#') {
    window.location.href = link;
  } else {
    loadNotifications();
  }
};

// --- FUNKCJA RENDERUJĄCA BREADCRUMBS ---
function renderBreadcrumbs() {
  const breadcrumbEl = document.getElementById('forumBreadcrumbs');
  if (!breadcrumbEl) return;

  let pathHtml = '<a href="dashboard.html" style="color: inherit; text-decoration: none;">Panel</a> › ';

  currentCategoryPath.forEach((cat, index) => {
    const isLast = index === currentCategoryPath.length - 1;
    const isFirst = index === 0;

    if (isLast) {
      pathHtml += `<strong style="color: #FFD700;">${cat.name}</strong>`;
    } else {
      pathHtml += `
                <span onclick="goBackToPath(${index})" style="cursor: pointer; color: inherit; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                    ${cat.name}
                </span>
                ${index < currentCategoryPath.length - 1 ? ' › ' : ''}
            `;
    }
  });

  breadcrumbEl.innerHTML = pathHtml;
}

async function loadCategories(parentId = null) {
  try {
    let categories = [];
    let endpoint = '/api/forum/categories';

    if (parentId) {
      endpoint = `/api/forum/categories/${parentId}/subcategories`;
    }

    const res = await fetch(endpoint);

    if (parentId) {
      categories = await res.json();
    } else {
      const allCats = await res.json();
      categories = allCats.filter(c => !c.parent_id);
    }

    renderCategoriesList(categories, parentId);
    renderBreadcrumbs();

  } catch (error) { console.error(error); }
}

function renderCategoriesList(categories, parentId) {
  const categoriesList = document.getElementById('categoriesList');
  if (!categoriesList) return;

  let html = '';

  if (parentId && categories.length === 0) {
    document.getElementById('categoriesSection').style.display = 'none';
    return;
  }

  document.getElementById('categoriesSection').style.display = 'block';

  html += categories.map(cat => `
      <div class="category-card" style="cursor: pointer;" onclick="handleCategoryClick(${cat.id}, '${cat.name}', ${cat.parent_id || null})">
        <h3>${cat.name}</h3>
        <p>${cat.description || ''}</p>
        <div class="category-stats"><span>📄 ${cat.post_count || 0} postów</span></div>
      </div>
    `).join('');

  categoriesList.innerHTML = html;
}

window.handleCategoryClick = async (catId, catName, parentId) => {
  const newPath = { id: catId, name: catName };
  const existingIndex = currentCategoryPath.findIndex(c => c.id === catId);
  if (existingIndex !== -1) {
    currentCategoryPath.splice(existingIndex + 1);
  } else {
    if (currentCategoryPath.length === 1 && currentCategoryPath[0].name === 'Główne') {
      currentCategoryPath = [];
    }
    currentCategoryPath.push(newPath);
  }

  currentParentId = catId;

  try {
    const res = await fetch(`/api/forum/categories/${catId}/subcategories`);
    const subcategories = await res.json();

    if (subcategories.length > 0) {
      renderCategoriesList(subcategories, catId);
      filterByCategory(catId);
    } else {
      renderCategoriesList([], catId);
      filterByCategory(catId);
    }
  } catch (e) {
    console.error("Błąd sprawdzania podkategorii", e);
    filterByCategory(catId);
  }

  renderBreadcrumbs();
};

window.goBackToPath = (index) => {
  if (index === 0) {
    goBackToMain();
    return;
  }

  const targetCategory = currentCategoryPath[index];

  currentCategoryPath.splice(index + 1);

  currentParentId = targetCategory.id;
  loadCategories(targetCategory.id);
  filterByCategory(targetCategory.id);
};


window.goBackToMain = () => {
  currentParentId = null;
  currentCategoryPath = [{ id: null, name: 'Główne' }];
  loadCategories(null);
  filterByCategory(null);
};


window.filterByCategory = (categoryId) => {
  selectedCategory = categoryId;
  const filter = document.getElementById('categoryFilter');
  if (filter) filter.value = categoryId || "";

  currentPage = 1;
  loadPosts();

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