import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

console.log('🚀 moderator-posts.js loaded');

let currentUser = null;
let editor = null;

async function init() {
  console.log('🎯 init() started');
  await checkAuth();
  console.log('✅ checkAuth() completed');
  initTinyMCE();
  await loadCategories();
  await loadPendingPosts();
  await loadMyPosts();
  setupEventListeners();
  console.log('✅ init() completed');
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

function initTinyMCE() {
  if (typeof tinymce === 'undefined') {
    console.error('TinyMCE not loaded yet, retrying...');
    setTimeout(initTinyMCE, 100);
    return;
  }
  
  tinymce.init({
    selector: '#postContent',
    height: 400,
    menubar: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount'
    ],
    toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
    content_style: 'body { font-family: Arial, sans-serif; font-size: 14px; color: #333; background: white; }',
    skin: 'oxide-dark',
    content_css: 'dark',
    setup: (ed) => {
      editor = ed;
    }
  });
}

async function loadCategories() {
  try {
    const categories = await fetchWithAuth('/api/forum/categories');
    const select = document.getElementById('postCategory');
    
    select.innerHTML = '<option value="">Wybierz kategorię...</option>' +
      categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

async function loadPendingPosts() {
  try {
    const posts = await fetchWithAuth('/api/forum/posts/pending/list');
    const list = document.getElementById('pendingPostsList');
    const count = document.getElementById('pendingCount');
    
    count.textContent = posts.length;
    
    if (posts.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak postów do zatwierdzenia</div>';
      return;
    }
    
    list.innerHTML = posts.map(post => `
      <div class="pending-item">
        <div class="pending-header">
          <h3>${post.title}</h3>
          <span class="pending-category">${post.category_name}</span>
        </div>
        <div class="pending-meta">
          <span>👤 ${post.author_username}</span>
          <span>🕒 ${formatDate(post.created_at)}</span>
        </div>
        <div class="pending-excerpt">
          ${extractExcerpt(post.content)}
        </div>
        <div class="pending-actions">
          <button class="btn btn-primary btn-sm" onclick="viewPost(${post.id})">👁️ Podgląd</button>
          <button class="btn btn-success btn-sm" onclick="approvePost(${post.id})">✅ Zatwierdź</button>
          <button class="btn btn-danger btn-sm" onclick="rejectPost(${post.id})">❌ Odrzuć</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load pending posts:', error);
  }
}

async function loadMyPosts() {
  try {
    // Get all posts and filter by current user
    const posts = await fetchWithAuth('/api/forum/posts?limit=50');
    const myPosts = posts.filter(p => p.author_username === currentUser.username);
    const list = document.getElementById('myPostsList');
    
    if (myPosts.length === 0) {
      list.innerHTML = '<div class="empty-state">Nie utworzyłeś jeszcze żadnych postów</div>';
      return;
    }
    
    list.innerHTML = myPosts.map(post => `
      <div class="my-post-item">
        <div class="post-status ${post.status}">
          ${post.status === 'approved' ? '✅ Zatwierdzony' : '⏳ Oczekuje'}
        </div>
        <h3><a href="post.html?id=${post.id}">${post.title}</a></h3>
        <div class="post-meta">
          <span>${post.category_name}</span>
          <span>💬 ${post.comment_count || 0} komentarzy</span>
          <span>🕒 ${formatDate(post.created_at)}</span>
        </div>
        <div class="post-actions">
          <button class="btn btn-secondary btn-sm" onclick="editPost(${post.id})">✏️ Edytuj</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMyPost(${post.id})">🗑️ Usuń</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load my posts:', error);
  }
}

function setupEventListeners() {
  document.getElementById('createPostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('postTitle').value.trim();
    const category_id = document.getElementById('postCategory').value;
    const content = editor.getContent();
    
    if (!title || !category_id || !content) {
      alert('Wypełnij wszystkie wymagane pola');
      return;
    }
    
    try {
      const result = await fetchWithAuth('/api/forum/posts', {
        method: 'POST',
        body: JSON.stringify({ title, category_id, content })
      });
      
      if (result.status === 'approved') {
        alert('✅ Post utworzony i automatycznie zatwierdzony (jako admin)');
      } else {
        alert('✅ Post utworzony i wysłany do zatwierdzenia');
      }
      
      document.getElementById('createPostForm').reset();
      editor.setContent('');
      
      loadPendingPosts();
      loadMyPosts();
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('❌ Błąd podczas tworzenia posta');
    }
  });
}

window.viewPost = (id) => {
  window.open(`post.html?id=${id}`, '_blank');
};

window.approvePost = async (id) => {
  if (!confirm('Czy na pewno chcesz zatwierdzić ten post?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/posts/${id}/approve`, {
      method: 'POST'
    });
    
    alert('✅ Post zatwierdzony');
    loadPendingPosts();
  } catch (error) {
    console.error('Failed to approve post:', error);
    alert('❌ Błąd podczas zatwierdzania posta');
  }
};

window.rejectPost = async (id) => {
  if (!confirm('Czy na pewno chcesz odrzucić ten post?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/posts/${id}/reject`, {
      method: 'POST'
    });
    
    alert('✅ Post odrzucony');
    loadPendingPosts();
  } catch (error) {
    console.error('Failed to reject post:', error);
    alert('❌ Błąd podczas odrzucania posta');
  }
};

window.editPost = async (id) => {
  // Simple implementation - could be enhanced with modal
  window.location.href = `post.html?id=${id}`;
};

window.deleteMyPost = async (id) => {
  if (!confirm('Czy na pewno chcesz usunąć ten post?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/posts/${id}`, {
      method: 'DELETE'
    });
    
    alert('✅ Post usunięty');
    loadMyPosts();
  } catch (error) {
    console.error('Failed to delete post:', error);
    alert('❌ Błąd podczas usuwania posta');
  }
};

function extractExcerpt(html) {
  const text = html.replace(/<[^>]*>/g, '');
  return text.length > 150 ? text.substring(0, 150) + '...' : text;
}

init();

