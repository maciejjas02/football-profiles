// public/gallery.js

let currentUser = null;

async function init() {
  await setupAuth();
  await loadGallery();
}

// Minimal setupAuth, dla topbaru
async function setupAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/';
                });
            }
            // Pokaż linki admina
            const modLink = document.getElementById('moderatorLink');
            if (modLink) modLink.style.display = (currentUser.role === 'moderator' || currentUser.role === 'admin') ? 'block' : 'none';
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
        } else {
            document.getElementById('who').textContent = "Gość";
            document.getElementById('logoutBtn').style.display = 'none';
        }
    } catch (error) { console.error("Auth setup error:", error); }
}

async function loadGallery() {
    const loadingState = document.getElementById('loadingState');
    const carouselWrapper = document.getElementById('carouselWrapper');
    const emptyState = document.getElementById('emptyState');
    const sliderContent = document.getElementById('sliderContent');

    try {
        // Wywołanie endpointu pobierającego AKTYWNĄ kolekcję
        const res = await fetch('/api/gallery/active?t=' + Date.now());
        if (!res.ok) throw new Error('API Error');
        
        const data = await res.json();
        const items = data.items || [];
        
        if(loadingState) loadingState.style.display = 'none';
        
        if (items.length === 0) {
            if(emptyState) emptyState.style.display = 'block';
            return;
        }

        // Renderowanie kart galerii (MIN Requirement: Responsive Grid)
        if(carouselWrapper) {
            carouselWrapper.className = 'images-grid'; // Używamy klasy CSS do responsywności
            carouselWrapper.innerHTML = items.map(item => `
                <div class="gallery-card">
                    <img src="/uploads/gallery/thumbnails/${item.filename}" alt="${item.title}" loading="lazy" />
                    <div class="gallery-card-content">
                        <h3>${item.title}</h3>
                        <p>${item.description || 'Brak opisu.'}</p>
                    </div>
                </div>
            `).join('');
        }

        if(sliderContent) sliderContent.style.display = 'flex';
        
    } catch (e) {
        if(loadingState) loadingState.innerHTML = '<div class="error-state">Błąd ładowania danych galerii. Sprawdź konsolę (F12).</div>';
        console.error("Gallery loading failed:", e);
    }
}

init();