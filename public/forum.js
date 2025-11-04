import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let currentPage = 1;
let selectedCategory = null;
const POSTS_PER_PAGE = 20;

async function init() {
  setupAuth();
  await loadCategories();
  await loadPosts();
  setupPagination();
  setupNotifications();
}

async function setupAuth() {
  try {
    currentUser = await getCurrentUser();
    
    if (currentUser) {
      document.getElementById('who').textContent = currentUser.name || currentUser.username;
      document.getElementById('notificationsBtn').style.display = 'block';
      
      if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
        document.getElementById('moderatorLink').style.display = 'block';
      }
      
      if (currentUser.role === 'admin') {
        document.getElementById('adminLink').style.display = 'block';
      }
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = 'index.html';
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await handleLogout();
    window.location.href = 'index.html';
  });
}

async function loadCategories() {
  try {
    const categories = await fetchWithAuth('/api/forum/categories');
    const categoriesList = document.getElementById('categoriesList');
    const categoryFilter = document.getElementById('categoryFilter');
    
    categoriesList.innerHTML = categories.map(cat => `
      <div class="category-card" data-id="${cat.id}">
        <h3>${cat.name}</h3>
        <p>${cat.description}</p>
        <div class="category-stats">
          <span>📄 ${cat.post_count || 0} postów</span>
          ${cat.subcategory_count > 0 ? `<span>📁 ${cat.subcategory_count} podkategorii</span>` : ''}
        </div>
        <button class="btn btn-primary" onclick="filterByCategory(${cat.id})">Zobacz posty</button>
      </div>
    `).join('');
    
    // Fill filter dropdown
    categoryFilter.innerHTML = '<option value="">Wszystkie kategorie</option>' +
      categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    categoryFilter.addEventListener('change', (e) => {
      selectedCategory = e.target.value ? parseInt(e.target.value) : null;
      currentPage = 1;
      loadPosts();
    });
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

window.filterByCategory = (categoryId) => {
  selectedCategory = categoryId;
  document.getElementById('categoryFilter').value = categoryId;
  currentPage = 1;
  loadPosts();
  document.getElementById('postsSection').scrollIntoView({ behavior: 'smooth' });
};

async function loadPosts() {
  try {
    const offset = (currentPage - 1) * POSTS_PER_PAGE;
    let url = `/api/forum/posts?limit=${POSTS_PER_PAGE}&offset=${offset}`;
    
    if (selectedCategory) {
      url += `&category_id=${selectedCategory}`;
    }
    
    const posts = await fetchWithAuth(url);
    const postsList = document.getElementById('postsList');
    
    if (posts.length === 0) {
      postsList.innerHTML = '<div class="empty-state">Brak postów w tej kategorii</div>';
      return;
    }
    
    postsList.innerHTML = posts.map(post => `
      <div class="post-card">
        <div class="post-header">
          <h3><a href="post.html?id=${post.id}">${post.title}</a></h3>
          <span class="post-category">${post.category_name}</span>
        </div>
        <div class="post-meta">
          <span>👤 ${post.author_username}</span>
          <span>💬 ${post.comment_count || 0} komentarzy</span>
          <span>🕒 ${formatDate(post.created_at)}</span>
        </div>
        <div class="post-excerpt">
          ${extractExcerpt(post.content)}
        </div>
        <a href="post.html?id=${post.id}" class="btn btn-primary btn-sm">Czytaj więcej</a>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load posts:', error);
    document.getElementById('postsList').innerHTML = 
      '<div class="error-state">Błąd ładowania postów</div>';
  }
}

function extractExcerpt(html) {
  const text = html.replace(/<[^>]*>/g, ''); // Strip HTML tags
  return text.length > 200 ? text.substring(0, 200) + '...' : text;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days < 7) return `${days} dni temu`;
  
  return date.toLocaleDateString('pl-PL');
}

function setupPagination() {
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadPosts();
      updatePageInfo();
    }
  });
  
  document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    loadPosts();
    updatePageInfo();
  });
}

function updatePageInfo() {
  document.getElementById('pageInfo').textContent = `Strona ${currentPage}`;
}

async function setupNotifications() {
  if (!currentUser) return;
  
  const notificationsBtn = document.getElementById('notificationsBtn');
  const notificationsDropdown = document.getElementById('notificationsDropdown');
  
  notificationsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = notificationsDropdown.style.display === 'block';
    notificationsDropdown.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      loadNotifications();
    }
  });
  
  document.addEventListener('click', () => {
    notificationsDropdown.style.display = 'none';
  });
  
  notificationsDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    await fetchWithAuth('/api/forum/notifications/read-all', { method: 'POST' });
    loadNotifications();
  });
  
  // Load initial count
  loadNotificationCount();
  
  // Refresh every 30 seconds
  setInterval(loadNotificationCount, 30000);
}

async function loadNotificationCount() {
  if (!currentUser) return;
  
  try {
    const notifications = await fetchWithAuth('/api/forum/notifications?unread=true');
    const badge = document.getElementById('notificationBadge');
    badge.textContent = notifications.length;
    badge.style.display = notifications.length > 0 ? 'inline-flex' : 'none';
  } catch (error) {
    console.error('Failed to load notification count:', error);
  }
}

async function loadNotifications() {
  try {
    const notifications = await fetchWithAuth('/api/forum/notifications');
    const list = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
      list.innerHTML = '<div class="notification-empty">Brak powiadomień</div>';
      return;
    }
    
    list.innerHTML = notifications.map(notif => `
      <div class="notification-item ${notif.is_read ? '' : 'unread'}" onclick="markAsRead(${notif.id})">
        <div class="notification-title">${notif.title}</div>
        <div class="notification-message">${notif.message}</div>
        <div class="notification-time">${formatDate(notif.created_at)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load notifications:', error);
  }
}

window.markAsRead = async (id) => {
  try {
    await fetchWithAuth(`/api/forum/notifications/${id}/read`, { method: 'POST' });
    loadNotifications();
    loadNotificationCount();
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
};

init();
