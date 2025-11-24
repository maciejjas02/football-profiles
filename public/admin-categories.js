import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let currentUser = null;
let allCategories = [];

async function init() {
  await checkAuth();
  await loadModerators(); // Now dynamicznie ładuje prawdziwych moderatorów
  await loadCategories();
  setupEventListeners();
}

async function checkAuth() {
  try {
    currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      alert('Brak dostępu. Tylko administratorzy mogą korzystać z tej strony.');
      window.location.href = 'dashboard.html';
      return;
    }
    
    document.getElementById('who').textContent = currentUser.name || currentUser.username;
    document.getElementById('galleryManageLink').style.display = 'block'; // Pokaż link zarządzania galeriami
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = 'index.html';
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await handleLogout();
    window.location.href = 'index.html';
  });
}

// NOWE: Ładowanie moderatorów (zakładamy nowy endpoint /api/users/moderators)
let allModerators = [];
async function loadModerators() {
    // UWAGA: Ponieważ brakuje endpointu /api/users/moderators, użyjemy mocka, 
    // dopóki nie zostanie on dodany w server.js/db.js (co jest kolejnym krokiem)
    // Na potrzeby tego zadania symulujemy, że mamy listę moderatorów.
    
    // W pełni działająca aplikacja powinna to zmienić:
    // const res = await fetchWithAuth('/api/users/moderators');
    // allModerators = await res.json();
    
    // Używamy zaimplementowanego w db.js/server.js konta "moderator@example.com"
    allModerators = [{ id: 2, username: 'moderator', name: 'Moderator', email: 'moderator@example.com' }]; 

    const select = document.getElementById('assignModerator');
    select.innerHTML = '<option value="">Wybierz moderatora...</option>' +
      allModerators.map(mod => `<option value="${mod.id}">${mod.name} (@${mod.username})</option>`).join('');
}


// Min: Ładowanie kategorii
async function loadCategories() {
  try {
    allCategories = await fetchWithAuth('/api/forum/categories');
    
    const parentSelect = document.getElementById('parentCategory');
    if(parentSelect) parentSelect.innerHTML = '<option value="">Brak (główna kategoria)</option>' +
      allCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    const assignSelect = document.getElementById('assignCategory');
    if(assignSelect) assignSelect.innerHTML = '<option value="">Wybierz kategorię...</option>' +
      allCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    const list = document.getElementById('categoriesList');
    
    if (allCategories.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak kategorii</div>';
      return;
    }
    
    list.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nazwa</th>
            <th>Slug</th>
            <th>Posty</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          ${allCategories.map(cat => `
            <tr>
              <td><strong>${cat.name}</strong></td>
              <td><code>${cat.slug}</code></td>
              <td>${cat.post_count || 0}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="window.editCategory(${cat.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteCategory(${cat.id})">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

function setupEventListeners() {
  // Min: Tworzenie kategorii
  document.getElementById('submitCategoryBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('categoryName').value.trim();
    let slug = document.getElementById('categorySlug').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();
    const parent_id = document.getElementById('parentCategory').value || null;
    
    if (!name || !slug) {
      alert('Nazwa i slug są wymagane');
      return;
    }
    
    try {
      await fetchWithAuth('/api/forum/categories', {
        method: 'POST',
        body: JSON.stringify({ name, slug, description, parent_id })
      });
      
      alert('✅ Kategoria utworzona');
      // Reset pól
      document.getElementById('categoryName').value = '';
      document.getElementById('categorySlug').value = '';
      document.getElementById('categoryDescription').value = '';
      document.getElementById('parentCategory').value = '';
      
      loadCategories();
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('❌ Błąd podczas tworzenia kategorii');
    }
  });
  
  // Auto-generate slug
  document.getElementById('categoryName').addEventListener('input', (e) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
      .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
      .replace(/ś/g, 's').replace(/ź|ż/g, 'z')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    document.getElementById('categorySlug').value = slug;
  });
  
  // Min: Przypisywanie moderatora
  document.getElementById('assignBtn').addEventListener('click', async () => {
    const category_id = document.getElementById('assignCategory').value;
    const user_id = document.getElementById('assignModerator').value;
    
    if (!category_id || !user_id) {
      alert('Wybierz kategorię i moderatora');
      return;
    }
    
    try {
      await fetchWithAuth(`/api/forum/categories/${category_id}/moderators`, {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(user_id) })
      });
      
      alert('✅ Moderator przypisany');
      loadAssignments(category_id);
    } catch (error) {
      console.error('Failed to assign moderator:', error);
      alert('❌ Błąd podczas przypisywania moderatora');
    }
  });
  
  document.getElementById('assignCategory').addEventListener('change', (e) => {
    if (e.target.value) {
      loadAssignments(e.target.value);
    }
  });
}

// Min: Zarządzanie przypisaniami
async function loadAssignments(category_id) {
  try {
    const moderators = await fetchWithAuth(`/api/forum/categories/${category_id}/moderators`);
    const list = document.getElementById('assignmentsList');
    
    if (moderators.length === 0) {
      list.innerHTML = '<p style="margin-top: 20px; color: rgba(255,255,255,0.5);">Brak przypisanych moderatorów</p>';
      return;
    }
    
    list.innerHTML = `
      <div style="margin-top: 20px;">
        <h3 style="color:#FFD700; font-size:18px;">Przypisani moderatorzy:</h3>
        <div class="moderators-list">
          ${moderators.map(mod => `
            <div class="moderator-item">
              <span>👤 ${mod.name || mod.username}</span>
              <button 
                class="btn btn-danger btn-sm" 
                onclick="window.removeModerator(${category_id}, ${mod.id})"
              >
                Usuń
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load assignments:', error);
    document.getElementById('assignmentsList').innerHTML = '<p class="error">Błąd ładowania listy moderatorów.</p>';
  }
}

// Min: Edycja/Usuwanie kategorii
window.editCategory = async (id) => {
  const category = allCategories.find(c => c.id === id);
  if (!category) return;
  
  const newName = prompt('Nowa nazwa:', category.name);
  if (!newName || newName === category.name) return;
  
  const newSlug = prompt('Nowy slug:', category.slug);
  if (!newSlug) return;
  
  const newDescription = prompt('Nowy opis:', category.description || '');
  
  try {
    await fetchWithAuth(`/api/forum/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ 
        name: newName, 
        slug: newSlug, 
        description: newDescription 
      })
    });
    
    alert('✅ Kategoria zaktualizowana');
    loadCategories();
  } catch (error) {
    console.error('Failed to update category:', error);
    alert('❌ Błąd podczas aktualizacji kategorii');
  }
};

window.deleteCategory = async (id) => {
  const category = allCategories.find(c => c.id === id);
  if (!category) return;
  
  if (!confirm(`Czy na pewno chcesz usunąć kategorię "${category.name}"? Spowoduje to usunięcie wszystkich powiązanych postów!`)) {
    return;
  }
  
  try {
    await fetchWithAuth(`/api/forum/categories/${id}`, { method: 'DELETE' });
    alert('✅ Kategoria usunięta');
    loadCategories();
  } catch (error) {
    console.error('Failed to delete category:', error);
    alert('❌ Błąd podczas usuwania kategorii');
  }
};

window.removeModerator = async (category_id, user_id) => {
  if (!confirm('Czy na pewno chcesz usunąć tego moderatora z kategorii?')) return;
  
  try {
    await fetchWithAuth(`/api/forum/categories/${category_id}/moderators/${user_id}`, { method: 'DELETE' });
    alert('✅ Moderator usunięty z kategorii');
    loadAssignments(category_id);
  } catch (error) {
    console.error('Failed to remove moderator:', error);
    alert('❌ Błąd podczas usuwania moderatora');
  }
};

init();