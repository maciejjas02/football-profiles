// public/admin-gallery-upload.js

let currentUser = null;
let selectedFile = null;

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitUploadBtn');
const messageEl = document.getElementById('message');
const imagesGrid = document.getElementById('imagesGrid');

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Not auth');
    const data = await res.json();
    currentUser = data.user;
    
    document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
    
    // Sprawdzenie, czy użytkownik ma uprawnienia (po zmianie w server.js, to wystarczy)
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
      window.location.href = 'dashboard.html';
      return;
    }
    
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    });
  } catch (error) { window.location.href = 'index.html'; }
}

async function loadImages() {
    if (!imagesGrid) return;
    imagesGrid.innerHTML = '<div class="loading">Ładowanie...</div>';
    
    try {
        const res = await fetch('/api/gallery/images?t=' + Date.now());
        const images = await res.json();
        
        if (images.length === 0) {
            imagesGrid.innerHTML = '<div class="empty-state">Brak zdjęć w bazie.</div>';
            return;
        }

        imagesGrid.innerHTML = images.map(img => `
            <div class="image-card">
                <img src="/uploads/gallery/thumbnails/${img.filename}" alt="${img.title}" />
                <div class="image-info">
                    <h3>${img.title}</h3>
                    <p>${img.description || 'Brak opisu.'}</p>
                    <small>ID: ${img.id}</small>
                    <button onclick="window.deleteImage(${img.id})" class="btn btn-danger btn-sm" style="margin-top: 10px;">🗑️ Usuń</button>
                </div>
            </div>
        `).join('');
    } catch (e) { imagesGrid.innerHTML = '<div class="error-state">Błąd ładowania zdjęć.</div>'; }
}

window.deleteImage = async (id) => {
    if(!confirm('Usunąć to zdjęcie z bazy? Zostanie usunięte z wszystkich kolekcji!')) return;
    try {
        const res = await fetch(`/api/gallery/images/${id}`, { method: 'DELETE' });
        if(res.ok) {
            messageEl.textContent = '✅ Zdjęcie usunięte!';
            loadImages();
        } else {
            messageEl.textContent = '❌ Błąd usuwania.';
        }
    } catch(e) { messageEl.textContent = '❌ Błąd połączenia.'; }
};


// --- OBSŁUGA PLIKU ---
function handleFile(file) {
    selectedFile = file;
    messageEl.textContent = `Wybrano plik: ${file.name}`;
    submitBtn.disabled = false;
    // Opcjonalnie: Pokaż podgląd obrazka, jeśli chcesz
}

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});


submitBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    const title = document.getElementById('imageTitle').value.trim();
    const description = document.getElementById('imageDescription').value.trim();
    if (!title) return alert('Tytuł jest wymagany!');
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('title', title);
    formData.append('description', description);
    
    submitBtn.textContent = 'Wysyłanie...';
    submitBtn.disabled = true;
    messageEl.textContent = '';

    try {
        const res = await fetch('/api/gallery/upload', { method: 'POST', body: formData });
        
        if (res.ok) {
            messageEl.textContent = '✅ Zdjęcie przesłane i skalowane!';
            document.getElementById('imageTitle').value = '';
            document.getElementById('imageDescription').value = '';
            fileInput.value = '';
            selectedFile = null;
            loadImages();
        } else {
            const error = await res.json();
            messageEl.textContent = `❌ Błąd: ${error.error || 'Nieznany'}`;
        }
    } catch (e) {
        messageEl.textContent = '❌ Błąd połączenia z serwerem.';
    } finally {
        submitBtn.textContent = 'Upload';
        submitBtn.disabled = false;
    }
});

// INITIALIZATION
async function initGalleryUpload() {
    await setupAuth();
    loadImages();
}

initGalleryUpload();