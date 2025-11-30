// public/admin-gallery-upload.js
import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let selectedFile = null;
let editingImageId = null;
let loadedImages = [];

const uploadZone = document.getElementById('uploadZone');
const fileInputContainer = document.getElementById('fileInputContainer');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitUploadBtn');
const cancelBtn = document.getElementById('cancelEditBtn');
const formHeader = document.getElementById('formHeader');
const messageEl = document.getElementById('message');
const imagesGrid = document.getElementById('imagesGrid');
const previewContainer = document.getElementById('previewContainer');

const titleInput = document.getElementById('imageTitle');
const descInput = document.getElementById('imageDescription');

async function initGalleryUpload() {
    await setupAuth();
    loadImages();
}

async function setupAuth() {
    try {
        currentUser = await getCurrentUser();

        if (!currentUser) {
            window.location.href = 'index.html';
            return;
        }

        const whoEl = document.getElementById('who');
        if (whoEl) whoEl.textContent = currentUser.display_name || currentUser.username;

        if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
            window.location.href = 'dashboard.html';
            return;
        }

        if (currentUser.role === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'block';

            const galleryManageLink = document.getElementById('galleryManageLink');
            if (galleryManageLink) galleryManageLink.style.display = 'block';
        }

        if (['admin', 'moderator'].includes(currentUser.role)) {
            const modLink = document.getElementById('moderatorLink');
            if (modLink) modLink.style.display = 'block';

            const ordersLink = document.getElementById('ordersLink');
            if (ordersLink) ordersLink.style.display = 'block';
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await handleLogout();
                window.location.href = '/';
            });
        }
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = 'index.html';
    }
}

// --- ŁADOWANIE LISTY ZDJĘĆ ---
async function loadImages() {
    if (!imagesGrid) return;

    try {

        const data = await fetchWithAuth('/api/gallery/images?t=' + Date.now());
        loadedImages = data;

        if (loadedImages.length === 0) {
            imagesGrid.innerHTML = '<div class="empty-state">Brak zdjęć w bazie.</div>';
            return;
        }

        imagesGrid.innerHTML = loadedImages.map(img => {
            const fullDesc = img.description || '';
            const truncatedDesc = fullDesc.length > 100
                ? fullDesc.substring(0, 100) + '...'
                : (fullDesc || '<em style="opacity:0.5">Brak opisu</em>');

            return `
            <div class="image-row-item">
                <img src="/gallery-img/${img.filename}" alt="${img.title}" class="image-row-thumb" loading="lazy" />
                
                <div class="image-row-content">
                    <h3 title="${img.title}">${img.title}</h3>
                    
                    <p title="${fullDesc.replace(/"/g, '&quot;')}">
                        ${truncatedDesc}
                    </p>
                    
                    <div class="image-row-meta">ID: ${img.id} | Plik: ${img.filename}</div>
                </div>
                
                <div class="image-row-actions">
                    <button onclick="window.startEdit(${img.id})" class="btn btn-primary btn-sm" style="font-size: 13px;">✏️ Edytuj</button>
                    <button onclick="window.deleteImage(${img.id})" class="btn btn-danger btn-sm" style="font-size: 13px;">🗑️ Usuń</button>
                </div>
            </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        imagesGrid.innerHTML = '<div class="error-state">Błąd ładowania zdjęć.</div>';
    }
}

// --- PODGLĄD ZDJĘCIA ---
function showPreview(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewContainer.innerHTML = `
            <p style="margin:0 0 5px 0; color:#FFD700; font-size:12px;">Podgląd pliku:</p>
            <img src="${e.target.result}">
        `;
        previewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function showServerPreview(filename) {
    previewContainer.innerHTML = `
        <p style="margin:0 0 5px 0; color:#FFD700; font-size:12px;">Edytujesz to zdjęcie:</p>
        <img src="/gallery-img/${filename}">
    `;
    previewContainer.style.display = 'block';
}

function clearPreview() {
    previewContainer.innerHTML = '';
    previewContainer.style.display = 'none';
}

// --- EDYCJA ---
window.startEdit = (id) => {
    const img = loadedImages.find(i => i.id === id);
    if (!img) return;

    editingImageId = id;
    titleInput.value = img.title;
    descInput.value = img.description || '';

    showServerPreview(img.filename);

    formHeader.textContent = `Edycja zdjęcia #${id}`;
    submitBtn.textContent = '💾 Zapisz zmiany';
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-success');
    submitBtn.disabled = false;

    fileInputContainer.style.display = 'none';
    cancelBtn.style.display = 'inline-block';

    if (messageEl) messageEl.textContent = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetForm() {
    editingImageId = null;
    selectedFile = null;
    titleInput.value = '';
    descInput.value = '';
    fileInput.value = '';

    formHeader.textContent = 'Nowe zdjęcie';
    submitBtn.textContent = 'Upload';
    submitBtn.classList.remove('btn-success');
    submitBtn.classList.add('btn-primary');
    submitBtn.disabled = true;

    fileInputContainer.style.display = 'flex';
    cancelBtn.style.display = 'none';

    if (uploadZone) {
        uploadZone.querySelector('p').textContent = "Przeciągnij plik lub kliknij.";
        uploadZone.classList.remove('dragover');
    }
    clearPreview();
}

if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); resetForm(); });

// --- SUBMIT ---
if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const description = descInput.value.trim();

        if (!title) return alert('Tytuł jest wymagany!');

        // EDYCJA (PUT)
        if (editingImageId) {
            submitBtn.textContent = 'Zapisywanie...';
            submitBtn.disabled = true;

            try {
                await fetchWithAuth(`/api/gallery/images/${editingImageId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ title, description })
                });

                messageEl.textContent = '✅ Zaktualizowano pomyślnie!';
                messageEl.className = 'success';
                resetForm();
                loadImages();
            } catch (e) {
                alert('Błąd aktualizacji: ' + e.message);
                submitBtn.disabled = false;
            }
            return;
        }

        // UPLOAD (POST)
        if (!selectedFile) return alert('Wybierz plik!');

        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('title', title);
        formData.append('description', description);

        submitBtn.textContent = 'Wysyłanie...';
        submitBtn.disabled = true;

        try {

            await fetchWithAuth('/api/gallery/upload', {
                method: 'POST',
                body: formData
            });

            messageEl.textContent = '✅ Zdjęcie dodane!';
            messageEl.className = 'success';
            resetForm();
            loadImages();
        } catch (e) {
            messageEl.textContent = `❌ ${e.message || 'Błąd połączenia'}`;
            messageEl.className = 'error';
            submitBtn.textContent = 'Upload';
            submitBtn.disabled = false;
        }
    });
}

// --- USUWANIE ---
window.deleteImage = async (id) => {
    if (!confirm('Usunąć to zdjęcie? Zostanie ono usunięte również ze sliderów.')) return;
    try {
        await fetchWithAuth(`/api/gallery/images/${id}`, {
            method: 'DELETE'
        });
        loadImages();
    } catch (e) {
        alert('Błąd usuwania: ' + e.message);
    }
};

// --- OBSŁUGA PLIKÓW ---
function handleFile(file) {
    selectedFile = file;
    if (uploadZone) uploadZone.querySelector('p').textContent = `Wybrano: ${file.name}`;
    submitBtn.disabled = false;
    showPreview(file);
}

if (fileInputContainer) {
    fileInputContainer.addEventListener('click', () => fileInput.click());
    fileInputContainer.addEventListener('dragover', (e) => { e.preventDefault(); fileInputContainer.classList.add('dragover'); });
    fileInputContainer.addEventListener('dragleave', () => fileInputContainer.classList.remove('dragover'));
    fileInputContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        fileInputContainer.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
}

initGalleryUpload();