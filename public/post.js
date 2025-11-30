// public/post.js

// DODANO: Importujemy fetchWithAuth do obsługi CSRF
import { fetchWithAuth } from './utils/api-client.js';

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
          // Używamy fetchWithAuth dla POST
          try {
            await fetchWithAuth('/api/auth/logout', { method: 'POST' });
          } catch (e) {
            console.error('Logout error (CSRF likely):', e);
          }
          window.location.href = '/';
        };
      }
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        const ordersLink = document.getElementById('ordersLink');
        if (ordersLink) ordersLink.style.display = 'block';
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

// --- POWIADOMIENIA (Poprawiono CSRF) ---
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
        // Używamy fetchWithAuth dla POST
        await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' });
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
    // Używamy fetchWithAuth dla POST
    await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  }
  if (link && link !== '#') {
    window.location.href = link;
  } else {
    loadNotifications();
  }
};

// --- POST & ZGŁOSZENIA ---
async function loadPost() {
  try {
    const res = await fetch(`/api/forum/posts/${postId}`);
    const post = await res.json();

    // Przycisk Zgłoś / Dyskusja
    let actionButton = '';
    if (currentUser) {
      // Używamy fetchWithAuth do sprawdzenia uprawnień (przykład)
      if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
        actionButton = `<button onclick="openModPanel(${post.id})" class="btn btn-secondary btn-sm" style="float:right; margin-left:10px;">🛡️ Zgłoszenia</button>`;
      } else {
        actionButton = `<button onclick="openUserDiscussion(${post.id})" class="btn btn-danger btn-sm" style="float:right; margin-left:10px;">🚩 Zgłoś / Dyskusja</button>`;
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
  } catch (e) { document.getElementById('postContent').innerHTML = 'Błąd wczytywania posta.'; }
}

// --- KOMENTARZE ---

function getRank(reputation, role) {
  if (role === 'admin')
    return '<span style="color:#ff4444; font-weight:bold; border: 1px solid #ff4444; padding: 2px 6px; border-radius: 4px;">ADMINISTRATOR 👑</span>';
  if (role === 'moderator')
    return '<span style="color:#00eaff; font-weight:bold; border: 1px solid #00eaff; padding: 2px 6px; border-radius: 4px;">MODERATOR 🛡️</span>';


  if (reputation < 0) return '<span style="color:red;">Troll 👹</span>';
  if (reputation === 0) return '<span style="color:#ccc;">Nowicjusz 🌱</span>';
  if (reputation > 0 && reputation < 2) return '<span style="color:#FFD700;">Kibic 🎗️</span>';
  return '<span style="color:#00eaff; text-shadow:0 0 5px cyan;">Ekspert 💎</span>';
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

      // Status Pending
      const isPending = c.status === 'pending';
      const pendingBadge = isPending ? '<span style="color:orange; border:1px solid orange; font-size:10px; padding:1px 4px; border-radius:4px; margin-left:5px;">⏳ Oczekuje na akceptację</span>' : '';
      const cardStyle = isPending ? 'opacity: 0.7; border: 1px dashed orange;' : '';

      // Edycja (dla autora, gdy pending)
      const canEdit = isPending && currentUser && currentUser.id === c.author_id;
      const editButton = canEdit
        ? `<button onclick="editComment(${c.id}, '${c.content.replace(/'/g, "\\'")}')" class="btn-sm" style="color:orange; border:1px solid orange; margin-left:10px; cursor:pointer; background:transparent;">✏️ Edytuj</button>`
        : '';

      // Ranga
      const rank = getRank(c.author_reputation || 0, c.author_role);

      return `
          <div class="comment-card" id="comment-${c.id}" style="${cardStyle}">
            <div class="comment-header">
              <div>
                <strong>${c.author_username}</strong> ${rank}
                ${pendingBadge}
              </div>
              <span style="font-size:12px; color:#666">${new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div class="comment-content" id="comment-content-${c.id}">${c.content}</div>
            <div class="comment-actions">
                ${!isPending ? `
                <button onclick="window.rateComment(${c.id}, 1)" class="btn-sm" style="border:1px solid ${colorLike}; color:${colorLike}; background:rgba(255,255,255,0.05); cursor:pointer;">
                    👍 ${c.likes || 0}
                </button>
                <button onclick="window.rateComment(${c.id}, -1)" class="btn-sm" style="border:1px solid ${colorDislike}; color:${colorDislike}; background:rgba(255,255,255,0.05); cursor:pointer;">
                    👎 ${c.dislikes || 0}
                </button>
                ` : ''}
                ${editButton}
            </div>
          </div>
        `;
    }).join('');
  } catch (e) { console.error(e); }
}

window.rateComment = async (id, rating) => {
  if (!currentUser) return alert('Zaloguj się!');
  try {
    // Używamy fetchWithAuth dla POST
    const res = await fetchWithAuth(`/api/forum/comments/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating })
    });
    if (res.success) await loadComments();
    else alert('Błąd oceniania');
  } catch (e) { alert('Błąd połączenia: ' + e.message); }
};

window.editComment = async (id, oldContent) => {
  const newContent = prompt("Edytuj swój komentarz:", oldContent);
  if (newContent && newContent !== oldContent) {
    try {
      // Używamy fetchWithAuth dla PUT
      await fetchWithAuth(`/api/forum/comments/${id}/user-edit`, {
        method: 'PUT',
        body: JSON.stringify({ content: newContent })
      });
      loadComments();
    } catch (e) { alert('Błąd edycji: ' + e.message); }
  }
};

const submitBtn = document.getElementById('submitCommentBtn');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const content = document.getElementById('commentContent').value.trim();
    if (!content) return;

    try {
      // Używamy fetchWithAuth dla POST
      await fetchWithAuth(`/api/forum/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });

      document.getElementById('commentContent').value = '';
      loadComments();
    } catch (e) {
      alert('Błąd wysyłania komentarza: ' + e.message);
    }
  });
}

// --- MODAL CZATU (ZGŁOSZENIA) ---

// Używamy fetchWithAuth dla wszystkich POST/PUT/DELETE w modalach czatu

window.openUserDiscussion = async (pid) => {
  const messages = await (await fetchWithAuth(`/api/discussion/${pid}/my`)).json();
  showChatModal(pid, null, messages, 'Zgłoszenie / Rozmowa z Moderatorem');
};

window.openModPanel = async (pid) => {
  const users = await (await fetchWithAuth(`/api/discussion/${pid}/users`)).json();
  if (users.length === 0) return alert("Brak zgłoszeń dla tego posta.");
  const userList = users.map(u => `${u.id}: ${u.username}`).join('\n');
  const userId = prompt(`Wybierz ID użytkownika do rozmowy:\n${userList}`);
  if (userId) {
    const messages = await (await fetchWithAuth(`/api/discussion/${pid}/user/${userId}`)).json();
    showChatModal(pid, userId, messages, `Rozmowa z userem ID: ${userId}`);
  }
};

function showChatModal(pid, targetUserId, messages, title) {
  const old = document.getElementById('chatModal');
  if (old) old.remove();

  const msgsHtml = messages.map(m => {
    const isMod = (currentUser.role === 'admin' || currentUser.role === 'moderator');
    const senderIsMod = m.sender_type === 'moderator';
    let isMe = (isMod && senderIsMod) || (!isMod && !senderIsMod);
    const senderName = senderIsMod ? '🛡️ Moderator' : '👤 Użytkownik';

    return `
            <div class="chat-bubble ${isMe ? 'me' : 'other'}">
                <div class="chat-meta">${senderName}</div>
                ${m.message}
            </div>
        `;
  }).join('') || '<div style="text-align:center; color:#555; margin-top:50px;">Brak wiadomości. Rozpocznij dyskusję!</div>';

  const modal = document.createElement('div');
  modal.id = 'chatModal';
  modal.className = 'chat-modal-overlay';

  modal.innerHTML = `
        <div class="chat-modal-box">
            <div class="chat-header">
                <h3>${title}</h3>
                <button id="chatCloseX" class="chat-close-btn">&times;</button>
            </div>
            <div id="chatBox" class="chat-messages-area">${msgsHtml}</div>
            <div class="chat-footer">
                <input id="chatInput" type="text" class="chat-input" placeholder="Napisz wiadomość..." autocomplete="off">
                <button id="chatSend" class="chat-send-btn">Wyślij</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);
  const box = document.getElementById('chatBox');
  box.scrollTop = box.scrollHeight;
  const input = document.getElementById('chatInput');
  input.focus();

  const closeModal = () => modal.remove();
  document.getElementById('chatCloseX').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  const sendMessage = async () => {
    const txt = input.value.trim();
    if (!txt) return;
    const btn = document.getElementById('chatSend');
    btn.disabled = true; btn.textContent = '...';

    let url = targetUserId
      ? `/api/discussion/${pid}/reply/${targetUserId}`
      : `/api/discussion/${pid}`;

    try {
      // Używamy fetchWithAuth dla POST
      await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ message: txt })
      });

      // Ponowne ładowanie dyskusji (unikamy alertu, jeśli się uda)
      modal.remove();
      if (targetUserId) window.openModPanel(pid);
      else window.openUserDiscussion(pid);

    } catch (e) {
      alert("Błąd wysyłania: " + e.message);
      btn.disabled = false;
      btn.textContent = 'Wyślij';
    }
  };

  document.getElementById('chatSend').onclick = sendMessage;
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

init();