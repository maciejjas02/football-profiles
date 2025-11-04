import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let selectedFile = null;

// Check auth
const user = await getCurrentUser();
if (!user || user.role !== 'admin') {
  alert('Dostęp tylko dla administratorów!');
  window.location.href = '/dashboard.html';
  throw new Error('Admin only');
}

document.getElementById('userDisplay').textContent = user.name || user.username;

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await handleLogout();
  window.location.href = '/';
});

// Show moderator link if applicable
if (user.role === 'moderator' || user.role === 'admin') {
  const modLink = document.getElementById('moderatorLink');
  if (modLink) modLink.style.display = 'block';
}

// Upload zone - drag & drop
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const uploadForm = document.getElementById('uploadForm');
const preview = document.getElementById('preview');
const cancelBtn = document.getElementById('cancelBtn');

// Click to select
selectBtn.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('click', (e) => {
  if (e.target === uploadZone || e.target.closest('.upload-icon') || e.target.tagName === 'P') {
    fileInput.click();
  }
});

// File selected
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFileSelect(file);
});

// Drag & drop
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleFileSelect(file);
  }
});

function handleFileSelect(file) {
  selectedFile = file;
  
  // Preview
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    uploadZone.style.display = 'none';
    uploadForm.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// Cancel
cancelBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  uploadForm.style.display = 'none';
  uploadZone.style.display = 'flex';
  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
  document.getElementById('uploadError').textContent = '';
  document.getElementById('uploadSuccess').textContent = '';
});

// Submit upload
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!selectedFile) return;

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const errorEl = document.getElementById('uploadError');
  const successEl = document.getElementById('uploadSuccess');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!title) {
    errorEl.textContent = 'Tytuł jest wymagany';
    return;
  }

  try {
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('title', title);
    formData.append('description', description);

    const response = await fetch('/api/gallery/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      successEl.textContent = '✅ Zdjęcie zostało dodane!';
      setTimeout(() => {
        cancelBtn.click();
        loadImages();
      }, 1500);
    } else {
      errorEl.textContent = data.error || 'Upload nie powiódł się';
    }
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'Błąd serwera podczas uploadu';
  }
});

// Load images from DB
async function loadImages() {
  const container = document.getElementById('imagesList');
  container.innerHTML = '<div class="loading">Ładowanie...</div>';

  try {
    const images = await fetchWithAuth('/api/gallery/images');
    
    if (images.length === 0) {
      container.innerHTML = '<p class="hint">Brak zdjęć w bazie. Dodaj pierwsze!</p>';
      return;
    }

    container.innerHTML = images.map(img => `
      <div class="image-card" data-id="${img.id}">
        <img src="/uploads/gallery/thumbnails/${img.filename}" alt="${img.title}" loading="lazy" />
        <div class="image-info">
          <h3>${img.title}</h3>
          <p>${img.description || '<em>Brak opisu</em>'}</p>
          <small>${img.width} × ${img.height}px</small>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${img.id}">Usuń</button>
        </div>
      </div>
    `).join('');

    // Delete handlers
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('Czy na pewno usunąć to zdjęcie?')) return;

        try {
          await fetchWithAuth(`/api/gallery/images/${id}`, { method: 'DELETE' });
          loadImages();
        } catch (error) {
          alert('Błąd podczas usuwania');
        }
      });
    });

  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="error">Błąd podczas ładowania zdjęć</p>';
  }
}

// Initial load
loadImages();
