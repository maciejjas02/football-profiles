// public/moderator-posts.js
import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let editingPostId = null;

async function init() {
  await setupAuth();
  await loadCategories();
  await loadPendingPosts();
  await loadMyPosts();
  initEditor();
  setupEventListeners();
  // Ładowanie powiadomień
  if (currentUser) {
    await loadNotifications();
  }
}

async function setupAuth() {
  try {
    currentUser = await getCurrentUser();

    if (!currentUser) {
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

    if (currentUser.role !== 'moderator' && currentUser.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }

    // === Odkrywanie linków w menu ===
    if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
      const ordersLink = document.getElementById('ordersLink');
      if (ordersLink) ordersLink.style.display = 'block';
    }

    if (currentUser.role === 'admin') {
      const adminLink = document.getElementById('adminLink');
      if (adminLink) adminLink.style.display = 'block';

      const galleryManageLink = document.getElementById('galleryManageLink');
      if (galleryManageLink) galleryManageLink.style.display = 'block';
    }

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await handleLogout();
      window.location.href = '/';
    });

  } catch (error) {
    console.error(error);
    window.location.href = 'index.html';
  }
}

// --- POWIADOMIENIA ---
async function loadNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const badge = document.getElementById('notificationBadge');
  const dropdown = document.getElementById('notificationsDropdown');
  const list = document.getElementById('notificationsList');

  if (!btn) return;

  try {
    const notifications = await fetchWithAuth('/api/user/notifications');
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
    await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  }
  if (link && link !== '#') {
    window.location.href = link;
  } else {
    loadNotifications();
  }
};
// --- KONIEC POWIADOMIEŃ ---

function initEditor() {
  if (typeof tinymce === 'undefined') return;
  if (tinymce.get('postContent')) tinymce.get('postContent').remove();
  tinymce.init({
    selector: '#postContent',
    height: 400,
    menubar: false,
    statusbar: false,
    plugins: 'lists link image code',
    toolbar: 'undo redo | bold italic | alignleft aligncenter | bullist numlist | image',
    skin: 'oxide-dark',
    content_css: 'dark',
    setup: function (editor) {
      editor.on('change', function () { editor.save(); });
    }
  });
}

async function loadCategories() {
  try {
    const categories = await fetchWithAuth('/api/forum/categories');
    document.getElementById('postCategory').innerHTML = '<option value="">Wybierz...</option>' +
      categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
  } catch (error) { console.error('Błąd ładowania kategorii:', error); }
}

async function loadPendingPosts() {
  try {
    const posts = await fetchWithAuth('/api/forum/posts/pending/list');
    const countEl = document.getElementById('pendingCount');
    if (countEl) countEl.textContent = posts.length;

    const list = document.getElementById('pendingPostsList');
    if (posts.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak postów do zatwierdzenia</div>';
      return;
    }

    list.innerHTML = posts.map(p => `
      <div class="pending-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px; border: 1px solid var(--border-color);">
        <h3 style="margin-top:0; font-size:16px; color:#FFD700;">${p.title}</h3>
        <div style="margin:5px 0; font-size:12px; color:#888;">Autor: ${p.author_username} | Kategoria: ${p.category_name}</div>
        
        <div style="background:rgba(0,0,0,0.3); padding:10px; margin:10px 0; border-radius:4px; max-height:150px; overflow:auto; font-size:13px;">
            ${p.content}
        </div>

        <div style="display:flex; gap:10px; flex-wrap: wrap;">
            <button onclick="approvePost(${p.id})" class="btn btn-success btn-sm" style="flex:1;">✅ Zatwierdź</button>
            <button onclick="rejectPost(${p.id})" class="btn btn-danger btn-sm" style="flex:1;">❌ Odrzuć</button>
            <button onclick="startEdit(${p.id})" class="btn btn-primary btn-sm" style="flex:1;">✏️ Popraw</button>
        </div>
      </div>
    `).join('');
  } catch (error) { console.error('Błąd pending posts:', error); }
}

async function loadMyPosts() {
  try {
    const allPosts = await fetchWithAuth('/api/forum/posts?limit=50&t=' + Date.now());
    const list = document.getElementById('myPostsList');

    if (allPosts.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak opublikowanych postów w systemie.</div>';
      return;
    }

    list.innerHTML = allPosts.map(p => `
        <div class="my-post-item" style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); padding:15px; border-radius:8px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <h3 style="margin:0; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 200px;">${p.title}</h3>
              <span style="color:#4ade80; font-size:11px; border:1px solid #4ade80; padding:2px 6px; border-radius:4px;">Opublikowany</span>
          </div>
          <div style="font-size:12px; color:#888; margin-bottom:10px;">Kat: ${p.category_name || '-'} | Autor: ${p.author_username}</div>
          <div style="display:flex; gap:10px;">
              <button onclick="startEdit(${p.id})" class="btn btn-primary btn-sm" style="flex:1;">✏️ Edytuj</button>
              <button onclick="window.open('post.html?id=${p.id}', '_blank')" class="btn btn-secondary btn-sm" style="flex:1;">👁️</button>
              <button onclick="deletePost(${p.id})" class="btn btn-danger btn-sm" style="width:30px;">🗑️</button>
          </div>
        </div>
      `).join('');
  } catch (error) { console.error('Błąd my posts:', error); }
}

window.startEdit = async (id) => {
  try {
    const post = await fetchWithAuth(`/api/forum/posts/${id}`);

    document.getElementById('postTitle').value = post.title;
    document.getElementById('postCategory').value = post.category_id;

    if (tinymce.get('postContent')) {
      tinymce.get('postContent').setContent(post.content);
    } else {
      document.getElementById('postContent').value = post.content;
    }

    editingPostId = id;
    const submitBtn = document.getElementById('submitPostBtn');
    submitBtn.textContent = "💾 Zapisz zmiany";
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-success');

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (e) {
    console.error(e);
    alert("Błąd podczas ładowania posta do edycji.");
  }
};

function resetForm() {
  document.getElementById('postTitle').value = '';
  document.getElementById('postCategory').value = '';
  if (tinymce.get('postContent')) tinymce.get('postContent').setContent('');
  document.getElementById('postContent').value = '';
  document.getElementById('postImageInput').value = '';

  editingPostId = null;
  const submitBtn = document.getElementById('submitPostBtn');
  submitBtn.textContent = "Utwórz post";
  submitBtn.classList.add('btn-primary');
  submitBtn.classList.remove('btn-success');
}

function setupEventListeners() {
  // OBSŁUGA UPLOADU ZDJĘĆ
  document.getElementById('uploadImageBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('postImageInput');
    const file = fileInput.files[0];
    if (!file) return alert('Wybierz plik!');

    const formData = new FormData();
    formData.append('image', file);

    try {
      // fetchWithAuth obsługuje FormData poprawnie (nie ustawia Content-Type, dodaje CSRF)
      const data = await fetchWithAuth('/api/forum/upload', { method: 'POST', body: formData });

      const imgHtml = `<img src="${data.location}" alt="Obrazek" style="max-width:100%; height:auto; border-radius:8px; margin:10px 0;" />`;
      if (typeof tinymce !== 'undefined' && tinymce.get('postContent')) {
        tinymce.get('postContent').insertContent(imgHtml);
      } else {
        document.getElementById('postContent').value += imgHtml;
      }
      alert('✅ Zdjęcie wstawione!');
      fileInput.value = '';
    } catch (e) {
      alert('Błąd uploadu: ' + e.message);
    }
  });

  document.getElementById('resetPostBtn').addEventListener('click', (e) => {
    e.preventDefault();
    resetForm();
  });

  // TWORZENIE / EDYCJA POSTA
  document.getElementById('submitPostBtn').addEventListener('click', async (e) => {
    e.preventDefault();

    const title = document.getElementById('postTitle').value.trim();
    const category_id = document.getElementById('postCategory').value;

    if (typeof tinymce !== 'undefined' && tinymce.get('postContent')) tinymce.triggerSave();
    const content = document.getElementById('postContent').value;

    if (!title || !category_id || !content) return alert('Wypełnij wszystkie pola!');

    const isEdit = editingPostId !== null;
    const url = isEdit ? `/api/forum/posts/${editingPostId}` : '/api/forum/posts';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      await fetchWithAuth(url, {
        method: method,
        body: JSON.stringify({ title, category_id, content })
      });

      alert(isEdit ? '✅ Post zaktualizowany!' : '✅ Post utworzony!');
      resetForm();
      loadMyPosts();
      loadPendingPosts();
    } catch (e) { alert('Błąd: ' + e.message); }
  });
}

window.approvePost = async (id) => {
  if (!confirm('Zatwierdzić ten post?')) return;
  try {
    await fetchWithAuth(`/api/forum/posts/${id}/approve`, { method: 'POST' });
    loadPendingPosts();
    loadMyPosts();
  } catch (e) { alert('Błąd: ' + e.message); }
};

window.rejectPost = async (id) => {
  if (!confirm('Odrzucić ten post?')) return;
  try {
    await fetchWithAuth(`/api/forum/posts/${id}/reject`, { method: 'POST' });
    loadPendingPosts();
  } catch (e) { alert('Błąd: ' + e.message); }
};

window.deletePost = async (id) => {
  if (!confirm('Czy na pewno chcesz usunąć ten post bezpowrotnie?')) return;
  try {
    await fetchWithAuth(`/api/forum/posts/${id}`, { method: 'DELETE' });
    loadMyPosts();
  } catch (e) { alert('Błąd: ' + e.message); }
}

init();