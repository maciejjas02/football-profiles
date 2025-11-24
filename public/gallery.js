// public/gallery.js

let currentUser = null;
let galleryItems = [];
let currentIndex = 0;

async function init() {
  await setupAuth();
  await loadGallery();
}

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
            const modLink = document.getElementById('moderatorLink');
            if (modLink) modLink.style.display = (currentUser.role === 'moderator' || currentUser.role === 'admin') ? 'block' : 'none';
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
            const galleryManageLink = document.getElementById('galleryManageLink');
            if (galleryManageLink) galleryManageLink.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
        } else {
            document.getElementById('who').textContent = "Gość";
            document.getElementById('logoutBtn').style.display = 'none';
        }
    } catch (error) { console.error("Auth setup error:", error); }
}

async function loadGallery() {
    const loadingState = document.getElementById('loadingState');
    const galleryContainer = document.getElementById('galleryContainer');
    const emptyState = document.getElementById('emptyState');

    try {
        const res = await fetch('/api/gallery/active?t=' + Date.now());
        if (!res.ok) throw new Error('API Error');
        
        const data = await res.json();
        galleryItems = data.items || [];
        
        if(loadingState) loadingState.style.display = 'none';
        
        if (galleryItems.length === 0) {
            if(emptyState) emptyState.style.display = 'block';
            return;
        }

        if(galleryContainer) galleryContainer.style.display = 'flex';
        
        renderSlidesMarkup(); 
        setupNavigation();
        updateCarousel(); 

    } catch (e) {
        if(loadingState) loadingState.innerHTML = '<div class="error-state">Błąd ładowania danych galerii.</div>';
        console.error("Gallery loading failed:", e);
    }
}

function renderSlidesMarkup() {
    const track = document.getElementById('carouselTrack');
    if (!track) return;

    // ZMIANA: Wstawiamy dwa img - jeden jako tło (bg), drugi jako główny (main)
    track.innerHTML = galleryItems.map((item, index) => `
        <div class="carousel-card" onclick="window.goToSlide(${index})">
            <div class="card-bg" style="background-image: url('/uploads/gallery/${item.filename}')"></div>
            <img class="card-img" src="/uploads/gallery/${item.filename}" alt="${item.title}" loading="lazy" />
        </div>
    `).join('');
}

function updateCarousel() {
    const track = document.getElementById('carouselTrack');
    if (!track || galleryItems.length === 0) return;

    const slides = Array.from(track.children);
    const count = galleryItems.length;
    
    const prevIndex = (currentIndex - 1 + count) % count;
    const nextIndex = (currentIndex + 1) % count;
    
    slides.forEach((slide, index) => {
        slide.className = 'carousel-card'; 
        
        if (index === currentIndex) {
            slide.classList.add('active');
        } else if (index === prevIndex) {
            slide.classList.add('prev');
        } else if (index === nextIndex) {
            slide.classList.add('next');
        }
    });
    
    const activeItem = galleryItems[currentIndex];
    const titleEl = document.getElementById('imageTitle');
    const descEl = document.getElementById('imageDescription');
    
    if(titleEl) titleEl.textContent = activeItem.title;
    if(descEl) descEl.textContent = activeItem.description || 'Brak opisu.';
    
    const dotsContainer = document.getElementById('dotsContainer');
    if (dotsContainer) {
        dotsContainer.innerHTML = galleryItems.map((_, index) => `
            <span class="dot ${index === currentIndex ? 'active' : ''}" 
                  onclick="window.goToSlide(${index})"></span>
        `).join('');
    }
}

function nextSlide() {
    currentIndex = (currentIndex + 1) % galleryItems.length;
    updateCarousel();
}

function prevSlide() {
    currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    updateCarousel();
}

window.goToSlide = (index) => {
    if (index === currentIndex) return;
    const count = galleryItems.length;
    const nextIndex = (currentIndex + 1) % count;
    const prevIndex = (currentIndex - 1 + count) % count;

    if (index === nextIndex) {
        nextSlide();
    } else if (index === prevIndex) {
        prevSlide();
    } else {
        currentIndex = index;
        updateCarousel();
    }
}

function setupNavigation() {
    document.getElementById('nextBtn').addEventListener('click', nextSlide);
    document.getElementById('prevBtn').addEventListener('click', prevSlide);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
}

init();