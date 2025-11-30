// public/my-collection.js
import { showToast, showConfirm } from './utils/ui.js';
import { fetchWithAuth } from './utils/api-client.js';

let currentUser = null;

async function refreshUserData() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      return data.user;
    }
  } catch (e) { }
  return null;
}

async function init() {
  await setupAuth();
  await loadCart();
  await loadPurchases();

  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', checkout);
  }

  if (currentUser) {
    await loadNotifications();
  }
}

// --- AUTH ---
async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me'); // GET jest bezpieczny
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

      // Linki nawigacyjne
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

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
          // Wymagany fetchWithAuth dla POST
          await fetchWithAuth('/api/auth/logout', { method: 'POST' });
          window.location.href = '/';
        } catch (e) { console.error("Logout failed", e); }
      });
    } else {
      window.location.href = '/';
    }
  } catch (error) { window.location.href = '/'; }
}

// --- NOTIFICATIONS ---
async function loadNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const badge = document.getElementById('notificationBadge');
  const dropdown = document.getElementById('notificationsDropdown');
  const list = document.getElementById('notificationsList');

  if (!btn) return;

  try {
    const notifications = await fetchWithAuth('/api/user/notifications'); // GET jest bezpieczny
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
        // Wymagany fetchWithAuth dla POST
        await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' });
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
    // Wymagany fetchWithAuth dla POST
    await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  }
  if (link && link !== '#') {
    window.location.href = link;
  } else {
    loadNotifications();
  }
};

// --- CART ---
async function loadCart() {
  const list = document.getElementById('cartList');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const totalEl = document.getElementById('cartTotal');
  const amountEl = document.getElementById('totalAmount');

  try {
    // Wymagany fetchWithAuth dla GET (choć GET jest bezpieczny, ułatwia to obsługę sesji)
    const items = await fetchWithAuth('/api/cart');

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
                        <button class="btn btn-danger btn-sm" onclick="window.removeFromCart(${item.id})">Usuń</button>
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

window.removeFromCart = async (id) => {
  const confirmed = await showConfirm("Usuwanie", "Czy na pewno chcesz usunąć ten produkt z koszyka?");
  if (!confirmed) return;

  try {
    // Wymagany fetchWithAuth dla DELETE
    await fetchWithAuth(`/api/cart/${id}`, { method: 'DELETE' });
    showToast("Produkt usunięty z koszyka", 'info');
    loadCart();
  } catch (e) {
    showToast("Błąd usuwania: " + e.message, 'error');
  }
};

// --- PURCHASES ---
async function loadPurchases() {
  const list = document.getElementById('purchasesList');

  try {
    const purchases = await fetchWithAuth('/api/user/purchases');

    if (purchases.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="width:100%; text-align:center;">
            <p style="color: rgba(255,255,255,0.5);">Brak historii zakupów.</p>
        </div>`;
      return;
    }

    // 1. Grupowanie po dacie zakupu
    const orders = {};
    purchases.forEach(p => {
      const dateKey = p.purchase_date;
      if (!orders[dateKey]) {
        orders[dateKey] = {
          date: p.purchase_date,
          status: p.status,
          items: [],
          total: 0
        };
      }
      orders[dateKey].items.push(p);
      orders[dateKey].total += p.jersey_price;
    });

    // 2. Sortowanie zamówień (od najnowszych)
    const sortedDates = Object.keys(orders).sort((a, b) => new Date(b) - new Date(a));

    // 3. Generowanie HTML dla Zamówień (Order Cards)
    list.innerHTML = sortedDates.map(dateKey => {
      const order = orders[dateKey];
      const itemCount = order.items.length;
      const dateDisplay = new Date(order.date).toLocaleString();
      const status = order.status; // pending, completed, shipped, cancelled

      // Generowanie odznaki statusu
      let badgeHtml = '';
      if (status === 'pending') {
        badgeHtml = '<span class="status-badge status-pending">⏳ Oczekuje</span>';
      } else if (status === 'completed') {
        badgeHtml = '<span class="status-badge status-completed">✅ Opłacone</span>';
      } else if (status === 'shipped') {
        badgeHtml = '<span class="status-badge" style="background:rgba(59, 130, 246, 0.2); color:#60a5fa; border:1px solid #3b82f6;">📦 Wysłane</span>';
      } else if (status === 'cancelled') {
        badgeHtml = '<span class="status-badge" style="background:rgba(239, 68, 68, 0.2); color:#f87171; border:1px solid #ef4444;">❌ Anulowane</span>';
      } else {
        badgeHtml = `<span class="status-badge">${status}</span>`;
      }

      // Generowanie sekcji akcji (przycisk lub komunikat)
      let actionHtml = '';
      if (status === 'pending') {
        actionHtml = `
                    <button class="pay-btn" onclick="window.payForOrderGroup('${order.date}')">
                        💳 Zapłać za całość (BLIK)
                    </button>`;
      } else if (status === 'completed') {
        actionHtml = '<div style="color:#4ade80; font-size:13px; margin-top:10px;">Dziękujemy za zakup! Oczekiwanie na wysyłkę.</div>';
      } else if (status === 'shipped') {
        actionHtml = '<div style="color:#60a5fa; font-size:13px; margin-top:10px; font-weight:bold;">📦 Twoje zamówienie zostało wysłane! Spodziewaj się kuriera.</div>';
      } else if (status === 'cancelled') {
        actionHtml = '<div style="color:#f87171; font-size:13px; margin-top:10px;">To zamówienie zostało anulowane.</div>';
      }

      const itemsHtml = order.items.map(item => `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; background:rgba(0,0,0,0.2); padding:5px; border-radius:4px;">
                    <img src="${item.jersey_image_url || item.player_image}" style="width:30px; height:30px; object-fit:contain;">
                    <div style="font-size:12px;">
                        <div style="color:#fff;">${item.player_name}</div>
                        <div style="color:#888;">${item.jersey_price} zł</div>
                    </div>
                </div>
            `).join('');

      return `
            <div class="jersey-card-item" style="width: 100%; max-width: 600px; flex-direction: row; min-height: auto;">
                <div style="padding: 20px; flex: 1; border-right: 1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="color:#888; font-size:12px;">${dateDisplay}</span>
                        ${badgeHtml}
                    </div>
                    
                    <div class="jersey-title" style="font-size:18px;">Zamówienie (${itemCount} szt.)</div>
                    <div class="jersey-price" style="font-size:22px; color:#FFD700; margin: 10px 0;">Suma: ${order.total} zł</div>

                    ${actionHtml}
                </div>

                <div style="padding: 20px; width: 200px; background: rgba(0,0,0,0.2); overflow-y: auto; max-height: 250px;">
                    <div style="font-size:11px; text-transform:uppercase; color:#888; margin-bottom:10px;">Produkty:</div>
                    ${itemsHtml}
                </div>
            </div>
            `;
    }).join('');

    list.style.flexDirection = 'column';
    list.style.alignItems = 'center';

  } catch (error) {
    list.innerHTML = '<div class="error-state">Błąd ładowania historii zakupów.</div>';
    console.error(error);
  }
}

// --- MODALS HELPERS ---

function openAddressModal(currentData) {
  return new Promise((resolve) => {
    const modal = document.getElementById('addressModal');
    const addressIn = document.getElementById('modalAddress');
    const zipIn = document.getElementById('modalZip');
    const cityIn = document.getElementById('modalCity');
    const confirmBtn = document.getElementById('addressConfirmBtn');
    const cancelBtn = document.getElementById('addressCancelBtn');

    if (currentData) {
      addressIn.value = currentData.address || '';
      zipIn.value = currentData.postal_code || '';
      cityIn.value = currentData.city || '';
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);

    const cleanup = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.style.display = 'none', 300);
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
      const addr = addressIn.value.trim();
      const zip = zipIn.value.trim();
      const city = cityIn.value.trim();

      if (!addr || !zip || !city) {
        showToast('Wypełnij wszystkie pola adresu!', 'error');
        return;
      }
      cleanup();
      resolve({ address: addr, postalCode: zip, city: city });
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

function openPaymentModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('paymentModal');
    const input = document.getElementById('blikInput');
    const confirmBtn = document.getElementById('paymentConfirmBtn');
    const cancelBtn = document.getElementById('paymentCancelBtn');

    input.value = '';

    // Zabezpieczenie: tylko cyfry
    input.oninput = function () {
      this.value = this.value.replace(/[^0-9]/g, '');
    };


    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      input.focus();
    }, 10);

    const cleanup = () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.style.display = 'none', 300);
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      input.oninput = null; // Usuwamy nasłuchiwanie
    };

    confirmBtn.onclick = () => {
      const code = input.value.trim();
      if (code.length < 6) {
        showToast('Kod BLIK musi mieć 6 znaków!', 'error');
        return;
      }
      cleanup();
      resolve(code);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

// --- CHECKOUT ---
async function checkout() {
  let user = await refreshUserData();

  // 1. Adres
  if (!user || !user.address || !user.city || !user.postal_code) {
    const wantToFill = await showConfirm("Brak danych do wysyłki", "Aby złożyć zamówienie, musisz podać adres. Czy chcesz to zrobić teraz?");
    if (!wantToFill) return;

    const addressData = await openAddressModal(user);
    if (!addressData) return;

    try {
      // Wymagany fetchWithAuth dla PUT
      await fetchWithAuth('/api/user/address', {
        method: 'PUT',
        body: JSON.stringify(addressData)
      });
      showToast("Adres zapisany w profilu!", "success");
    } catch (e) {
      showToast("Nie udało się zapisać adresu: " + e.message, "error");
      return;
    }
  }

  // 2. Potwierdzenie
  const confirmed = await showConfirm("Finalizacja", "Czy na pewno chcesz złożyć zamówienie z obowiązkiem zapłaty?");
  if (!confirmed) return;

  try {
    // Wymagany fetchWithAuth dla POST
    const data = await fetchWithAuth('/api/cart/checkout', { method: 'POST' });
    showToast("✅ " + data.message, 'success');
    loadCart();
    loadPurchases();
  } catch (e) {
    showToast("Błąd zamówienia: " + e.message, 'error');
  }
}

// --- PŁATNOŚĆ GRUPOWA ---
window.payForOrderGroup = async (dateString) => {
  const blikCode = await openPaymentModal();
  if (!blikCode) {
    showToast("Płatność anulowana.", "info");
    return;
  }

  const btn = event.target;
  let originalText = '';
  if (btn) {
    originalText = btn.textContent;
    btn.textContent = "Przetwarzanie...";
    btn.disabled = true;
  }

  try {
    // Wymagany fetchWithAuth dla POST na nowym endpoincie
    await fetchWithAuth(`/api/purchases/pay-order`, {
      method: 'POST',
      body: JSON.stringify({ purchaseDate: dateString })
    });

    showToast("Sukces! Całe zamówienie opłacone.", 'success');
    loadPurchases();
  } catch (e) {
    showToast("Błąd płatności: " + e.message, 'error');
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
};

init();