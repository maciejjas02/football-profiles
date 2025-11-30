// public/gallery.js

let currentUser = null;
let galleryItems = [];
let isAnimating = false;
let visibleItems = 3;

async function init() {
    await setupAuth();
    await loadGallery();

    window.addEventListener('resize', () => {
        updateVisibleItemsCount();
        updateLayout();
        highlightCenterItem();
    });

    if (currentUser) {
        await loadNotifications();
    }
}

function updateVisibleItemsCount() {
    const width = window.innerWidth;
    if (width <= 768) visibleItems = 1;
    else if (width <= 1200) visibleItems = 2;
    else visibleItems = 3;
}

function highlightCenterItem() {
    const items = document.querySelectorAll('.gallery-item');
    items.forEach(item => item.classList.remove('active-center'));

    if (items.length === 0) return;

    let centerIndex = Math.floor(visibleItems / 2);
    if (visibleItems === 2) centerIndex = 0;

    if (items[centerIndex]) {
        items[centerIndex].classList.add('active-center');
    }
}

// --- AUTH & NOTIFICATIONS ---
async function setupAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            const whoEl = document.getElementById('who');
            if (whoEl) whoEl.textContent = currentUser.display_name || currentUser.username;
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/';
                });
            }
            if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
                const ordersLink = document.getElementById('ordersLink');
                if (ordersLink) ordersLink.style.display = 'block';
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
            const whoEl = document.getElementById('who'); if (whoEl) whoEl.textContent = "Gość";
            const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.style.display = 'none';
            const notifBtn = document.getElementById('notificationsBtn'); if (notifBtn) notifBtn.style.display = 'none';
        }
    } catch (error) { console.error("Auth setup error:", error); }
}

async function loadNotifications() {
    const btn = document.getElementById('notificationsBtn');
    if (!btn) return;
    try {
        const res = await fetch('/api/user/notifications');
        const notifications = await res.json();
        const badge = document.getElementById('notificationBadge');
        const list = document.getElementById('notificationsList');
        const unread = notifications.filter(n => n.is_read === 0).length;
        if (unread > 0) { badge.textContent = unread; badge.style.display = 'block'; }
        else { badge.style.display = 'none'; }
        btn.style.display = 'block';
        list.innerHTML = notifications.length ? notifications.map(n => `
            <div class="notification-item ${n.is_read === 0 ? 'unread' : ''}" onclick="window.handleNotificationClick(${n.id}, '${n.link || '#'}', ${n.is_read})">
                <div class="notification-title">${n.title}</div><div class="notification-message">${n.message}</div>
            </div>`).join('') : '<div class="notification-empty">Brak powiadomień.</div>';
        btn.onclick = (e) => { e.stopPropagation(); document.getElementById('notificationsDropdown').style.display = 'block'; };
        document.addEventListener('click', () => document.getElementById('notificationsDropdown').style.display = 'none');
        const markBtn = document.getElementById('markAllReadBtn');
        if (markBtn) markBtn.onclick = async () => { await fetch('/api/user/notifications/read-all', { method: 'POST' }); loadNotifications(); };
    } catch (e) { }
}
window.handleNotificationClick = async (id, link, isRead) => {
    if (isRead === 0) await fetch(`/api/user/notifications/${id}/read`, { method: 'POST' });
    if (link && link !== '#') window.location.href = link; else loadNotifications();
};

// --- LOGIKA GALERII ---

async function loadGallery() {
    const loadingState = document.getElementById('loadingState');
    const galleryContainer = document.getElementById('galleryContainer');
    const emptyState = document.getElementById('emptyState');

    try {
        const res = await fetch('/api/gallery/active?t=' + Date.now());
        const data = await res.json();
        galleryItems = data.items || [];

        if (loadingState) loadingState.style.display = 'none';

        if (galleryItems.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (galleryItems.length > 0) {
            while (galleryItems.length < 6) {
                galleryItems = [...galleryItems, ...galleryItems];
            }
        }

        if (galleryContainer) galleryContainer.style.display = 'flex';

        updateVisibleItemsCount();
        renderGallery();
        highlightCenterItem();
        setupSliderEvents();

    } catch (e) {
        console.error(e);
        if (loadingState) loadingState.innerHTML = '<div class="error-state">Błąd ładowania danych galerii.</div>';
    }
}

function renderGallery() {
    const track = document.getElementById('carouselTrack');
    track.innerHTML = '';

    galleryItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML = `
            <div class="gallery-card-inner">
                <div class="card-image-wrapper">
                    <img src="/gallery-img/${item.filename}" alt="${item.title}" loading="lazy" />
                </div>
                <div class="card-content">
                    <h3 class="card-title">${item.title}</h3>
                    <p class="card-description">${item.description || ''}</p>
                </div>
            </div>
        `;
        track.appendChild(div);
    });
}

function getItemWidth() {
    const item = document.querySelector('.gallery-item');
    return item ? item.getBoundingClientRect().width : 0;
}

function moveNext() {
    if (isAnimating || galleryItems.length === 0) return;
    isAnimating = true;

    const track = document.getElementById('carouselTrack');
    const itemWidth = getItemWidth();

    const items = document.querySelectorAll('.gallery-item');
    let centerIndex = Math.floor(visibleItems / 2);
    if (visibleItems === 2) centerIndex = 0;

    if (items[centerIndex]) items[centerIndex].classList.remove('active-center');
    if (items[centerIndex + 1]) items[centerIndex + 1].classList.add('active-center');

    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    track.style.transform = `translateX(-${itemWidth}px)`;

    track.addEventListener('transitionend', () => {
        track.style.transition = 'none';
        track.appendChild(track.firstElementChild);
        track.style.transform = 'translateX(0)';

        highlightCenterItem();

        requestAnimationFrame(() => {
            isAnimating = false;
        });
    }, { once: true });
}

function movePrev() {
    if (isAnimating || galleryItems.length === 0) return;
    isAnimating = true;

    const track = document.getElementById('carouselTrack');
    const itemWidth = getItemWidth();

    track.style.transition = 'none';
    track.prepend(track.lastElementChild);
    track.style.transform = `translateX(-${itemWidth}px)`;

    highlightCenterItem();

    void track.offsetWidth;

    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    track.style.transform = 'translateX(0)';

    track.addEventListener('transitionend', () => {
        isAnimating = false;
    }, { once: true });
}

function setupSliderEvents() {
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    if (nextBtn) nextBtn.addEventListener('click', moveNext);
    if (prevBtn) prevBtn.addEventListener('click', movePrev);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') movePrev();
        if (e.key === 'ArrowRight') moveNext();
    });
}

function updateLayout() {
    const track = document.getElementById('carouselTrack');
    if (track) {
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        isAnimating = false;
    }
}

init();

const logoSection = document.querySelector('.logo-section');
if (logoSection) {
    logoSection.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
    });
}