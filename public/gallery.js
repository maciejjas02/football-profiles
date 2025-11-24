// public/gallery.js

let currentUser = null;
let galleryItems = [];
let currentIndex = 0;

async function init() {
    await setupAuth();
    await loadGallery();
    // Ładowanie powiadomień jeśli user zalogowany
    if (currentUser) {
        await loadNotifications();
    }
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

            // Odkrywanie linków w nawigacji
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

        } else {
            document.getElementById('who').textContent = "Gość";
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'none';
            // Ukryj dzwonek dla gościa
            const notifBtn = document.getElementById('notificationsBtn');
            if (notifBtn) notifBtn.style.display = 'none';
        }
    } catch (error) { console.error("Auth setup error:", error); }
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

        // Pokaż przycisk dzwonka bo jesteśmy zalogowani
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

        // Obsługa kliknięcia dzwoneczka
        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };

        // Zamykanie dropdowna
        document.addEventListener('click', (e) => {
            if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        // Oznacz wszystkie jako przeczytane
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

async function loadGallery() {
    const loadingState = document.getElementById('loadingState');
    const galleryContainer = document.getElementById('galleryContainer');
    const emptyState = document.getElementById('emptyState');

    try {
        const res = await fetch('/api/gallery/active?t=' + Date.now());
        if (!res.ok) throw new Error('API Error');

        const data = await res.json();
        galleryItems = data.items || [];

        if (loadingState) loadingState.style.display = 'none';

        if (galleryItems.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (galleryContainer) galleryContainer.style.display = 'flex';

        renderSlidesMarkup();
        setupNavigation();
        updateCarousel();

    } catch (e) {
        if (loadingState) loadingState.innerHTML = '<div class="error-state">Błąd ładowania danych galerii.</div>';
        console.error("Gallery loading failed:", e);
    }
}

function renderSlidesMarkup() {
    const track = document.getElementById('carouselTrack');
    if (!track) return;

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

    if (titleEl) titleEl.textContent = activeItem.title;
    if (descEl) descEl.textContent = activeItem.description || 'Brak opisu.';

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
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
}

init();