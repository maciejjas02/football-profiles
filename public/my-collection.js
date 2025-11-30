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
  } catch (e) { console.error("Błąd pobierania usera:", e); }
  return null;
}

async function init() {
  console.log("Inicjalizacja my-collection...");
  await setupAuth();
  await loadCart();
  await loadPurchases();

  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    const newBtn = checkoutBtn.cloneNode(true);
    checkoutBtn.parentNode.replaceChild(newBtn, checkoutBtn);

    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      checkout();
    });
  }

  const editAddressBtn = document.getElementById('editAddressBtn');
  if (editAddressBtn) {
    editAddressBtn.addEventListener('click', async () => {
      let user = await refreshUserData();
      if (!user) return showToast("Musisz być zalogowany", "error");

      const addressData = await openAddressModal(user);
      if (!addressData) return;

      try {
        await fetchWithAuth('/api/user/address', {
          method: 'PUT',
          body: JSON.stringify(addressData)
        });
        showToast("Adres został zaktualizowany!", "success");
      } catch (e) {
        showToast("Nie udało się zapisać adresu: " + e.message, "error");
      }
    });
  }

  if (currentUser) {
    await loadNotifications();
  }
}

// --- LOGIKA ZAMÓWIENIA ---
async function checkout() {
  const btn = document.getElementById('checkoutBtn');
  console.log("Rozpoczynam procedurę checkout...");

  let user = await refreshUserData();
  if (!user) {
    showToast("Błąd sesji. Zaloguj się ponownie.", "error");
    return;
  }

  if (!user.address || !user.city || !user.postal_code) {
    console.log("Brak adresu, otwieram modal...");
    const wantToFill = await showConfirm("Brak adresu", "Aby zamówić, musisz uzupełnić adres dostawy. Czy chcesz to zrobić teraz?");
    if (!wantToFill) return;

    const addressData = await openAddressModal(user);
    if (!addressData) return;

    try {
      await fetchWithAuth('/api/user/address', { method: 'PUT', body: JSON.stringify(addressData) });
      user = await refreshUserData();
      showToast("Adres zapisany!", "success");
    } catch (e) {
      return showToast("Błąd zapisu adresu: " + e.message, "error");
    }
  }

  const confirmed = await showConfirm("Potwierdzenie", "Czy na pewno chcesz złożyć zamówienie z obowiązkiem zapłaty?");
  if (!confirmed) {
    console.log("Anulowano checkout.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Przetwarzanie...";

  try {
    // 3. Wysłanie zamówienia do API (+0.5 Email)
    console.log("Wysyłam request do API...");
    const data = await fetchWithAuth('/api/cart/checkout', { method: 'POST' });

    showToast("✅ Zamówienie złożone! Sprawdź e-mail.", 'success');

    await loadCart();
    await loadPurchases();

    setTimeout(async () => {
      if (await showConfirm("Płatność", "Czy chcesz opłacić zamówienie teraz (Sandbox BLIK)?")) {
        const purchases = await fetchWithAuth('/api/user/purchases');
        if (purchases.length > 0) {
          purchases.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
          const latestDate = purchases[0].purchase_date;
          await window.payForOrderGroup(latestDate);
        }
      }
    }, 500);

  } catch (e) {
    console.error(e);
    showToast("Błąd zamówienia: " + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = "Złóż zamówienie (Checkout)";
  }
}

// --- MODALE ---
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
    modal.style.display = 'flex'; setTimeout(() => modal.style.opacity = '1', 10);

    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    const close = (val) => {
      modal.style.opacity = '0';
      setTimeout(() => modal.style.display = 'none', 300);
      resolve(val);
    };

    newConfirm.onclick = () => {
      if (!addressIn.value || !zipIn.value || !cityIn.value) return showToast('Wypełnij wszystkie pola!', 'error');
      close({ address: addressIn.value, postalCode: zipIn.value, city: cityIn.value });
    };
    newCancel.onclick = () => close(null);
  });
}

function openPaymentModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('paymentModal');
    const input = document.getElementById('blikInput');
    const confirmBtn = document.getElementById('paymentConfirmBtn');
    const cancelBtn = document.getElementById('paymentCancelBtn');

    input.value = '';
    input.oninput = function () { this.value = this.value.replace(/[^0-9]/g, ''); };

    modal.style.display = 'flex'; setTimeout(() => { modal.style.opacity = '1'; input.focus(); }, 10);

    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    const close = (val) => {
      modal.style.opacity = '0'; setTimeout(() => modal.style.display = 'none', 300);
      resolve(val);
    };
    newConfirm.onclick = () => { if (input.value.length < 6) return showToast('Kod BLIK: 6 cyfr', 'error'); close(input.value); };
    newCancel.onclick = () => close(null);
  });
}

// --- PŁATNOŚĆ (SANDBOX) ---
window.payForOrderGroup = async (dateString) => {
  const code = await openPaymentModal();
  if (!code) return showToast("Płatność anulowana", "info");

  try {
    await fetchWithAuth(`/api/purchases/pay-order`, {
      method: 'POST',
      body: JSON.stringify({ purchaseDate: dateString })
    });
    showToast("Sukces! Zamówienie opłacone.", 'success');
    loadPurchases();
  } catch (e) { showToast(e.message, 'error'); }
};

// --- FUNKCJE POMOCNICZE (LOADERS, AUTH) ---
async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

      if (['admin', 'moderator'].includes(currentUser.role)) {
        document.getElementById('ordersLink')?.style.setProperty('display', 'block');
        document.getElementById('moderatorLink')?.style.setProperty('display', 'block');
      }
      if (currentUser.role === 'admin') {
        document.getElementById('adminLink')?.style.setProperty('display', 'block');
        document.getElementById('galleryManageLink')?.style.setProperty('display', 'block');
      }
      document.getElementById('logoutBtn').onclick = async () => {
        await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      };
    } else { window.location.href = '/'; }
  } catch (error) { window.location.href = '/'; }
}

async function loadCart() {
  const list = document.getElementById('cartList');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const totalEl = document.getElementById('cartTotal');
  const amountEl = document.getElementById('totalAmount');

  try {
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
      const img = item.jersey_image_url || item.player_image || '/images/logo.png';
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
            </div>`;
    }).join('');

    amountEl.textContent = total;
    checkoutBtn.style.display = '';
    totalEl.style.display = 'block';
  } catch (e) { list.innerHTML = '<div class="error-state">Błąd koszyka</div>'; }
}

window.removeFromCart = async (id) => {
  if (!await showConfirm("Usuwanie", "Usunąć produkt z koszyka?")) return;
  try {
    await fetchWithAuth(`/api/cart/${id}`, { method: 'DELETE' });
    loadCart();
  } catch (e) { showToast("Błąd usuwania", 'error'); }
};

async function loadPurchases() {
  const list = document.getElementById('purchasesList');
  try {
    const purchases = await fetchWithAuth('/api/user/purchases');
    if (purchases.length === 0) {
      list.innerHTML = `<div class="empty-state" style="width:100%; text-align:center;"><p>Brak historii zakupów.</p></div>`;
      return;
    }
    const orders = {};
    purchases.forEach(p => {
      const dateKey = p.purchase_date;
      if (!orders[dateKey]) orders[dateKey] = { date: p.purchase_date, status: p.status, items: [], total: 0 };
      orders[dateKey].items.push(p);
      orders[dateKey].total += p.jersey_price;
    });
    const sortedDates = Object.keys(orders).sort((a, b) => new Date(b) - new Date(a));

    list.innerHTML = sortedDates.map(dateKey => {
      const order = orders[dateKey];
      const status = order.status;
      let badgeClass = 'status-badge';
      let statusText = status;
      let actionHtml = '';

      if (status === 'pending') {
        badgeClass += ' status-pending'; statusText = '⏳ Oczekuje';
        actionHtml = `<button class="pay-btn" onclick="window.payForOrderGroup('${order.date}')">💳 Zapłać (BLIK Sandbox)</button>`;
      } else if (status === 'completed') {
        badgeClass += ' status-completed'; statusText = '✅ Opłacone';
        actionHtml = '<div style="color:var(--success-color); font-size:13px; margin-top:10px;">Zamówienie opłacone. Oczekiwanie na wysyłkę.</div>';
      } else if (status === 'shipped') {
        statusText = '📦 Wysłane';
        actionHtml = '<div style="color:var(--primary-color); font-size:13px; margin-top:10px;">Wysłano kurierem.</div>';
      } else if (status === 'cancelled') {
        statusText = '❌ Anulowane';
        actionHtml = '<div style="color:var(--danger-color); font-size:13px; margin-top:10px;">Zamówienie anulowane.</div>';
      }

      return `
            <div class="jersey-card-item" style="width: 100%; max-width: 600px; flex-direction: row; min-height: auto;">
                <div style="padding: 20px; flex: 1; border-right: 1px solid var(--glass-border);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="color:var(--text-color); opacity:0.6; font-size:12px;">${new Date(order.date).toLocaleString()}</span>
                        <span class="${badgeClass}">${statusText}</span>
                    </div>
                    <div class="jersey-title" style="font-size:18px;">Zamówienie (${order.items.length} poz.)</div>
                    <div class="jersey-price" style="font-size:22px; margin: 10px 0;">Suma: ${order.total} zł</div>
                    ${actionHtml}
                </div>
                <div style="padding: 20px; width: 200px; background: rgba(0,0,0,0.2); overflow-y: auto; max-height: 250px;">
                     ${order.items.map(i => `<div style="font-size:12px; margin-bottom:5px;">${i.player_name} (${i.jersey_price} zł)</div>`).join('')}
                </div>
            </div>`;
    }).join('');
    list.style.flexDirection = 'column';
    list.style.alignItems = 'center';
  } catch (e) { list.innerHTML = 'Błąd historii.'; }
}

// --- NOTIFICATIONS ---
async function loadNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationsList');
  if (!btn) return;
  try {
    const notifications = await fetchWithAuth('/api/user/notifications');
    const unreadCount = notifications.filter(n => n.is_read === 0).length;
    if (unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = 'block'; }
    else { badge.style.display = 'none'; }
    btn.style.display = 'block';
    if (notifications.length === 0) list.innerHTML = '<div class="notification-empty">Brak powiadomień.</div>';
    else {
      list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read === 0 ? 'unread' : ''}" onclick="window.handleNotificationClick(${n.id}, '${n.link || '#'}', ${n.is_read})">
            <div class="notification-title">${n.title}</div><div class="notification-message">${n.message}</div>
        </div>`).join('');
    }
    btn.onclick = (e) => { e.stopPropagation(); document.getElementById('notificationsDropdown').style.display = 'block'; };
    document.addEventListener('click', () => document.getElementById('notificationsDropdown').style.display = 'none');
    document.getElementById('markAllReadBtn').onclick = async () => {
      await fetchWithAuth('/api/user/notifications/read-all', { method: 'POST' }); loadNotifications();
    };
  } catch (e) { }
}
window.handleNotificationClick = async (id, link, isRead) => {
  if (isRead === 0) await fetchWithAuth(`/api/user/notifications/${id}/read`, { method: 'POST' });
  if (link && link !== '#') window.location.href = link; else loadNotifications();
};

init();