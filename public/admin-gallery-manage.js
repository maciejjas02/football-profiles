// public/admin-gallery-manage.js
import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentCollectionId = null;
let currentItems = [];
let currentUser = null;

async function init() {
    await setupAuth();
    await loadCollections();
    await loadAvailableImages();
    setupEventListeners();

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

        if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
            window.location.href = 'dashboard.html';
            return;
        }

        if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
            const ordersLink = document.getElementById('ordersLink');
            const modLink = document.getElementById('moderatorLink');
            if (ordersLink) ordersLink.style.display = 'block';
            if (modLink) modLink.style.display = 'block';
        }

        if (currentUser.role === 'admin') {
            const adminLink = document.getElementById('adminLink');
            const galleryManageLink = document.getElementById('galleryManageLink');
            if (adminLink) adminLink.style.display = 'block';
            if (galleryManageLink) galleryManageLink.style.display = 'block';
        }

        document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await handleLogout();
            window.location.href = '/';
        });
    } catch (error) {
        console.error(error);
        window.location.href = 'index.html';
    }
}

// --- LOGIKA POWIADOMIEŃ ---
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

async function loadCollections() {
    const list = document.getElementById('collectionsList');
    list.innerHTML = '<div class="loading">Ładowanie kolekcji...</div>';

    try {
        const collections = await fetchWithAuth('/api/gallery/collections?t=' + Date.now());

        if (collections.length === 0) {
            list.innerHTML = '<div class="empty-state">Brak kolekcji.</div>';
            return;
        }

        list.innerHTML = collections.map(c => `
            <div class="collection-card ${c.is_active ? 'active' : ''}" data-id="${c.id}">
                <h3 style="margin-bottom: 5px;">${c.name} ${c.is_active ? '✨ (Aktywna)' : ''}</h3>
                <p>${c.description || '-'}</p>
                <div class="collection-actions">
                    <button onclick="window.selectCollection(${c.id}, '${c.name}')" class="btn btn-secondary btn-sm" style="flex:1;">⚙️ Zarządzaj</button>
                    ${c.is_active ? '' : `<button onclick="window.activateCollection(${c.id})" class="btn btn-success btn-sm" style="flex:1;">✅ Aktywuj</button>`}
                    <button onclick="window.deleteCollection(${c.id})" class="btn btn-danger btn-sm" style="width:50px;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = '<div class="error-state">Błąd ładowania kolekcji.</div>'; }
}

async function loadAvailableImages() {
    const select = document.getElementById('availableImagesSelect');
    select.innerHTML = '<option value="">Ładowanie obrazów...</option>';

    try {
        const images = await fetchWithAuth('/api/gallery/images?t=' + Date.now());

        select.innerHTML = '<option value="">Wybierz obrazek do dodania...</option>' +
            images.map(img => `<option value="${img.id}">${img.title} (ID: ${img.id})</option>`).join('');
    } catch (e) { select.innerHTML = '<option value="">Błąd ładowania obrazów</option>'; }
}

window.selectCollection = (id, name) => {
    currentCollectionId = id;
    document.getElementById('itemsHeader').textContent = `Elementy: ${name}`;
    loadCollectionItems(id);
};

async function loadCollectionItems(id) {
    const list = document.getElementById('collectionItems');
    list.innerHTML = '<div class="loading">Ładowanie elementów...</div>';

    try {
        const currentItemsData = await fetchWithAuth(`/api/gallery/collections/${id}/items?t=` + Date.now());
        currentItems = currentItemsData;

        if (currentItems.length === 0) {
            list.innerHTML = '<div class="empty-state">Brak elementów w tej kolekcji.</div>';
            return;
        }

        list.innerHTML = currentItems.map(item => `
            <div class="slider-item" data-id="${item.id}" data-image-id="${item.image_id}" draggable="true">
                <img src="/gallery-img/${item.filename}" alt="${item.title}" />
                <h4>${item.title}</h4>
                <div class="position">Pozycja: ${item.position}</div>
                <button onclick="window.removeImageFromCollection(${item.id})" class="btn btn-danger btn-sm btn-remove">Usuń</button>
            </div>
        `).join('');

        setupDragAndDrop();
    } catch (e) { list.innerHTML = '<div class="error-state">Błąd ładowania elementów kolekcji.</div>'; }
}

function setupDragAndDrop() {
    const list = document.getElementById('collectionItems');
    if (!list) return;

    list.querySelectorAll('.slider-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.id);
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', () => item.classList.remove('dragging'));

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = document.querySelector('.dragging');
            if (draggingItem && draggingItem !== item) {
                const rect = item.getBoundingClientRect();
                const next = (e.clientY - rect.top) / (rect.bottom - rect.top) < 0.5 ? item : item.nextElementSibling;
                list.insertBefore(draggingItem, next);
            }
        });
    });
}

window.deleteCollection = async (id) => {
    if (!confirm('Usunąć kolekcję? Spowoduje to usunięcie wszystkich jej elementów, ale zdjęcia pozostaną w bazie.')) return;
    try {
        await fetchWithAuth(`/api/gallery/collections/${id}`, { method: 'DELETE' });
        loadCollections();
        if (currentCollectionId === id) {
            currentCollectionId = null;
            document.getElementById('collectionItems').innerHTML = '<div class="empty-state">Wybierz kolekcję.</div>';
        }
    } catch (e) { alert('Błąd usuwania kolekcji.'); }
};

window.activateCollection = async (id) => {
    try {
        await fetchWithAuth(`/api/gallery/collections/${id}/activate`, { method: 'PUT' });
        loadCollections();
        alert('✅ Kolekcja aktywowana pomyślnie!');
    } catch (e) { alert('Błąd aktywacji.'); }
};

window.removeImageFromCollection = async (itemId) => {
    if (!confirm('Usunąć element z tej kolekcji? (Zdjęcie pozostanie w bazie)')) return;
    try {
        await fetchWithAuth(`/api/gallery/items/${itemId}`, { method: 'DELETE' });
        loadCollectionItems(currentCollectionId);
    } catch (e) { alert('Błąd usuwania elementu.'); }
};

function setupEventListeners() {
    document.getElementById('createCollectionBtn').addEventListener('click', async () => {
        const name = document.getElementById('collectionName').value.trim();
        const description = document.getElementById('collectionDescription').value.trim();
        if (!name) return alert('Nazwa jest wymagana.');

        try {
            await fetchWithAuth('/api/gallery/collections', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });
            alert('✅ Kolekcja utworzona!');
            document.getElementById('collectionName').value = '';
            document.getElementById('collectionDescription').value = '';
            loadCollections();
        } catch (e) { alert('Błąd tworzenia kolekcji.'); }
    });

    document.getElementById('addImageToCollectionBtn').addEventListener('click', async () => {
        if (!currentCollectionId) return alert('Najpierw wybierz kolekcję do zarządzania (przycisk "Zarządzaj").');

        const imageId = document.getElementById('availableImagesSelect').value;
        if (!imageId) return alert('Wybierz obrazek z listy.');

        try {
            await fetchWithAuth(`/api/gallery/collections/${currentCollectionId}/items`, {
                method: 'POST',
                body: JSON.stringify({ image_id: parseInt(imageId) })
            });
            alert('✅ Obrazek dodany!');
            loadCollectionItems(currentCollectionId);
        } catch (e) { alert('Błąd dodawania obrazka.'); }
    });

    document.getElementById('saveOrderBtn').addEventListener('click', async () => {
        if (!currentCollectionId) return;

        const updatedOrder = Array.from(document.getElementById('collectionItems').children).map((item, index) => ({
            itemId: parseInt(item.dataset.id),
            position: index
        }));

        try {
            await fetchWithAuth(`/api/gallery/collections/${currentCollectionId}/reorder`, {
                method: 'PUT',
                body: JSON.stringify({ items: updatedOrder })
            });
            alert('✅ Kolejność zapisana!');
            loadCollectionItems(currentCollectionId);
        } catch (e) { alert('Błąd zapisywania kolejności.'); }
    });
}

init();