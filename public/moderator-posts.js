let currentUser = null;

async function init() {
  await setupAuth();
  await loadCategories();
  await loadPendingPosts();
  await loadMyPosts();
  initEditor();
  setupEventListeners();
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
      if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
    } else window.location.href = 'index.html';
  } catch (error) { window.location.href = 'index.html'; }
}

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
    const res = await fetch('/api/forum/categories');
    const categories = await res.json();
    document.getElementById('postCategory').innerHTML = '<option value="">Wybierz...</option>' +
      categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
  } catch (error) {}
}

async function loadPendingPosts() {
  try {
    const res = await fetch('/api/forum/posts/pending/list');
    const posts = await res.json();
    document.getElementById('pendingCount').textContent = posts.length;
    const list = document.getElementById('pendingPostsList');
    if (posts.length === 0) { list.innerHTML = '<div class="empty-state">Brak</div>'; return; }
    list.innerHTML = posts.map(p => `
      <div class="pending-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px;">
        <h3>${p.title}</h3>
        <div style="margin:10px 0; font-size:13px;">Autor: ${p.author_username}</div>
        <div style="display:flex; gap:10px;">
            <button onclick="approvePost(${p.id})" class="btn btn-success btn-sm" style="background:#28a745; color:white; border:none;">✅ Zatwierdź</button>
            <button onclick="rejectPost(${p.id})" class="btn btn-danger btn-sm" style="background:#dc3545; color:white; border:none;">❌ Odrzuć</button>
        </div>
      </div>
    `).join('');
  } catch (error) {}
}

async function loadMyPosts() {
    try {
      const res = await fetch('/api/forum/posts?limit=50');
      const allPosts = await res.json();
      const myPosts = allPosts.filter(p => p.author_username === currentUser.username);
      const list = document.getElementById('myPostsList');
      
      if (myPosts.length === 0) {
        list.innerHTML = '<div class="empty-state">Brak</div>';
        return;
      }
      list.innerHTML = myPosts.map(p => `
        <div class="my-post-item" style="background:rgba(255,255,255,0.05); border:1px solid #333; padding:15px; border-radius:8px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
              <h3 style="margin:0; font-size:16px;">${p.title}</h3>
              <span style="color:#4ade80; font-size:12px;">Opublikowany</span>
          </div>
          <div style="display:flex; gap:10px;">
              <button onclick="window.open('post.html?id=${p.id}', '_blank')" class="btn btn-secondary btn-sm">👁️</button>
              <button onclick="deletePost(${p.id})" class="btn btn-danger btn-sm">🗑️</button>
          </div>
        </div>
      `).join('');
    } catch (error) {}
}

function setupEventListeners() {
  document.getElementById('uploadImageBtn').addEventListener('click', async () => {
      const fileInput = document.getElementById('postImageInput');
      const file = fileInput.files[0];
      if(!file) return alert('Wybierz plik!');
      
      const formData = new FormData();
      formData.append('image', file);
      
      try {
          const res = await fetch('/api/forum/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if(res.ok) {
              const imgHtml = `<img src="${data.location}" alt="Obrazek" style="max-width:100%; height:auto; border-radius:8px; margin:10px 0;" />`;
              if(typeof tinymce !== 'undefined' && tinymce.get('postContent')) tinymce.get('postContent').insertContent(imgHtml);
              else document.getElementById('postContent').value += imgHtml;
              alert('✅ Zdjęcie wstawione!');
              fileInput.value = '';
          } else alert('Błąd uploadu');
      } catch(e) { alert('Błąd połączenia'); }
  });

  document.getElementById('submitPostBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const title = document.getElementById('postTitle').value.trim();
    const category_id = document.getElementById('postCategory').value;
    if(typeof tinymce !== 'undefined' && tinymce.get('postContent')) tinymce.triggerSave();
    const content = document.getElementById('postContent').value;
    
    if (!title || !category_id || !content) return alert('Wypełnij pola!');
    
    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category_id, content })
      });
      if (res.ok) {
        const data = await res.json();
        alert('✅ Post utworzony!');
        if (data.id) window.location.href = `/post.html?id=${data.id}`;
      } else alert('Błąd');
    } catch (e) { alert('Błąd'); }
  });
}

window.approvePost = async (id) => {
  if(!confirm('Zatwierdzić?')) return;
  await fetch(`/api/forum/posts/${id}/approve`, { method: 'POST' });
  loadPendingPosts();
};
window.rejectPost = async (id) => {
  if(!confirm('Odrzucić?')) return;
  await fetch(`/api/forum/posts/${id}/reject`, { method: 'POST' });
  loadPendingPosts();
};
window.deletePost = async (id) => {
    if(!confirm('Usunąć?')) return;
    await fetch(`/api/forum/posts/${id}/reject`, { method: 'POST' });
    loadMyPosts();
}

init();