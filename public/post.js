// public/post.js
import { fetchWithAuth } from './utils/api-client.js';
import { showToast } from './utils/ui.js'; // Opcjonalnie, jeśli masz ui.js

let currentUser = null;
let postId = null;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  postId = urlParams.get('id');
  if (!postId) return window.location.href = 'forum.html';

  await setupAuth();
  await loadPost();
  await loadComments();

  if (currentUser) {
    await loadNotifications();
  }
}

// --- AUTH & NOTIFICATIONS ---

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

      const commentForm = document.getElementById('commentFormSection');
      if (commentForm) commentForm.classList.remove('hidden');

      // Linki w menu
      if (['admin', 'moderator'].includes(currentUser.role)) {
        document.getElementById('moderatorLink')?.style.setProperty('display', 'block');
        document.getElementById('ordersLink')?.style.setProperty('display', 'block');
      }
      if (currentUser.role === 'admin') {
        document.getElementById('adminLink')?.style.setProperty('display', 'block');
        document.getElementById('galleryManageLink')?.style.setProperty('display', 'block');
      }

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = 'block';
        logoutBtn.onclick = async () => {
          await fetchWithAuth('/api/auth/logout', { method: 'POST' });
          window.location.href = '/';
        };
      }
    } else {
      document.getElementById('who').textContent = "Gość";
      document.getElementById('loginToComment')?.classList.remove('hidden');
      document.getElementById('logoutBtn').style.display = 'none';
    }
  } catch (error) { console.error(error); }
}

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
                </div>
            `).join('');
    }

    btn.onclick = (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.addEventListener('click', () => dropdown.style.display = 'none');

    document.getElementById('markAllReadBtn').onclick = async () => {
      await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' });
      loadNotifications();
    };

  } catch (e) { console.error(e); }
}

window.handleNotificationClick = async (id, link, isRead) => {
  if (isRead === 0) await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  if (link && link !== '#') window.location.href = link;
  else loadNotifications();
};

// --- POST & ACTIONS ---

async function loadPost() {
  try {
    const res = await fetch(`/api/forum/posts/${postId}`);
    if (!res.ok) throw new Error('Post not found');
    const post = await res.json();

    let actionButton = '';
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        actionButton = `<button onclick="window.openModPanel(${post.id})" class="btn btn-secondary btn-sm" style="float:right; margin-left:10px;">🛡️ Zgłoszenia</button>`;
      } else {
        actionButton = `<button onclick="window.openUserDiscussion(${post.id})" class="btn btn-danger btn-sm" style="float:right; margin-left:10px;">🚩 Zgłoś / Dyskusja</button>`;
      }
    }

    document.getElementById('postContent').innerHTML = `
            <div class="post-header-detail">
                ${actionButton}
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
  } catch (e) {
    document.getElementById('postContent').innerHTML = '<div class="error-state">Nie udało się wczytać posta.</div>';
  }
}

// --- COMMENTS SYSTEM (PEŁNY KOD) ---

function getRank(reputation, role) {
  if (role === 'admin') return '<span style="color:#ff4444; font-weight:bold; border: 1px solid #ff4444; padding: 2px 6px; border-radius: 4px;">ADMINISTRATOR 👑</span>';
  if (role === 'moderator') return '<span style="color:#00eaff; font-weight:bold; border: 1px solid #00eaff; padding: 2px 6px; border-radius: 4px;">MODERATOR 🛡️</span>';
  if (reputation < 0) return '<span style="color:red;">Troll 👹</span>';
  if (reputation === 0) return '<span style="color:var(--text-color); opacity:0.7;">Nowicjusz 🌱</span>';
  if (reputation > 0 && reputation < 10) return '<span style="color:var(--primary-color);">Kibic 🎗️</span>';
  return '<span style="color:#00eaff; text-shadow:0 0 5px cyan;">Ekspert 💎</span>';
}

async function loadComments() {
  try {
    // Używamy timestamp, aby uniknąć cache
    const res = await fetch(`/api/forum/posts/${postId}/comments?t=${Date.now()}`);
    const comments = await res.json();

    const countEl = document.getElementById('commentCount');
    if (countEl) countEl.textContent = comments.length;

    const list = document.getElementById('commentsList');

    if (comments.length === 0) {
      list.innerHTML = '<div class="comments-empty">Brak komentarzy. Bądź pierwszy!</div>';
      return;
    }

    list.innerHTML = comments.map(c => {
      const isLiked = c.user_vote === 1;
      const isDisliked = c.user_vote === -1;
      const colorLike = isLiked ? 'var(--success-color)' : 'var(--text-color)';
      const colorDislike = isDisliked ? 'var(--danger-color)' : 'var(--text-color)';
      const opacityBtn = (isLiked || isDisliked) ? '1' : '0.5';

      // Status Pending
      const isPending = c.status === 'pending';
      const pendingBadge = isPending ? '<span style="color:orange; border:1px solid orange; font-size:10px; padding:1px 4px; border-radius:4px; margin-left:5px;">⏳ Oczekuje</span>' : '';
      const cardStyle = isPending ? 'opacity: 0.7; border: 1px dashed orange;' : '';

      // Edycja (dla autora gdy pending)
      const canEdit = isPending && currentUser && currentUser.id === c.author_id;
      const editButton = canEdit
        ? `<button onclick="window.editComment(${c.id}, '${c.content.replace(/'/g, "\\'")}')" class="btn-text" style="color:orange; margin-left:10px;">✏️ Edytuj</button>`
        : '';

      const rank = getRank(c.author_reputation || 0, c.author_role);

      return `
                <div class="comment-card" id="comment-${c.id}" style="${cardStyle}">
                    <div class="comment-header">
                        <div class="comment-author">
                            <div class="comment-avatar">${c.author_username[0].toUpperCase()}</div>
                            <div>
                                <div class="comment-author-name">${c.author_username} ${rank} ${pendingBadge}</div>
                                <div class="comment-date">${new Date(c.created_at).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                    <div class="comment-content">${c.content}</div>
                    
                    ${!isPending ? `
                    <div class="comment-actions">
                        <button onclick="window.rateComment(${c.id}, 1)" class="comment-action-btn ${isLiked ? 'active like-active' : ''}" title="Lubię to">
                            👍 ${c.likes || 0}
                        </button>
                        <button onclick="window.rateComment(${c.id}, -1)" class="comment-action-btn ${isDisliked ? 'active dislike-active' : ''}" title="Nie lubię">
                            👎 ${c.dislikes || 0}
                        </button>
                    </div>
                    ` : ''}
                    ${editButton}
                </div>
            `;
    }).join('');
  } catch (e) { console.error(e); }
}

window.rateComment = async (id, rating) => {
  if (!currentUser) return alert('Zaloguj się, aby oceniać!');
  try {
    await fetchWithAuth(`/api/forum/comments/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating })
    });
    await loadComments(); // Odśwież, aby pokazać nowe liczniki
  } catch (e) { alert('Błąd: ' + e.message); }
};

window.editComment = async (id, oldContent) => {
  const newContent = prompt("Edytuj komentarz:", oldContent);
  if (newContent && newContent !== oldContent) {
    try {
      await fetchWithAuth(`/api/forum/comments/${id}/user-edit`, {
        method: 'PUT',
        body: JSON.stringify({ content: newContent })
      });
      loadComments();
    } catch (e) { alert('Błąd: ' + e.message); }
  }
};

const submitBtn = document.getElementById('submitCommentBtn');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const content = document.getElementById('commentContent').value.trim();
    if (!content) return;

    // Blokada przycisku
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Wysyłanie...";

    try {
      await fetchWithAuth(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      document.getElementById('commentContent').value = '';
      await loadComments();
    } catch (e) {
      alert('Błąd: ' + e.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// --- CHAT & MODERATION SYSTEM (NAPRAWIONE) ---

window.openUserDiscussion = async (pid) => {
  try {
    // Użytkownik pobiera swoje wiadomości dla tego posta
    const messages = await fetchWithAuth(`/api/discussion/${pid}/my`);
    showChatModal(pid, null, messages, 'Zgłoszenie / Rozmowa z Moderatorem');
  } catch (e) { alert("Błąd czatu: " + e.message); }
};

window.openModPanel = async (pid) => {
  try {
    // Moderator pobiera listę użytkowników, którzy zgłosili ten post
    const users = await fetchWithAuth(`/api/discussion/${pid}/users`);

    if (users.length === 0) return alert("Brak otwartych dyskusji dla tego posta.");

    // Prosty wybór ID (można by to zrobić ładniej, ale prompt wystarczy dla MVP)
    const userList = users.map(u => `ID ${u.id}: ${u.username}`).join('\n');
    const userId = prompt(`Wybierz ID użytkownika do rozmowy:\n${userList}`);

    if (userId) {
      const messages = await fetchWithAuth(`/api/discussion/${pid}/user/${userId}`);
      showChatModal(pid, userId, messages, `Rozmowa z userem ID: ${userId}`);
    }
  } catch (e) { alert("Błąd panelu: " + e.message); }
};

function showChatModal(pid, targetUserId, initialMessages, title) {
  // Usuń stary modal jeśli istnieje
  const old = document.getElementById('chatModal');
  if (old) old.remove();

  // Funkcja renderująca wiadomości (używana przy otwarciu i odświeżaniu)
  const renderMessages = (msgs) => {
    if (!msgs || msgs.length === 0) {
      return '<div style="text-align:center; padding:20px; color:var(--text-color); opacity:0.5;">Brak wiadomości. Napisz coś!</div>';
    }

    return msgs.map(m => {
      const isMod = (currentUser.role === 'admin' || currentUser.role === 'moderator');
      const senderIsMod = m.sender_type === 'moderator';

      // Logika: "Ja" to prawa strona.
      // Jeśli jestem modem i wysłał mod -> Ja.
      // Jeśli jestem userem i wysłał user -> Ja.
      const isMe = (isMod && senderIsMod) || (!isMod && !senderIsMod);

      const senderLabel = senderIsMod ? '🛡️ Moderator' : '👤 Użytkownik';

      return `
                <div class="chat-bubble ${isMe ? 'me' : 'other'}">
                    <div class="chat-meta">${senderLabel}</div>
                    ${m.message}
                </div>
            `;
    }).join('');
  };

  const modal = document.createElement('div');
  modal.id = 'chatModal';
  modal.className = 'chat-modal-overlay';
  modal.innerHTML = `
        <div class="chat-modal-box">
            <div class="chat-header">
                <h3>${title}</h3>
                <button id="chatCloseX" class="chat-close-btn">&times;</button>
            </div>
            <div id="chatBox" class="chat-messages-area">${renderMessages(initialMessages)}</div>
            <div class="chat-footer">
                <input id="chatInput" type="text" class="chat-input" placeholder="Napisz wiadomość..." autocomplete="off">
                <button id="chatSend" class="chat-send-btn">Wyślij</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  const chatBox = document.getElementById('chatBox');
  const input = document.getElementById('chatInput');
  chatBox.scrollTop = chatBox.scrollHeight;
  input.focus();

  const closeModal = () => modal.remove();
  document.getElementById('chatCloseX').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  const sendMessage = async () => {
    const txt = input.value.trim();
    if (!txt) return;

    const btn = document.getElementById('chatSend');
    btn.disabled = true;
    btn.textContent = '...';

    // Jeśli targetUserId jest ustawiony, to znaczy że pisze Moderator do Usera
    // Jeśli null, to User pisze do Moderacji (ogólny wątek tego posta)
    let url = targetUserId
      ? `/api/discussion/${pid}/reply/${targetUserId}`
      : `/api/discussion/${pid}`;

    try {
      await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ message: txt })
      });

      // NAPRAWA UX: Zamiast zamykać modal, czyścimy input i odświeżamy listę
      input.value = '';

      // Pobierz nowe wiadomości
      const refreshUrl = targetUserId
        ? `/api/discussion/${pid}/user/${targetUserId}`
        : `/api/discussion/${pid}/my`;

      const newMessages = await fetchWithAuth(refreshUrl);

      // Zaktualizuj HTML wiadomości
      chatBox.innerHTML = renderMessages(newMessages);
      chatBox.scrollTop = chatBox.scrollHeight; // Przewiń na dół

    } catch (e) {
      alert("Błąd wysyłania: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Wyślij';
      input.focus();
    }
  };

  document.getElementById('chatSend').onclick = sendMessage;
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

init();