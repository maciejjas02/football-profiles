import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let selectedCollectionId = null;
let draggedElement = null;
let allImages = [];
let collectionItems = [];

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

// Create collection
document.getElementById('createCollectionForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('collectionName').value.trim();
  const description = document.getElementById('collectionDesc').value.trim();
  const errorEl = document.getElementById('createError');
  const successEl = document.getElementById('createSuccess');

  errorEl.textContent = '';
  successEl.textContent = '';

  try {
    const result = await fetchWithAuth('/api/gallery/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });

    if (result.success) {
      successEl.textContent = '✅ Kolekcja utworzona!';
      document.getElementById('collectionName').value = '';
      document.getElementById('collectionDesc').value = '';
      loadCollections();
    }
  } catch (error) {
    errorEl.textContent = error.message || 'Błąd podczas tworzenia kolekcji';
  }
});

// Load collections
async function loadCollections() {
  const container = document.getElementById('collectionsList');
  container.innerHTML = '<div class="loading">Ładowanie...</div>';

  try {
    const collections = await fetchWithAuth('/api/gallery/collections');

    if (collections.length === 0) {
      container.innerHTML = '<p class="hint">Brak kolekcji. Utwórz pierwszą!</p>';
      return;
    }

    container.innerHTML = collections.map(coll => `
      <div class="collection-card ${coll.is_active ? 'active' : ''}" data-id="${coll.id}">
        <h3>${coll.name} ${coll.is_active ? '✅' : ''}</h3>
        <p>${coll.description || '<em>Brak opisu</em>'}</p>
        <div class="collection-actions">
          <button class="btn btn-primary btn-sm manage-btn" data-id="${coll.id}" data-name="${coll.name}">Edytuj</button>
          <button class="btn btn-secondary btn-sm activate-btn" data-id="${coll.id}" ${coll.is_active ? 'disabled' : ''}>
            ${coll.is_active ? 'Aktywna' : 'Aktywuj'}
          </button>
          <button class="btn btn-danger btn-sm delete-coll-btn" data-id="${coll.id}">Usuń</button>
        </div>
      </div>
    `).join('');

    // Attach handlers
    container.querySelectorAll('.manage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedCollectionId = e.target.dataset.id;
        document.getElementById('selectedCollectionName').textContent = e.target.dataset.name;
        document.getElementById('manageSection').style.display = 'block';
        loadAvailableImages();
        loadCollectionItems();
      });
    });

    container.querySelectorAll('.activate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        try {
          await fetchWithAuth(`/api/gallery/collections/${id}/activate`, { method: 'PUT' });
          loadCollections();
        } catch (error) {
          alert('Błąd aktywacji');
        }
      });
    });

    container.querySelectorAll('.delete-coll-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('Czy na pewno usunąć tę kolekcję?')) return;

        try {
          await fetchWithAuth(`/api/gallery/collections/${id}`, { method: 'DELETE' });
          loadCollections();
          if (selectedCollectionId === id) {
            document.getElementById('manageSection').style.display = 'none';
            selectedCollectionId = null;
          }
        } catch (error) {
          alert('Błąd usuwania');
        }
      });
    });

  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="error">Błąd ładowania kolekcji</p>';
  }
}

// Load available images (all from DB)
async function loadAvailableImages() {
  try {
    allImages = await fetchWithAuth('/api/gallery/images');
    const select = document.getElementById('availableImages');
    
    if (allImages.length === 0) {
      select.innerHTML = '<option>Brak zdjęć. Dodaj zdjęcia najpierw!</option>';
      document.getElementById('addImageBtn').disabled = true;
      return;
    }

    select.innerHTML = allImages.map(img => 
      `<option value="${img.id}">${img.title} (${img.width}×${img.height})</option>`
    ).join('');
    
    document.getElementById('addImageBtn').disabled = false;
  } catch (error) {
    console.error(error);
  }
}

// Add image to collection
document.getElementById('addImageBtn').addEventListener('click', async () => {
  if (!selectedCollectionId) return;

  const select = document.getElementById('availableImages');
  const imageId = select.value;

  if (!imageId) return;

  try {
    await fetchWithAuth(`/api/gallery/collections/${selectedCollectionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_id: parseInt(imageId) })
    });

    loadCollectionItems();
  } catch (error) {
    alert('Błąd dodawania zdjęcia do slidera');
  }
});

// Load collection items (slider images)
async function loadCollectionItems() {
  if (!selectedCollectionId) return;

  const container = document.getElementById('sliderItems');
  container.innerHTML = '<div class="loading">Ładowanie...</div>';

  try {
    collectionItems = await fetchWithAuth(`/api/gallery/collections/${selectedCollectionId}/items`);

    if (collectionItems.length === 0) {
      container.innerHTML = '<p class="hint">Brak zdjęć w tej kolekcji. Dodaj pierwsze!</p>';
      document.getElementById('saveOrderBtn').style.display = 'none';
      return;
    }

    container.innerHTML = collectionItems.map((item, index) => `
      <div class="slider-item" draggable="true" data-id="${item.id}" data-position="${item.position}">
        <img src="/uploads/gallery/thumbnails/${item.filename}" alt="${item.title}" />
        <h4>${item.title}</h4>
        <div class="position">Pozycja: ${index + 1}</div>
        <button class="btn btn-danger btn-sm btn-remove" data-id="${item.id}">Usuń</button>
      </div>
    `).join('');

    // Drag & Drop handlers (+0.5 BONUS)
    setupDragAndDrop();

    // Remove handlers
    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        try {
          await fetchWithAuth(`/api/gallery/items/${id}`, { method: 'DELETE' });
          loadCollectionItems();
        } catch (error) {
          alert('Błąd usuwania');
        }
      });
    });

    document.getElementById('saveOrderBtn').style.display = 'none';

  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="error">Błąd ładowania zdjęć slidera</p>';
  }
}

// Drag & Drop Setup (+0.5 BONUS)
function setupDragAndDrop() {
  const items = document.querySelectorAll('.slider-item');

  items.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  draggedElement = e.currentTarget;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const afterElement = getDragAfterElement(e.currentTarget.parentElement, e.clientY);
  if (afterElement == null) {
    e.currentTarget.parentElement.appendChild(draggedElement);
  } else {
    e.currentTarget.parentElement.insertBefore(draggedElement, afterElement);
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('saveOrderBtn').style.display = 'block';
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  
  // Update visual positions
  const allItems = document.querySelectorAll('.slider-item');
  allItems.forEach((item, index) => {
    item.querySelector('.position').textContent = `Pozycja: ${index + 1}`;
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.slider-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save new order
document.getElementById('saveOrderBtn').addEventListener('click', async () => {
  if (!selectedCollectionId) return;

  const items = document.querySelectorAll('.slider-item');
  const newOrder = Array.from(items).map((item, index) => ({
    id: parseInt(item.dataset.id),
    position: index
  }));

  try {
    await fetchWithAuth(`/api/gallery/collections/${selectedCollectionId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: newOrder })
    });

    alert('✅ Kolejność zapisana!');
    document.getElementById('saveOrderBtn').style.display = 'none';
    loadCollectionItems();
  } catch (error) {
    alert('Błąd zapisu kolejności');
  }
});

// Initial load
loadCollections();
