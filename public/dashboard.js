// public/dashboard.js
import { fetchWithAuth } from './utils/api-client.js';
import './theme-manager.js';

let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const sliderTrack = document.querySelector('.slider-track');
const arrowLeft = document.querySelector('.slider-arrow-left');
const arrowRight = document.querySelector('.slider-arrow-right');

function setActiveNav() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.topbar-nav .nav-tab').forEach(link => {
        link.classList.remove('active');
        const linkPath = new URL(link.href).pathname;
        const isDashboardHome = (currentPath === '/' || currentPath === '/dashboard.html') && linkPath === '/dashboard.html';
        if (linkPath === currentPath || isDashboardHome) {
            link.classList.add('active');
        }
    });
}

function goToSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    currentSlide = index;
    if (sliderTrack) sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
}
if (arrowLeft) arrowLeft.addEventListener('click', () => goToSlide(currentSlide - 1));
if (arrowRight) arrowRight.addEventListener('click', () => goToSlide(currentSlide + 1));
setInterval(() => goToSlide(currentSlide + 1), 5000);

const playersSection = document.getElementById('players-section');
const playersGrid = document.getElementById('players-grid');
const sectionTitle = document.getElementById('section-title');
const backBtn = document.getElementById('back-btn');
const leaguesBackBtn = document.getElementById('leagues-back-btn');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;

async function setupAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not auth');
        const data = await res.json();
        currentUser = data.user;

        document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

        if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
            const modLink = document.getElementById('moderatorLink');
            if (modLink) modLink.style.display = 'block';
            const ordersLink = document.getElementById('ordersLink');
            if (ordersLink) ordersLink.style.display = 'block';
        }

        if (currentUser.role === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'block';
            const galleryManageLink = document.getElementById('galleryManageLink');
            if (galleryManageLink) galleryManageLink.style.display = 'block';
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await fetchWithAuth('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/';
                } catch (e) {
                    window.location.href = '/';
                }
            });
        }

        const purRes = await fetch('/api/user/purchases');
        if (purRes.ok) {
            const purchases = await purRes.json();
            const countEl = document.getElementById('collection-count');
            if (countEl) countEl.textContent = `${purchases.length} koszulek`;
        }

        await loadNotifications();

    } catch (e) {
        window.location.href = '/';
    }
}

async function loadNotifications() {
    const btn = document.getElementById('notificationsBtn');
    const badge = document.getElementById('notificationBadge');
    const dropdown = document.getElementById('notificationsDropdown');
    const list = document.getElementById('notificationsList');

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

        if (notifications.length === 0) {
            list.innerHTML = '<div class="notification-empty">Brak powiadomień.</div>';
            return;
        }

        list.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.is_read === 0 ? 'unread' : ''}" 
                 onclick="window.handleNotificationClick(${n.id}, '${n.link || '#'}', ${n.is_read})"
            >
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${new Date(n.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');

        btn.onclick = () => {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };

        document.getElementById('markAllReadBtn').onclick = async () => {
            await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' });
            loadNotifications();
        };

    } catch (e) {
        badge.style.display = 'none';
    }
}

window.handleNotificationClick = async (id, link, isRead) => {
    if (isRead === 0) {
        await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
        loadNotifications();
    }
    if (link && link !== '#') {
        window.location.href = link;
    }
};

async function showPlayers(category, title) {
    try {
        const res = await fetch(`/api/players/category/${category}`);
        const players = await res.json();

        sectionTitle.textContent = title;
        playersGrid.innerHTML = '';

        if (players.length === 0) {
            playersGrid.innerHTML = '<div class="empty-state">Brak zawodników</div>';
        } else {
            players.forEach(p => {
                const card = document.createElement('div');
                card.className = 'player-card';
                card.style.backgroundImage = `url('${p.imageUrl}')`;
                card.innerHTML = `
                    <div class="player-info">
                        <h3>${p.name}</h3>
                        <p class="team">${p.team}</p>
                        <a href="/player.html?id=${p.id}" class="btn btn-primary">Profil</a>
                    </div>
                `;
                playersGrid.appendChild(card);
            });
        }
        hideAll();
        playersSection.classList.remove('hidden');
        playersSection.style.display = 'block';
    } catch (e) { console.error(e); }
}

function hideAll() {
    document.querySelector('.main-panels').style.display = 'none';
    playersSection.style.display = 'none';
    document.getElementById('leagues-section').style.display = 'none';
}

function showMain() {
    playersSection.style.display = 'none';
    document.getElementById('leagues-section').style.display = 'none';
    document.querySelector('.main-panels').style.display = 'grid';
}

document.addEventListener('click', (e) => {
    const card = e.target.closest('.panel-card');
    if (card) {
        const action = card.dataset.action;
        if (action === 'my-collection') window.location.href = '/my-collection.html';
        else if (action === 'leagues') {
            hideAll();
            document.getElementById('leagues-section').style.display = 'block';
        }
        else if (action === 'top-players') showPlayers('top-players', 'Gwiazdy');
        else if (action === 'new-talents') showPlayers('new-talents', 'Talenty');
        else if (action === 'goalkeepers') showPlayers('goalkeepers', 'Bramkarze');
        else if (action === 'legends') showPlayers('legends', 'Legendy');
    }

    const dropdown = document.getElementById('notificationsDropdown');
    const btn = document.getElementById('notificationsBtn');
    if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});
const logoSection = document.querySelector('.logo-section');
if (logoSection) {
    logoSection.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
    });
}

if (backBtn) backBtn.addEventListener('click', showMain);
if (leaguesBackBtn) leaguesBackBtn.addEventListener('click', showMain);

setupAuth().then(setActiveNav);