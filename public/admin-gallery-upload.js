// public/admin-gallery-upload.js

let currentUser = null;
let selectedFile = null;

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitUploadBtn');
const messageEl = document.getElementById('message');
const imagesGrid = document.getElementById('imagesGrid');

async function initGalleryUpload() {
    await setupAuth();
    loadImages();
    // Dodano: ładowanie powiadomień
    if (currentUser) {
        await loadNotifications();
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

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        });
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

// --- OBSŁUGA PLIKU ---
function handleFile(file) {
    selectedFile = file;
    messageEl.textContent = `Wybrano plik: ${file.name}`;
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

if (submitBtn) {
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
}

initGalleryUpload();