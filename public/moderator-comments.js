// public/moderator-comments.js

let currentUser = null;

async function init() {
  await setupAuth();
  await loadPendingComments();
  document.getElementById('refreshBtn').addEventListener('click', loadPendingComments);

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

      if (currentUser.role !== 'moderator' && currentUser.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
      }

      // Logika odkrywania linków w menu dla Admina
      if (currentUser.role === 'admin') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'block';

        const galleryManageLink = document.getElementById('galleryManageLink');
        if (galleryManageLink) galleryManageLink.style.display = 'block';
      }

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
    } else window.location.href = 'index.html';
  } catch (error) { window.location.href = 'index.html'; }
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

async function loadPendingComments() {
  try {
    const res = await fetch('/api/forum/comments/pending/list');
    const comments = await res.json();
    document.getElementById('pendingCount').textContent = comments.length;
    const list = document.getElementById('pendingCommentsList');

    if (comments.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak komentarzy do zatwierdzenia</div>';
      return;
    }

    list.innerHTML = comments.map(comment => `
      <div class="pending-comment-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div class="comment-context" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.5);">Post: <strong style="color: var(--primary-color);">${comment.post_title}</strong> | Kategoria: ${comment.category_name}</div>
          <div style="font-size: 13px; margin-top: 5px;">Autor: <strong>${comment.author_username}</strong></div>
        </div>
        <div class="comment-content-preview" style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; margin-bottom: 15px;">${comment.content}</div>
        <div class="comment-moderate-actions" style="display:flex; gap:10px;">
          <button class="btn btn-primary btn-sm" onclick="editAndApprove(${comment.id}, \`${comment.content.replace(/`/g, "\\`")}\`)" style="flex:1;">✏️ Edytuj</button>
          <button class="btn btn-success btn-sm" onclick="approveComment(${comment.id})" style="background:#28a745; border:none; color:white; flex:1;">✅ Zatwierdź</button>
          <button class="btn btn-danger btn-sm" onclick="rejectComment(${comment.id})" style="background:#dc3545; border:none; color:white; flex:1;">❌ Odrzuć</button>
          <button class="btn btn-secondary btn-sm" onclick="window.open('post.html?id=${comment.post_id}', '_blank')">👁️ Post</button>
        </div>
      </div>
    `).join('');
  } catch (error) { console.error(error); }
}

window.approveComment = async (id) => {
  if (!confirm('Zatwierdzić?')) return;
  try { await fetch(`/api/forum/comments/${id}/approve`, { method: 'POST' }); loadPendingComments(); } catch (e) { alert('Błąd zatwierdzania.'); }
};
window.rejectComment = async (id) => {
  if (!confirm('Odrzucić?')) return;
  try { await fetch(`/api/forum/comments/${id}/reject`, { method: 'POST' }); loadPendingComments(); } catch (e) { alert('Błąd odrzucania.'); }
};

window.editAndApprove = async (id, oldContent) => {
  const newContent = prompt('Edytuj treść:', oldContent);
  if (!newContent) return;
  if (newContent === oldContent) return approveComment(id);

  try {
    const res = await fetch(`/api/forum/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent })
    });

    if (!res.ok) throw new Error('Błąd zapisu');

    await fetch(`/api/forum/comments/${id}/approve`, { method: 'POST' });

    alert('✅ Edycja i zatwierdzenie udane!');
    loadPendingComments();
  } catch (e) {
    alert('Błąd podczas edycji i zatwierdzania. Spróbuj ponownie.');
  }
};

init();