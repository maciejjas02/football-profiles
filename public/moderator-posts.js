// public/moderator-posts.js

let currentUser = null;
let editingPostId = null; // Zmienna przechowująca ID edytowanego posta

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
      if (currentUser.role === 'admin') {
          const adminLink = document.getElementById('adminLink');
          if(adminLink) adminLink.style.display = 'block';
      }
      
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
    const countEl = document.getElementById('pendingCount');
    if(countEl) countEl.textContent = posts.length;
    
    const list = document.getElementById('pendingPostsList');
    if (posts.length === 0) { list.innerHTML = '<div class="empty-state">Brak postów do zatwierdzenia</div>'; return; }
    
    list.innerHTML = posts.map(p => `
      <div class="pending-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px; border: 1px solid var(--border-color);">
        <h3 style="margin-top:0; font-size:16px; color:#FFD700;">${p.title}</h3>
        <div style="margin:5px 0; font-size:12px; color:#888;">Autor: ${p.author_username}</div>
        
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
  } catch (error) {}
}

async function loadMyPosts() {
    try {
      const res = await fetch('/api/forum/posts?limit=50&t=' + Date.now());
      const allPosts = await res.json();
      // Pokaż wszystkie zatwierdzone posty (żeby moderator mógł edytować każdy, nie tylko swój)
      // Jeśli chcesz tylko swoje: const myPosts = allPosts.filter(p => p.author_username === currentUser.username);
      const myPosts = allPosts; 

      const list = document.getElementById('myPostsList');
      
      if (myPosts.length === 0) {
        list.innerHTML = '<div class="empty-state">Brak</div>';
        return;
      }
      list.innerHTML = myPosts.map(p => `
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
    } catch (error) {}
}

// Funkcja uruchamiająca tryb edycji
window.startEdit = async (id) => {
    try {
        // Pobierz dane posta
        const res = await fetch(`/api/forum/posts/${id}`);
        if(!res.ok) return alert("Nie można pobrać danych posta.");
        const post = await res.json();

        // Wypełnij formularz
        document.getElementById('postTitle').value = post.title;
        document.getElementById('postCategory').value = post.category_id;
        
        // Wstaw treść do edytora TinyMCE
        if(tinymce.get('postContent')) {
            tinymce.get('postContent').setContent(post.content);
        } else {
            document.getElementById('postContent').value = post.content;
        }

        // Zmień stan na edycję
        editingPostId = id;
        const submitBtn = document.getElementById('submitPostBtn');
        submitBtn.textContent = "💾 Zapisz zmiany";
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-success'); // Zmień kolor na zielony dla odróżnienia
        
        // Przewiń do góry
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch(e) {
        console.error(e);
        alert("Błąd podczas ładowania posta do edycji.");
    }
};

function resetForm() {
    document.getElementById('postTitle').value = '';
    document.getElementById('postCategory').value = '';
    if(tinymce.get('postContent')) tinymce.get('postContent').setContent('');
    document.getElementById('postContent').value = '';
    document.getElementById('postImageInput').value = '';
    
    // Reset trybu edycji
    editingPostId = null;
    const submitBtn = document.getElementById('submitPostBtn');
    submitBtn.textContent = "Utwórz post";
    submitBtn.classList.add('btn-primary');
    submitBtn.classList.remove('btn-success');
}

function setupEventListeners() {
  // Upload obrazka
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

  // Przycisk wyczyść
  document.getElementById('resetPostBtn').addEventListener('click', (e) => {
      e.preventDefault();
      resetForm();
  });

  // Submit (Tworzenie lub Edycja)
  document.getElementById('submitPostBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('postTitle').value.trim();
    const category_id = document.getElementById('postCategory').value;
    
    if(typeof tinymce !== 'undefined' && tinymce.get('postContent')) tinymce.triggerSave();
    const content = document.getElementById('postContent').value;
    
    if (!title || !category_id || !content) return alert('Wypełnij wszystkie pola!');
    
    // Decyzja: CREATE czy UPDATE?
    const isEdit = editingPostId !== null;
    const url = isEdit ? `/api/forum/posts/${editingPostId}` : '/api/forum/posts';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category_id, content })
      });
      
      if (res.ok) {
        alert(isEdit ? '✅ Post zaktualizowany!' : '✅ Post utworzony!');
        resetForm();
        loadMyPosts();     // Odśwież listę opublikowanych
        loadPendingPosts(); // Odśwież listę oczekujących (jeśli edytowałeś oczekujący)
      } else {
          const err = await res.json();
          alert('Błąd: ' + (err.error || 'Nieznany'));
      }
    } catch (e) { alert('Błąd połączenia'); }
  });
}

// Akcje moderatora
window.approvePost = async (id) => {
  if(!confirm('Zatwierdzić ten post?')) return;
  await fetch(`/api/forum/posts/${id}/approve`, { method: 'POST' });
  loadPendingPosts();
  loadMyPosts();
};

window.rejectPost = async (id) => {
  if(!confirm('Odrzucić ten post?')) return;
  await fetch(`/api/forum/posts/${id}/reject`, { method: 'POST' });
  loadPendingPosts();
};

window.deletePost = async (id) => {
    if(!confirm('Czy na pewno chcesz usunąć ten post bezpowrotnie?')) return;
    await fetch(`/api/forum/posts/${id}`, { method: 'DELETE' }); // DELETE endpoint w server.js
    loadMyPosts();
}

init();