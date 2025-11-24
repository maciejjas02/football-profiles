// public/my-collection.js
import { showToast, showConfirm } from './utils/ui.js'; // <--- IMPORT UI

let currentUser = null;

async function init() {
  await setupAuth();
  await loadCart();
  await loadPurchases();

  document.getElementById('checkoutBtn').addEventListener('click', checkout);

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

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
    } else {
      window.location.href = '/';
    }
  } catch (error) { window.location.href = '/'; }
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

async function loadCart() {
  const list = document.getElementById('cartList');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const totalEl = document.getElementById('cartTotal');
  const amountEl = document.getElementById('totalAmount');

  try {
    const res = await fetch('/api/cart');
    const items = await res.json();

    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state" style="width:100%; text-align:center;">Twój koszyk jest pusty.</div>';
      checkoutBtn.style.display = 'none';
      totalEl.style.display = 'none';
      return;
    }

    let total = 0;
    list.innerHTML = items.map(item => {
      const itemTotal = item.jersey_price * item.quantity;
      total += itemTotal;
      const img = item.jersey_image_url || item.player_image || 'https://via.placeholder.com/300x300/1a1a1a/FFFFFF?text=Brak+Zdjecia';

      return `
            <div class="jersey-card-item">
                <div class="status-badge status-pending" style="background:rgba(255,255,255,0.2); color:#fff;">Ilość: ${item.quantity}</div>
                <div class="jersey-img-container" style="height:180px;">
                    <img src="${img}" alt="${item.name}">
                </div>
                <div class="jersey-details">
                    <div class="jersey-title" style="font-size:16px;">${item.name}</div>
                    <div class="jersey-team" style="margin-bottom:5px;">${item.team}</div>
                    <div class="jersey-meta" style="border-top:none; padding-top:5px;">
                        <div class="jersey-price">${item.jersey_price} zł x ${item.quantity}</div>
                        <button class="btn btn-danger btn-sm" onclick="removeFromCart(${item.id})">Usuń</button>
                    </div>
                </div>
            </div>
            `;
    }).join('');

    amountEl.textContent = total;
    checkoutBtn.style.display = 'block';
    totalEl.style.display = 'block';

  } catch (e) {
    list.innerHTML = '<div class="error-state">Błąd koszyka</div>';
  }
}

async function loadPurchases() {
  const list = document.getElementById('purchasesList');

  try {
    const res = await fetch('/api/user/purchases');
    const purchases = await res.json();

    if (purchases.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="width:100%; text-align:center;">
            <p style="color: rgba(255,255,255,0.5);">Brak historii zakupów.</p>
        </div>`;
      return;
    }

    list.innerHTML = purchases.map(p => {
      const isCompleted = p.status === 'completed';
      const jerseyImage = p.jersey_image_url || p.player_image || 'https://via.placeholder.com/300x300/1a1a1a/FFFFFF?text=Brak+Zdjecia';

      return `
      <div class="jersey-card-item">
        <div class="status-badge ${isCompleted ? 'status-completed' : 'status-pending'}">
            ${isCompleted ? '✅ Opłacone' : '⏳ Oczekuje'}
        </div>
        
        <div class="jersey-img-container">
            <img src="${jerseyImage}" alt="${p.player_name}" onerror="this.src='${p.player_image}'">
        </div>
        
        <div class="jersey-details">
            <div class="jersey-title">${p.player_name}</div>
            <div class="jersey-team">${p.team}</div>
            
            ${!isCompleted ? `
                <button class="pay-btn" onclick="payForOrder(${p.id})">
                    💳 Zapłać teraz (Sandbox)
                </button>
            ` : ''}
            
            <div class="jersey-meta">
                <div class="jersey-price">${p.jersey_price} zł</div>
                <div class="jersey-date">${new Date(p.purchase_date).toLocaleDateString()}</div>
            </div>
        </div>
      </div>
    `}).join('');

  } catch (error) {
    list.innerHTML = '<div class="error-state">Błąd ładowania historii zakupów.</div>';
    console.error(error);
  }
}

window.removeFromCart = async (id) => {
  // Zmiana: custom modal zamiast confirm()
  const confirmed = await showConfirm("Usuwanie", "Czy na pewno chcesz usunąć ten produkt z koszyka?");
  if (!confirmed) return;

  await fetch(`/api/cart/${id}`, { method: 'DELETE' });
  showToast("Produkt usunięty z koszyka", 'info');
  loadCart();
};

async function checkout() {
  const confirmed = await showConfirm("Złożenie zamówienia", "Czy na pewno chcesz sfinalizować zamówienie?");
  if (!confirmed) return;

  try {
    const res = await fetch('/api/cart/checkout', { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      showToast("✅ " + data.message, 'success');
      loadCart();
      loadPurchases();
    } else {
      showToast("Błąd: " + data.error, 'error');
    }
  } catch (e) {
    showToast("Wystąpił błąd sieci.", 'error');
  }
}

window.payForOrder = async (id) => {
  const confirmed = await showConfirm("Płatność (Sandbox)", "Symulacja płatności: Czy chcesz opłacić to zamówienie?");
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/purchases/${id}/pay`, { method: 'POST' });
    if (res.ok) {
      showToast("Płatność przyjęta! Status zaktualizowany.", 'success');
      loadPurchases();
    } else {
      showToast("Wystąpił błąd podczas płatności.", 'error');
    }
  } catch (e) {
    showToast("Błąd połączenia z serwerem.", 'error');
  }
};

init();