let currentUser = null;

async function init() {
  await setupAuth();
  await loadPurchases();
}

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
      if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
        document.getElementById('moderatorLink').style.display = 'block';
      }
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
    } else window.location.href = '/';
  } catch (error) { window.location.href = '/'; }
}

async function loadPurchases() {
  const list = document.getElementById('purchasesList');
  list.innerHTML = '<div class="loading">Ładowanie zamówień...</div>';
  
  try {
    const res = await fetch('/api/user/purchases');
    const purchases = await res.json();
    
    if (purchases.length === 0) {
      list.innerHTML = '<div class="empty-state">Nie masz jeszcze żadnych zamówień.</div>';
      return;
    }
    
    list.innerHTML = purchases.map(p => `
      <div class="my-post-item" style="border: 1px solid var(--border-color); padding: 20px; margin-bottom: 15px; border-radius: 8px; background: rgba(255,255,255,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="color: #FFD700; margin: 0 0 5px 0;">${p.player_name}</h3>
                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.7);">Klub: ${p.team}</p>
            </div>
            <div style="text-align:right;">
                <div style="font-size: 18px; font-weight: bold; color: #fff;">${p.jersey_price} zł</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.5);">${new Date(p.purchase_date).toLocaleDateString()}</div>
            </div>
        </div>
        
        <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display:flex; justify-content:space-between; align-items:center;">
            <div class="post-status ${p.status}">
                Status: <strong>${p.status === 'completed' ? '✅ Opłacone' : '⏳ Oczekuje na płatność'}</strong>
            </div>
            
            ${p.status === 'pending' ? `
                <button class="btn btn-success btn-sm" onclick="payForOrder(${p.id})" style="background: #28a745; color: white; border: none; padding: 8px 16px; cursor: pointer;">
                    💳 Zapłać (Sandbox)
                </button>
            ` : ''}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    list.innerHTML = '<div class="error-state">Błąd ładowania historii.</div>';
  }
}

window.payForOrder = async (id) => {
    if(!confirm("Symulacja płatności: Czy chcesz opłacić to zamówienie?")) return;
    
    try {
        const res = await fetch(`/api/purchases/${id}/pay`, { method: 'POST' });
        if(res.ok) {
            alert("Płatność przyjęta! Status zamówienia zaktualizowany.");
            loadPurchases();
        } else {
            alert("Błąd płatności");
        }
    } catch(e) {
        alert("Błąd połączenia");
    }
};

init();