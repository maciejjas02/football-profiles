// public/player.js
import { showToast, showConfirm } from './utils/ui.js';
// DODANO: Importujemy fetchWithAuth, który obsługuje tokeny CSRF
import { fetchWithAuth } from './utils/api-client.js';

const loading = document.getElementById('loading');
const errorState = document.getElementById('error-state');
const playerContent = document.getElementById('player-content');
const buyJerseyBtn = document.getElementById('buy-jersey-btn');
const logoutBtn = document.getElementById('logoutBtn');

let currentPlayer = null;
let currentUser = null;

function getId() { return new URLSearchParams(window.location.search).get('id'); }

async function init() {
    await setupAuth();
    const id = getId();
    if (id) loadPlayer(id);
    else showError();

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
            if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
                const ordersLink = document.getElementById('ordersLink');
                if (ordersLink) ordersLink.style.display = 'block';
            }

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

            logoutBtn.addEventListener('click', async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
            });
        } else {
            document.getElementById('who').textContent = "Gość";
            logoutBtn.style.display = 'none';
            const notifBtn = document.getElementById('notificationsBtn');
            if (notifBtn) notifBtn.style.display = 'none';
        }
    } catch (e) { console.log(e); }
}

// --- POWIADOMIENIA ---
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

        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };

        document.addEventListener('click', (e) => {
            if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        const markReadBtn = document.getElementById('markAllReadBtn');
        if (markReadBtn) {
            markReadBtn.onclick = async () => {
                await fetch('/api/user/notifications/read-all', { method: 'POST' });
                loadNotifications();
            };
        }
    } catch (e) { console.error(e); badge.style.display = 'none'; }
}

window.handleNotificationClick = async (id, link, isRead) => {
    if (isRead === 0) await fetch(`/api/user/notifications/${id}/read`, { method: 'POST' });
    if (link && link !== '#') window.location.href = link;
    else loadNotifications();
};

async function loadPlayer(id) {
    try {
        const res = await fetch(`/api/player/${id}`);
        if (!res.ok) throw new Error();
        currentPlayer = await res.json();
        displayPlayer(currentPlayer);
    } catch (e) { showError(); }
}

function showError() {
    loading.classList.add('hidden');
    errorState.classList.remove('hidden');
}

function displayPlayer(p) {
    document.title = p.name;
    // Poprawiony breadcrumb z linkiem
    document.getElementById('player-breadcrumb').innerHTML = p.name;
    document.getElementById('player-name').textContent = p.name;
    document.getElementById('player-team').textContent = p.team;
    document.getElementById('player-position').textContent = p.position;

    document.getElementById('player-age').textContent = p.age;
    document.getElementById('player-height').textContent = p.height;
    document.getElementById('player-weight').textContent = p.weight;
    document.getElementById('player-value').textContent = p.marketValue;

    const img = document.getElementById('player-image');
    img.src = p.imageUrl;
    img.onerror = () => { img.src = 'https://via.placeholder.com/200x200/333/fff?text=PLAYER'; };

    document.getElementById('national-flag').src = p.nationalFlag || '';
    document.getElementById('team-logo').src = p.teamLogo || '';

    document.getElementById('jersey-team').textContent = p.team;
    document.getElementById('jersey-price-amount').textContent = (p.jerseyPrice || 299) + ' zł';

    const jImg = document.getElementById('jersey-image');
    jImg.src = p.jerseyImageUrl || 'https://via.placeholder.com/300x300/1a1a1a/FFFFFF?text=Koszulka';

    document.getElementById('stat-goals').textContent = p.stats.goals;
    document.getElementById('stat-assists').textContent = p.stats.assists;
    document.getElementById('stat-matches').textContent = p.stats.matches;
    document.getElementById('stat-trophies').textContent = p.stats.trophies;

    document.getElementById('player-biography').textContent = p.biography;

    if (p.achievements) {
        document.getElementById('achievements-list').innerHTML = p.achievements.map(a => `<div class="achievement-item">🏆 ${a}</div>`).join('');
    }

    buyJerseyBtn.textContent = "Dodaj do koszyka";
    buyJerseyBtn.onclick = buyJersey;

    loading.classList.add('hidden');
    playerContent.classList.remove('hidden');
}

// --- POPRAWIONA FUNKCJA KUPOWANIA (UŻYWA fetchWithAuth) ---
async function buyJersey() {
    if (!currentUser) {
        showToast("Zaloguj się, aby dodać do koszyka!", 'error');
        return;
    }

    const btn = document.getElementById('buy-jersey-btn');
    const originalText = btn.textContent;
    btn.textContent = "Dodawanie...";
    btn.disabled = true;

    try {
        // ZMIANA: Używamy fetchWithAuth zamiast zwykłego fetch
        // fetchWithAuth automatycznie dodaje token CSRF i rzuca błąd, jeśli status != 200
        const data = await fetchWithAuth('/api/cart', {
            method: 'POST',
            body: JSON.stringify({ playerId: currentPlayer.id })
        });

        // Jeśli kod dotarł tutaj, to znaczy że sukces (nie trzeba sprawdzać res.ok)
        showToast("Produkt pomyślnie dodany do koszyka!", 'success');

        btn.textContent = "✅ Dodano!";
        btn.style.background = "#22c55e";

        const shouldGoToCart = await showConfirm(
            "Dodano do koszyka",
            "Produkt został dodany. Czy chcesz przejść teraz do koszyka?"
        );

        if (shouldGoToCart) {
            window.location.href = '/my-collection.html';
        } else {
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.background = "";
            }, 2000);
        }

    } catch (e) {
        // fetchWithAuth rzuca błędy, które łapiemy tutaj
        console.error(e);
        showToast("Błąd: " + (e.message || "Nie udało się dodać do koszyka"), 'error');
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

document.getElementById('dashboard-btn')?.addEventListener('click', () => window.location.href = '/dashboard.html');
document.getElementById('error-dashboard-btn')?.addEventListener('click', () => window.location.href = '/dashboard.html');

init();