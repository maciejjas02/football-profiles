import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let postId = null;
let post = null;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  postId = urlParams.get('id');
  
  if (!postId) {
    window.location.href = 'forum.html';
    return;
  }
  
  setupAuth();
  await loadPost();
  await loadComments();
  setupCommentForm();
  setupNotifications();
}

async function setupAuth() {
  try {
    currentUser = await getCurrentUser();
    
    if (currentUser) {
      document.getElementById('who').textContent = currentUser.name || currentUser.username;
      document.getElementById('notificationsBtn').style.display = 'block';
      document.getElementById('commentFormSection').style.display = 'block';
      
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

async function loadPost() {
  try {
    post = await fetchWithAuth(`/api/forum/posts/${postId}`);
    const postContent = document.getElementById('postContent');
    
    postContent.innerHTML = `
      <div class="post-header-detail">
        <h1>${post.title}</h1>
        <div class="post-meta-detail">
          <span class="post-category">${post.category_name}</span>
          <span>👤 ${post.author_username}</span>
          <span>🕒 ${formatDate(post.created_at)}</span>
        </div>
      </div>
      <div class="post-content-html">
        ${post.content}
      </div>
      ${post.status === 'pending' ? '<div class="post-pending">⏳ Ten post oczekuje na zatwierdzenie</div>' : ''}
    `;
    
    // Load discussion if user is post author
    if (currentUser && currentUser.id === post.author_id) {
      loadDiscussion();
    }
  } catch (error) {
    console.error('Failed to load post:', error);
    document.getElementById('postContent').innerHTML = 
      '<div class="error-state">Nie znaleziono posta lub nie masz uprawnień do jego wyświetlenia</div>';
  }
}

async function loadComments() {
  try {
    const comments = await fetchWithAuth(`/api/forum/posts/${postId}/comments`);
    const commentsList = document.getElementById('commentsList');
    const commentCount = document.getElementById('commentCount');
    
    commentCount.textContent = comments.length;
    
    if (comments.length === 0) {
      commentsList.innerHTML = '<div class="comments-empty">Brak komentarzy. Bądź pierwszy!</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
      <div class="comment-item" id="comment-${comment.id}">
        <div class="comment-header">
          <div class="comment-author">
            <span class="author-name">👤 ${comment.author_username}</span>
            <span class="author-reputation" title="Reputacja">⭐ ${comment.author_reputation || 0}</span>
          </div>
          <div class="comment-meta">
            <span>🕒 ${formatDate(comment.created_at)}</span>
          </div>
        </div>
        <div class="comment-content">
          ${comment.content}
        </div>
        <div class="comment-actions">
          <div class="comment-rating">
            <button 
              class="rating-btn ${getUserRating(comment.id) === 1 ? 'active' : ''}" 
              onclick="rateComment(${comment.id}, 1)"
              ${!currentUser ? 'disabled' : ''}
            >
              👍 <span>${comment.rating > 0 ? '+' + comment.rating : comment.rating || 0}</span>
            </button>
            <button 
              class="rating-btn ${getUserRating(comment.id) === -1 ? 'active' : ''}" 
              onclick="rateComment(${comment.id}, -1)"
              ${!currentUser ? 'disabled' : ''}
            >
              👎
            </button>
          </div>
          ${currentUser && (currentUser.id === comment.author_id || currentUser.role === 'moderator' || currentUser.role === 'admin') ? `
            <button class="btn-text" onclick="editComment(${comment.id})">✏️ Edytuj</button>
            <button class="btn-text danger" onclick="deleteComment(${comment.id})">🗑️ Usuń</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load comments:', error);
  }
}

function getUserRating(commentId) {
  // This would need to be fetched from API in real implementation
  return 0;
}

function setupCommentForm() {
  const form = document.getElementById('commentForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = document.getElementById('commentContent').value.trim();
    if (!content) return;
    
    try {
      await fetchWithAuth(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      
      document.getElementById('commentContent').value = '';
      alert('✅ Komentarz wysłany do moderacji. Pojawi się po zatwierdzeniu.');
      
      // Reload comments after short delay
      setTimeout(() => loadComments(), 1000);
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('❌ Błąd podczas dodawania komentarza');
    }
  });
}

window.rateComment = async (commentId, rating) => {
  if (!currentUser) {
    alert('Zaloguj się, aby ocenić komentarz');
    return;
  }
  
  try {
    await fetchWithAuth(`/api/forum/comments/${commentId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating })
    });
    
    loadComments(); // Reload to show updated rating
  } catch (error) {
    console.error('Failed to rate comment:', error);
    alert('❌ Błąd podczas oceniania komentarza');
  }
};

window.editComment = async (commentId) => {
  const commentDiv = document.getElementById(`comment-${commentId}`);
  const contentDiv = commentDiv.querySelector('.comment-content');
  const currentContent = contentDiv.textContent.trim();
  
  const newContent = prompt('Edytuj komentarz:', currentContent);
  if (!newContent || newContent === currentContent) return;
  
  try {
    await fetchWithAuth(`/api/forum/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: newContent })
    });
    
    alert('✅ Komentarz zaktualizowany');
    loadComments();
  } catch (error) {
    console.error('Failed to edit comment:', error);
    alert('❌ Błąd podczas edycji komentarza');
  }
};

window.deleteComment = async (commentId) => {
  if (!confirm('Czy na pewno chcesz usunąć ten komentarz?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/comments/${commentId}`, {
      method: 'DELETE'
    });
    
    alert('✅ Komentarz usunięty');
    loadComments();
  } catch (error) {
    console.error('Failed to delete comment:', error);
    alert('❌ Błąd podczas usuwania komentarza');
  }
};

async function loadDiscussion() {
  try {
    const messages = await fetchWithAuth(`/api/forum/posts/${postId}/discuss`);
    
    if (messages.length === 0) return;
    
    const discussionSection = document.getElementById('discussionSection');
    discussionSection.style.display = 'block';
    
    const messagesDiv = document.getElementById('discussionMessages');
    messagesDiv.innerHTML = messages.map(msg => `
      <div class="discussion-message ${msg.from_user ? 'from-user' : 'from-moderator'}">
        <div class="message-header">
          <strong>${msg.from_user ? msg.user_username : msg.moderator_username}</strong>
          <span>${formatDate(msg.created_at)}</span>
        </div>
        <div class="message-content">${msg.message}</div>
      </div>
    `).join('');
    
    setupDiscussionForm();
  } catch (error) {
    console.error('Failed to load discussion:', error);
  }
}

function setupDiscussionForm() {
  const form = document.getElementById('discussionForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = document.getElementById('discussionMessage').value.trim();
    if (!message) return;
    
    // Get moderator ID from category
    const moderatorId = 1; // Would need to fetch this from API
    
    try {
      await fetchWithAuth(`/api/forum/posts/${postId}/discuss`, {
        method: 'POST',
        body: JSON.stringify({ message, moderator_id: moderatorId })
      });
      
      document.getElementById('discussionMessage').value = '';
      loadDiscussion();
    } catch (error) {
      console.error('Failed to send discussion message:', error);
      alert('❌ Błąd podczas wysyłania wiadomości');
    }
  });
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

async function setupNotifications() {
  if (!currentUser) return;
  
  const notificationBtn = document.getElementById('notificationBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  
  notificationBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationDropdown.classList.toggle('show');
    if (notificationDropdown.classList.contains('show')) {
      loadNotifications();
    }
  });
  
  document.addEventListener('click', () => {
    notificationDropdown.classList.remove('show');
  });
  
  notificationDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
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
    badge.style.display = notifications.length > 0 ? 'flex' : 'none';
  } catch (error) {
    console.error('Failed to load notification count:', error);
  }
}

async function loadNotifications() {
  try {
    const notifications = await fetchWithAuth('/api/forum/notifications');
    const list = document.getElementById('notificationList');
    
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
