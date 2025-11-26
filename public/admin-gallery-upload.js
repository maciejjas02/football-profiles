// public/admin-gallery-upload.js

let currentUser = null;
let selectedFile = null;
let editingImageId = null; // Przechowuje ID edytowanego zdjęcia (null = tryb dodawania)
let loadedImages = []; // Przechowuje listę pobranych zdjęć

const uploadZone = document.getElementById('uploadZone');
const fileInputContainer = document.getElementById('fileInputContainer');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitUploadBtn');
const cancelBtn = document.getElementById('cancelEditBtn');
const formHeader = document.getElementById('formHeader');
const messageEl = document.getElementById('message');
const imagesGrid = document.getElementById('imagesGrid');

// Pola tekstowe
const titleInput = document.getElementById('imageTitle');
const descInput = document.getElementById('imageDescription');

async function initGalleryUpload() {
    await setupAuth();
    loadImages();
    if (currentUser) {
        // await loadNotifications(); // Odkomentuj jeśli masz ten moduł
    }
}

async function setupAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not auth');
        const data = await res.json();
        currentUser = data.user;

        document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

        if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
            window.location.href = 'dashboard.html';
            return;
        }
        // Logika menu (skrócona dla czytelności - wklej swoją jeśli masz rozbudowaną)
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
        loadedImages = await res.json(); // Zapisz do zmiennej globalnej

        if (loadedImages.length === 0) {
            imagesGrid.innerHTML = '<div class="empty-state">Brak zdjęć w bazie.</div>';
            return;
        }

        imagesGrid.innerHTML = loadedImages.map(img => `
            <div class="image-card">
                <img src="/gallery-img/${img.filename}" alt="${img.title}" loading="lazy" />
                <div class="image-info">
                    <h3>${img.title}</h3>
                    <p>${img.description || 'Brak opisu.'}</p>
                    <small>ID: ${img.id}</small>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button onclick="window.startEdit(${img.id})" class="btn btn-primary btn-sm" style="flex:1;">✏️ Edytuj</button>
                        <button onclick="window.deleteImage(${img.id})" class="btn btn-danger btn-sm" style="width:40px;">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) { imagesGrid.innerHTML = '<div class="error-state">Błąd ładowania zdjęć.</div>'; }
}

// --- TRYB EDYCJI ---

window.startEdit = (id) => {
    const img = loadedImages.find(i => i.id === id);
    if (!img) return;

    // Ustaw tryb edycji
    editingImageId = id;

    // Wypełnij formularz
    titleInput.value = img.title;
    descInput.value = img.description || '';

    // Zmień UI
    formHeader.textContent = `Edytuj zdjęcie (ID: ${id})`;
    submitBtn.textContent = '💾 Zapisz zmiany';
    submitBtn.disabled = false; // Zawsze aktywne przy edycji (bo dane są wypełnione)
    fileInputContainer.style.display = 'none'; // Ukryj upload pliku
    cancelBtn.style.display = 'block'; // Pokaż guzik anuluj

    // Przewiń do góry
    window.scrollTo({ top: 0, behavior: 'smooth' });
    messageEl.textContent = '';
};

function resetForm() {
    editingImageId = null;
    selectedFile = null;

    titleInput.value = '';
    descInput.value = '';
    fileInput.value = '';

    formHeader.textContent = 'Nowe zdjęcie';
    submitBtn.textContent = 'Upload';
    submitBtn.disabled = true; // Wyłącz, bo brak pliku

    fileInputContainer.style.display = 'flex'; // Pokaż upload
    cancelBtn.style.display = 'none'; // Ukryj guzik anuluj

    // Reset stylu drag&drop
    if (uploadZone) uploadZone.querySelector('p').textContent = "Przeciągnij plik tutaj lub kliknij, aby wybrać.";
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetForm();
    });
}

// --- OBSŁUGA DODAWANIA / EDYCJI ---

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const description = descInput.value.trim();

        if (!title) return alert('Tytuł jest wymagany!');

        // SCENARIUSZ 1: EDYCJA ISTNIEJĄCEGO
        if (editingImageId) {
            submitBtn.textContent = 'Zapisywanie...';
            submitBtn.disabled = true;

            try {
                const res = await fetch(`/api/gallery/images/${editingImageId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description })
                });

                if (res.ok) {
                    messageEl.textContent = '✅ Dane zaktualizowane!';
                    resetForm();
                    loadImages();
                } else {
                    const err = await res.json();
                    alert('Błąd: ' + (err.error || 'Nieznany'));
                    submitBtn.disabled = false;
                    submitBtn.textContent = '💾 Zapisz zmiany';
                }
            } catch (e) {
                alert('Błąd połączenia');
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 Zapisz zmiany';
            }
            return;
        }

        // SCENARIUSZ 2: NOWY UPLOAD
        if (!selectedFile) return alert('Wybierz plik!');

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
                messageEl.textContent = '✅ Zdjęcie przesłane!';
                resetForm(); // To wyczyści formularz i stan
                loadImages();
            } else {
                const error = await res.json();
                messageEl.textContent = `❌ Błąd: ${error.error || 'Nieznany'}`;
                submitBtn.textContent = 'Upload';
                submitBtn.disabled = false;
            }
        } catch (e) {
            messageEl.textContent = '❌ Błąd połączenia z serwerem.';
            submitBtn.textContent = 'Upload';
            submitBtn.disabled = false;
        }
    });
}

// --- USUWANIE ---
window.deleteImage = async (id) => {
    if (!confirm('Usunąć to zdjęcie z bazy? Zostanie usunięte z wszystkich kolekcji!')) return;
    try {
        const res = await fetch(`/api/gallery/images/${id}`, { method: 'DELETE' });
        if (res.ok) {
            messageEl.textContent = '✅ Zdjęcie usunięte!';
            loadImages();
        } else {
            messageEl.textContent = '❌ Błąd usuwania.';
        }
    } catch (e) { messageEl.textContent = '❌ Błąd połączenia.'; }
};

// --- OBSŁUGA PLIKU (DRAG & DROP) ---
function handleFile(file) {
    selectedFile = file;
    const p = uploadZone.querySelector('p');
    if (p) p.textContent = `Wybrano: ${file.name}`;
    submitBtn.disabled = false;
}

if (uploadZone) {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
}

initGalleryUpload();