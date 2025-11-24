let currentUser = null;
let currentPage = 1;
let selectedCategory = null;
const POSTS_PER_PAGE = 20;

async function init() {
  await setupAuth();
  await loadCategories();
  await loadPosts();
  setupPagination();
}

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
      if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
        const modLink = document.getElementById('moderatorLink');
        if(modLink) modLink.style.display = 'block';
      }
      if (currentUser.role === 'admin') {
        const adminLink = document.getElementById('adminLink');
        if(adminLink) adminLink.style.display = 'block';
      }
    } else {
      document.getElementById('who').textContent = "Gość";
      const logoutBtn = document.getElementById('logoutBtn');
      if(logoutBtn) logoutBtn.style.display = 'none';
    }
  } catch (error) {}
}

async function loadCategories() {
  try {
    const res = await fetch('/api/forum/categories?t=' + Date.now());
    const categories = await res.json();
    const categoriesList = document.getElementById('categoriesList');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if(!categoriesList) return;

    if(categories.length === 0) {
        categoriesList.innerHTML = '<p>Brak kategorii.</p>';
        return;
    }

    categoriesList.innerHTML = categories.map(cat => `
      <div class="category-card" style="cursor: pointer;" onclick="filterByCategory(${cat.id})">
        <h3>${cat.name}</h3>
        <p>${cat.description || ''}</p>
        <div class="category-stats"><span>📄 ${cat.post_count || 0} postów</span></div>
      </div>
    `).join('');
    
    if(categoryFilter) {
        categoryFilter.innerHTML = '<option value="">Wszystkie kategorie</option>' +
          categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        
        categoryFilter.addEventListener('change', (e) => {
          selectedCategory = e.target.value ? parseInt(e.target.value) : null;
          currentPage = 1;
          loadPosts();
        });
    }
  } catch (error) {}
}

window.filterByCategory = (categoryId) => {
  selectedCategory = categoryId;
  const filter = document.getElementById('categoryFilter');
  if(filter) filter.value = categoryId;
  currentPage = 1;
  loadPosts();
  const postsSection = document.getElementById('postsSection');
  if(postsSection) postsSection.scrollIntoView({ behavior: 'smooth' });
};

async function loadPosts() {
  const postsList = document.getElementById('postsList');
  if(!postsList) return;
  
  postsList.innerHTML = '<div class="loading">Ładowanie...</div>';
  
  try {
    const offset = (currentPage - 1) * POSTS_PER_PAGE;
    let url = `/api/forum/posts?limit=${POSTS_PER_PAGE}&offset=${offset}&t=${Date.now()}`;
    if (selectedCategory) url += `&category_id=${selectedCategory}`;
    
    const res = await fetch(url);
    const posts = await res.json();
    
    if (posts.length === 0) {
      postsList.innerHTML = '<div class="empty-state">Brak postów w tej kategorii</div>';
      return;
    }
    
    postsList.innerHTML = posts.map(post => {
        // Inteligentne tworzenie zajawki (excerpt)
        let plainText = post.content.replace(/<[^>]*>/g, '').trim();
        let excerpt = plainText.substring(0, 150);
        
        if (excerpt.length < plainText.length) excerpt += '...';
        
        // Jeśli brak tekstu, ale jest obrazek
        if (excerpt.length === 0 && post.content.includes('<img')) {
            excerpt = '<span style="color: #FFD700;">📷 [Post zawiera zdjęcie]</span>';
        } else if (excerpt.length === 0) {
            excerpt = '<em>Brak treści tekstowej...</em>';
        }

        return `
          <div class="post-card">
            <div class="post-header">
              <h3><a href="post.html?id=${post.id}" style="text-decoration:none; color:#FFD700;">${post.title}</a></h3>
              <span class="post-category">${post.category_name || 'Ogólne'}</span>
            </div>
            <div class="post-meta">
              <span>👤 ${post.author_username || 'Nieznany'}</span>
              <span>💬 ${post.comment_count || 0} komentarzy</span>
              <span>🕒 ${new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <div class="post-excerpt" style="color: rgba(255,255,255,0.7); margin: 10px 0;">
              ${excerpt}
            </div>
            <a href="post.html?id=${post.id}" class="btn btn-primary btn-sm">Czytaj więcej</a>
          </div>
        `;
    }).join('');
  } catch (error) {
    console.error(error);
    postsList.innerHTML = '<div class="error-state">Błąd połączenia</div>';
  }
}

function setupPagination() {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  if(prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; loadPosts(); document.getElementById('pageInfo').textContent = `Strona ${currentPage}`; }
      });
  }
  if(nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentPage++; loadPosts(); document.getElementById('pageInfo').textContent = `Strona ${currentPage}`;
      });
  }
}

init();