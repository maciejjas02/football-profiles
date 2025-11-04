import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let selectedCategory = null;

async function init() {
  await checkAuth();
  await loadCategories();
  await loadPendingComments();
  setupEventListeners();
}

async function checkAuth() {
  try {
    currentUser = await getCurrentUser();
    
    if (!currentUser || (currentUser.role !== 'moderator' && currentUser.role !== 'admin')) {
      alert('Brak dostępu. Tylko moderatorzy i administratorzy mogą korzystać z tej strony.');
      window.location.href = 'forum.html';
      return;
    }
    
    // Display user info
    document.getElementById('who').textContent = currentUser.name || currentUser.username;
    document.getElementById('notificationsBtn').style.display = 'block';
    
    // Show admin link for admins
    if (currentUser.role === 'admin') {
      document.getElementById('adminLink').style.display = 'block';
    }
    
    // Setup notifications
    setupNotifications();
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = 'index.html';
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await handleLogout();
    window.location.href = 'index.html';
  });
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
  
  document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    await fetchWithAuth('/api/forum/notifications/read-all', { method: 'POST' });
    loadNotifications();
  });
  
  loadNotificationCount();
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

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Teraz';
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days < 7) return `${days} dni temu`;
  return date.toLocaleDateString('pl-PL');
}

async function loadCategories() {
  try {
    const categories = await fetchWithAuth('/api/forum/categories');
    const select = document.getElementById('categoryFilter');
    
    select.innerHTML = '<option value="">Wszystkie kategorie</option>' +
      categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

async function loadPendingComments() {
  try {
    const comments = await fetchWithAuth('/api/forum/comments/pending/list');
    const list = document.getElementById('pendingCommentsList');
    const count = document.getElementById('pendingCount');
    
    // Filter by category if selected
    let filteredComments = comments;
    if (selectedCategory) {
      filteredComments = comments.filter(c => c.category_id == selectedCategory);
    }
    
    count.textContent = filteredComments.length;
    
    if (filteredComments.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak komentarzy do zatwierdzenia</div>';
      return;
    }
    
    list.innerHTML = filteredComments.map(comment => `
      <div class="pending-comment-item">
        <div class="comment-context">
          <div class="context-header">
            <span class="context-category">${comment.category_name}</span>
            <span class="context-post">${comment.post_title}</span>
          </div>
          <div class="context-meta">
            <span>👤 ${comment.author_username}</span>
            <span>🕒 ${formatDate(comment.created_at)}</span>
          </div>
        </div>
        
        <div class="comment-content-preview">
          ${comment.content}
        </div>
        
        <div class="comment-moderate-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewPost(${comment.post_id})">
            👁️ Zobacz post
          </button>
          <button class="btn btn-primary btn-sm" onclick="editAndApprove(${comment.id})">
            ✏️ Edytuj i zatwierdź
          </button>
          <button class="btn btn-success btn-sm" onclick="approveComment(${comment.id})">
            ✅ Zatwierdź
          </button>
          <button class="btn btn-danger btn-sm" onclick="rejectComment(${comment.id})">
            ❌ Odrzuć
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load pending comments:', error);
    document.getElementById('pendingCommentsList').innerHTML = 
      '<div class="error-state">Błąd ładowania komentarzy</div>';
  }
}

function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadPendingComments();
  });
  
  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    selectedCategory = e.target.value ? parseInt(e.target.value) : null;
    loadPendingComments();
  });
}

window.viewPost = (postId) => {
  window.open(`post.html?id=${postId}`, '_blank');
};

window.approveComment = async (id) => {
  if (!confirm('Czy na pewno chcesz zatwierdzić ten komentarz?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/comments/${id}/approve`, {
      method: 'POST'
    });
    
    alert('✅ Komentarz zatwierdzony');
    loadPendingComments();
  } catch (error) {
    console.error('Failed to approve comment:', error);
    alert('❌ Błąd podczas zatwierdzania komentarza');
  }
};

window.rejectComment = async (id) => {
  if (!confirm('Czy na pewno chcesz odrzucić ten komentarz?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/comments/${id}/reject`, {
      method: 'POST'
    });
    
    alert('✅ Komentarz odrzucony');
    loadPendingComments();
  } catch (error) {
    console.error('Failed to reject comment:', error);
    alert('❌ Błąd podczas odrzucania komentarza');
  }
};

window.editAndApprove = async (id) => {
  const commentDiv = document.querySelector(`[onclick*="editAndApprove(${id})"]`)
    .closest('.pending-comment-item');
  const contentDiv = commentDiv.querySelector('.comment-content-preview');
  const currentContent = contentDiv.textContent.trim();
  
  const newContent = prompt('Edytuj komentarz przed zatwierdzeniem:', currentContent);
  if (!newContent) return;
  
  try {
    // First update the comment
    await fetchWithAuth(`/api/forum/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: newContent })
    });
    
    // Then approve it
    await fetchWithAuth(`/api/forum/comments/${id}/approve`, {
      method: 'POST'
    });
    
    alert('✅ Komentarz zaktualizowany i zatwierdzony');
    loadPendingComments();
  } catch (error) {
    console.error('Failed to edit and approve comment:', error);
    alert('❌ Błąd podczas edycji komentarza');
  }
};

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

init();
