import { fetchWithAuth, getCurrentUser, handleLogout } from './utils/api-client.js';

let allItems = [];
let currentIndex = 0;
let autoPlayInterval;

// Check auth
const user = await getCurrentUser();
if (user) {
  document.getElementById('userDisplay').textContent = user.name || user.username;
  
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await handleLogout();
    window.location.href = '/';
  });
  
  // Show links based on role
  if (user.role === 'moderator' || user.role === 'admin') {
    document.getElementById('moderatorLink').style.display = 'block';
  }
  if (user.role === 'admin') {
    document.getElementById('adminLink').style.display = 'block';
  }
} else {
  window.location.href = '/';
}

// Load active gallery
async function loadGallery() {
  const container = document.getElementById('gallerySlider');
  container.innerHTML = '<div class="loading" style="text-align: center; padding: 60px;">Ładowanie...</div>';

  try {
    const data = await fetchWithAuth('/api/gallery/active');
    
    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
          <p style="font-size: 24px; color: rgba(255,255,255,0.5);">Brak zdjęć w galerii</p>
          <p style="color: rgba(255,255,255,0.3);">Administrator nie ustawił jeszcze żadnej kolekcji jako aktywnej.</p>
        </div>
      `;
      return;
    }

    allItems = data.items;
    renderCarousel();
    setupNavigation();
    setupDots();
    startAutoPlay();

  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="error" style="text-align: center;">Błąd ładowania galerii</p>';
  }
}

// Render carousel (środek większy, boki mniejsze i szare)
function renderCarousel() {
  const container = document.getElementById('gallerySlider');
  
  if (allItems.length === 0) return;

  // Show 3 items: previous (left), current (center), next (right)
  const prevIndex = (currentIndex - 1 + allItems.length) % allItems.length;
  const nextIndex = (currentIndex + 1) % allItems.length;

  const prevItem = allItems[prevIndex];
  const currentItem = allItems[currentIndex];
  const nextItem = allItems[nextIndex];

  container.innerHTML = `
    <div class="carousel-item carousel-item-prev" data-index="${prevIndex}">
      <img src="/uploads/gallery/${prevItem.filename}" alt="${prevItem.title}" />
    </div>
    
    <div class="carousel-item carousel-item-active" data-index="${currentIndex}">
      <img src="/uploads/gallery/${currentItem.filename}" alt="${currentItem.title}" />
      <div class="carousel-caption">
        <h2>${currentItem.title}</h2>
        ${currentItem.description ? `<p>${currentItem.description}</p>` : ''}
      </div>
    </div>
    
    <div class="carousel-item carousel-item-next" data-index="${nextIndex}">
      <img src="/uploads/gallery/${nextItem.filename}" alt="${nextItem.title}" />
    </div>
  `;
}

// Setup navigation
function setupNavigation() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + allItems.length) % allItems.length;
    renderCarousel();
    updateDots();
    resetAutoPlay();
  };

  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % allItems.length;
    renderCarousel();
    updateDots();
    resetAutoPlay();
  };

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevBtn.click();
    if (e.key === 'ArrowRight') nextBtn.click();
  });

  // Pause on hover
  const container = document.getElementById('gallerySlider');
  container.addEventListener('mouseenter', stopAutoPlay);
  container.addEventListener('mouseleave', startAutoPlay);
}

// Setup dots (jedna kropka na każde zdjęcie)
function setupDots() {
  const dotsContainer = document.getElementById('sliderDots');
  dotsContainer.innerHTML = allItems.map((item, index) => 
    `<span class="dot ${index === currentIndex ? 'active' : ''}" data-index="${index}"></span>`
  ).join('');

  // Click handlers for dots
  dotsContainer.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      currentIndex = parseInt(dot.dataset.index);
      renderCarousel();
      updateDots();
      resetAutoPlay();
    });
  });
}

// Update active dot
function updateDots() {
  document.querySelectorAll('.dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === currentIndex);
  });
}

// Auto-play
function startAutoPlay() {
  stopAutoPlay();
  autoPlayInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % allItems.length;
    renderCarousel();
    updateDots();
  }, 5000);
}

function stopAutoPlay() {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  }
}

function resetAutoPlay() {
  startAutoPlay();
}

// Initialize
loadGallery();
