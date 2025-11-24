// public/admin-gallery-manage.js

let currentCollectionId = null;
let currentItems = []; // Przechowuje aktualną kolejność dla Drag & Drop

async function init() {
    await setupAuth();
    await loadCollections();
    await loadAvailableImages();
    setupEventListeners();
}

async function setupAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not auth');
        const data = await res.json();
        
        if (data.user.role !== 'admin' && data.user.role !== 'moderator') {
            window.location.href = 'dashboard.html';
            return;
        }
        document.getElementById('who').textContent = data.user.display_name || data.user.username;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        });
    } catch (error) { window.location.href = 'index.html'; }
}

// Ładowanie listy kolekcji
async function loadCollections() {
    const list = document.getElementById('collectionsList');
    list.innerHTML = '<div class="loading">Ładowanie kolekcji...</div>';
    
    try {
        const res = await fetch('/api/gallery/collections?t=' + Date.now());
        const collections = await res.json();
        
        if (collections.length === 0) {
            list.innerHTML = '<div class="empty-state">Brak kolekcji.</div>';
            return;
        }

        list.innerHTML = collections.map(c => `
            <div class="collection-card ${c.is_active ? 'active' : ''}" data-id="${c.id}">
                <h3 style="margin-bottom: 5px;">${c.name} ${c.is_active ? '✨ (Aktywna)' : ''}</h3>
                <p>${c.description || '-'}</p>
                <div class="collection-actions">
                    <button onclick="selectCollection(${c.id}, '${c.name}')" class="btn btn-secondary btn-sm" style="flex:1;">⚙️ Zarządzaj</button>
                    ${c.is_active ? '' : `<button onclick="activateCollection(${c.id})" class="btn btn-success btn-sm" style="flex:1;">✅ Aktywuj</button>`}
                    <button onclick="deleteCollection(${c.id})" class="btn btn-danger btn-sm" style="width:50px;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = '<div class="error-state">Błąd ładowania kolekcji.</div>'; }
}

// Ładowanie dostępnych obrazów do selektora
async function loadAvailableImages() {
    const select = document.getElementById('availableImagesSelect');
    select.innerHTML = '<option value="">Ładowanie obrazów...</option>';
    
    try {
        const res = await fetch('/api/gallery/images?t=' + Date.now());
        const images = await res.json();
        
        select.innerHTML = '<option value="">Wybierz obrazek do dodania...</option>' +
            images.map(img => `<option value="${img.id}">${img.title} (ID: ${img.id})</option>`).join('');
    } catch (e) { select.innerHTML = '<option value="">Błąd ładowania obrazów</option>'; }
}

// Wybieranie kolekcji do edycji
window.selectCollection = (id, name) => {
    currentCollectionId = id;
    document.getElementById('itemsHeader').textContent = `Elementy: ${name}`;
    loadCollectionItems(id);
};

// Ładowanie elementów wybranej kolekcji (z możliwością Drag & Drop)
async function loadCollectionItems(id) {
    const list = document.getElementById('collectionItems');
    list.innerHTML = '<div class="loading">Ładowanie elementów...</div>';
    
    try {
        const res = await fetch(`/api/gallery/collections/${id}/items?t=` + Date.now());
        currentItems = await res.json();

        if (currentItems.length === 0) {
            list.innerHTML = '<div class="empty-state">Brak elementów w tej kolekcji.</div>';
            return;
        }

        list.innerHTML = currentItems.map(item => `
            <div class="slider-item" data-id="${item.id}" data-image-id="${item.image_id}" draggable="true">
                <img src="/uploads/gallery/thumbnails/${item.filename}" alt="${item.title}" />
                <h4>${item.title}</h4>
                <div class="position">Pozycja: ${item.position}</div>
                <button onclick="removeImageFromCollection(${item.id})" class="btn btn-danger btn-sm btn-remove">Usuń</button>
            </div>
        `).join('');
        
        setupDragAndDrop(); // Aktywacja D&D
    } catch (e) { list.innerHTML = '<div class="error-state">Błąd ładowania elementów kolekcji.</div>'; }
}

// --- FUNKCJE D&D (BONUS) ---
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


// --- OBSŁUGA PRZYCISKÓW ---

window.deleteCollection = async (id) => {
    if(!confirm('Usunąć kolekcję? Spowoduje to usunięcie wszystkich jej elementów, ale zdjęcia pozostaną w bazie.')) return;
    try {
        await fetch(`/api/gallery/collections/${id}`, { method: 'DELETE' });
        loadCollections();
        if (currentCollectionId === id) {
            currentCollectionId = null;
            document.getElementById('collectionItems').innerHTML = '<div class="empty-state">Wybierz kolekcję.</div>';
        }
    } catch(e) { alert('Błąd usuwania kolekcji.'); }
};

window.activateCollection = async (id) => {
    try {
        await fetch(`/api/gallery/collections/${id}/activate`, { method: 'PUT' });
        loadCollections();
        alert('✅ Kolekcja aktywowana pomyślnie!');
    } catch(e) { alert('Błąd aktywacji.'); }
};

window.removeImageFromCollection = async (itemId) => {
    if(!confirm('Usunąć element z tej kolekcji? (Zdjęcie pozostanie w bazie)')) return;
    try {
        await fetch(`/api/gallery/items/${itemId}`, { method: 'DELETE' });
        loadCollectionItems(currentCollectionId);
    } catch(e) { alert('Błąd usuwania elementu.'); }
};


function setupEventListeners() {
    // Tworzenie kolekcji
    document.getElementById('createCollectionBtn').addEventListener('click', async () => {
        const name = document.getElementById('collectionName').value.trim();
        const description = document.getElementById('collectionDescription').value.trim();
        if (!name) return alert('Nazwa jest wymagana.');
        
        try {
            await fetch('/api/gallery/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });
            alert('✅ Kolekcja utworzona!');
            document.getElementById('collectionName').value = '';
            document.getElementById('collectionDescription').value = '';
            loadCollections();
        } catch(e) { alert('Błąd tworzenia kolekcji.'); }
    });
    
    // Dodawanie obrazka do wybranej kolekcji
    document.getElementById('addImageToCollectionBtn').addEventListener('click', async () => {
        if (!currentCollectionId) return alert('Najpierw wybierz kolekcję do zarządzania (przycisk "Zarządzaj").');
        
        const imageId = document.getElementById('availableImagesSelect').value;
        if (!imageId) return alert('Wybierz obrazek z listy.');
        
        try {
            await fetch(`/api/gallery/collections/${currentCollectionId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_id: parseInt(imageId) })
            });
            alert('✅ Obrazek dodany!');
            loadCollectionItems(currentCollectionId);
        } catch(e) { alert('Błąd dodawania obrazka.'); }
    });

    // Zapis kolejności po Drag & Drop
    document.getElementById('saveOrderBtn').addEventListener('click', async () => {
        if (!currentCollectionId) return;

        const updatedOrder = Array.from(document.getElementById('collectionItems').children).map((item, index) => ({
            itemId: parseInt(item.dataset.id),
            position: index
        }));

        try {
            await fetch(`/api/gallery/collections/${currentCollectionId}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: updatedOrder })
            });
            alert('✅ Kolejność zapisana!');
            loadCollectionItems(currentCollectionId);
        } catch(e) { alert('Błąd zapisywania kolejności.'); }
    });
}

init();