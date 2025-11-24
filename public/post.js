// public/post.js

let currentUser = null;
let postId = null;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  postId = urlParams.get('id');
  if (!postId) return window.location.href = 'forum.html';

  await setupAuth();
  await loadPost();
  await loadComments();

  // Dodano: ładowanie powiadomień
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
      document.getElementById('commentFormSection')?.classList.remove('hidden');

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = 'block';
        logoutBtn.onclick = async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          window.location.href = '/';
        };
      }

      // Logika odkrywania linków w menu
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
      document.getElementById('loginToComment')?.classList.remove('hidden');
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'none';
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
// --- KONIEC POWIADOMIEŃ ---

async function loadPost() {
  try {
    const res = await fetch(`/api/forum/posts/${postId}`);
    const post = await res.json();
    document.getElementById('postContent').innerHTML = `
      <div class="post-header-detail">
        <h1>${post.title}</h1>
        <div class="post-meta-detail">
          <span class="post-category">${post.category_name || 'Ogólne'}</span>
          <span>👤 ${post.author_username}</span>
          <span>🕒 ${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="post-content-html">${post.content}</div>
    `;
    document.getElementById('postContent').classList.remove('hidden');
    document.getElementById('commentsSection').classList.remove('hidden');
  } catch (e) { document.getElementById('postContent').innerHTML = 'Błąd wczytywania posta.'; }
}

async function loadComments() {
  try {
    const res = await fetch(`/api/forum/posts/${postId}/comments?t=${Date.now()}`);
    const comments = await res.json();

    document.getElementById('commentCount').textContent = comments.length;
    const list = document.getElementById('commentsList');

    if (comments.length === 0) {
      list.innerHTML = '<div class="comments-empty">Brak komentarzy.</div>';
      return;
    }

    list.innerHTML = comments.map(c => {
      const isLiked = c.user_vote === 1;
      const isDisliked = c.user_vote === -1;
      const colorLike = isLiked ? '#4ade80' : '#ccc';
      const colorDislike = isDisliked ? '#f87171' : '#ccc';

      return `
          <div class="comment-card">
            <div class="comment-header">
              <strong>${c.author_username}</strong> <span style="font-size:12px; color:#666">${new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div class="comment-content">${c.content}</div>
            <div class="comment-actions">
                <button onclick="window.rateComment(${c.id}, 1)" class="btn-sm" style="border:1px solid ${colorLike}; color:${colorLike}; background:rgba(255,255,255,0.05); cursor:pointer;">
                    👍 ${c.likes || 0}
                </button>
                <button onclick="window.rateComment(${c.id}, -1)" class="btn-sm" style="border:1px solid ${colorDislike}; color:${colorDislike}; background:rgba(255,255,255,0.05); cursor:pointer;">
                    👎 ${c.dislikes || 0}
                </button>
            </div>
          </div>
        `;
    }).join('');
  } catch (e) { console.error(e); }
}

window.rateComment = async (id, rating) => {
  if (!currentUser) return alert('Zaloguj się!');

  try {
    const res = await fetch(`/api/forum/comments/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    });

    if (res.ok) {
      await loadComments();
    } else {
      console.error('Błąd serwera:', await res.text());
    }
  } catch (e) { alert('Błąd połączenia'); }
};

const submitBtn = document.getElementById('submitCommentBtn');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const content = document.getElementById('commentContent').value.trim();
    if (!content) return;
    await fetch(`/api/forum/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    document.getElementById('commentContent').value = '';
    loadComments();
  });
}

init();