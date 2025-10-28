let csrfToken = null;
console.log('Loading player page...');

try {
  const r = await fetch('/api/auth/csrf-token', { credentials: 'include' });
  const j = await r.json();
  csrfToken = j.csrfToken;
  console.log('CSRF token loaded');
} catch (e) {
  console.log('CSRF token loading failed:', e);
}

const who = document.getElementById('who');
const logoutBtn = document.getElementById('logoutBtn');

// Player page elements
const loading = document.getElementById('loading');
const errorState = document.getElementById('error-state');
const playerContent = document.getElementById('player-content');
const buyJerseyBtn = document.getElementById('buy-jersey-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const errorDashboardBtn = document.getElementById('error-dashboard-btn');

// Funkcja do wyświetlania baneru
function showBanner(msg, ok = true) {
  const banner = document.getElementById('banner');
  if (!banner) return;
  banner.textContent = msg;
  banner.classList.toggle('banner--ok', ok);
  banner.classList.toggle('banner--err', !ok);
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 3000);
}

// Funkcja do pobierania ID piłkarza z URL
function getPlayerIdFromUrl() {
  // Pobierz z query string ?id=player-id
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Funkcja do ładowania danych piłkarza
async function loadPlayerData(playerId) {
  console.log('Loading player data for:', playerId);
  try {
    const response = await fetch(`/api/player/${playerId}`, {
      credentials: 'include'
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      throw new Error('Piłkarz nie znaleziony');
    }
    
    const playerData = await response.json();
    console.log('Player data loaded:', playerData);
    displayPlayerData(playerData);
    
  } catch (error) {
    console.error('Error loading player data:', error);
    showErrorState();
  }
}

// Funkcja do wyświetlania błędu
function showErrorState() {
  loading.classList.add('hidden');
  errorState.classList.remove('hidden');
  playerContent.classList.add('hidden');
}

// Funkcja do wyświetlania danych piłkarza
function displayPlayerData(player) {
  console.log('=== DISPLAYING PLAYER DATA ===');
  console.log('Full player object:', player);
  console.log('Player name:', player.name);
  console.log('Jersey price:', player.jerseyPrice);
  console.log('Jersey available:', player.jerseyAvailable);
  console.log('Jersey image URL:', player.jerseyImageUrl);
  console.log('Jersey image URL type:', typeof player.jerseyImageUrl);
  console.log('=== END PLAYER DATA ===');
  
  // Update page title
  document.title = `Football Profiles — ${player.name}`;
  
  // Update breadcrumbs
  document.getElementById('player-breadcrumb').textContent = player.name;
  
  // Update main info
  const playerImage = document.getElementById('player-image');
  playerImage.src = player.imageUrl;
  playerImage.alt = player.name;
  
  // Dodaj obsługę błędu ładowania zdjęcia
  playerImage.onerror = function() {
    console.log('Failed to load image:', player.imageUrl);
    // Użyj prostego placeholder z data URL
    this.src = 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#6366f1"/>
        <circle cx="100" cy="80" r="30" fill="white" opacity="0.8"/>
        <circle cx="100" cy="160" r="50" fill="white" opacity="0.8"/>
        <text x="100" y="190" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">Player</text>
      </svg>
    `);
    this.onerror = null; // Prevent infinite loop
  };
  
  console.log('Setting player image:', player.imageUrl);
  document.getElementById('player-name').textContent = player.fullName;
  document.getElementById('player-position').textContent = player.position;
  document.getElementById('player-team').textContent = player.team;
  
  // Update flags and logos
  document.getElementById('national-flag').src = player.nationalFlag;
  document.getElementById('national-flag').alt = `Flaga ${player.nationality}`;
  document.getElementById('team-logo').src = player.teamLogo;
  document.getElementById('team-logo').alt = `Logo ${player.team}`;
  
  // Update meta info
  document.getElementById('player-age').textContent = `${player.age} lat`;
  document.getElementById('player-height').textContent = player.height;
  document.getElementById('player-weight').textContent = player.weight;
  document.getElementById('player-value').textContent = player.marketValue;
  
  // Update jersey info
  document.getElementById('jersey-team').textContent = player.team;
  document.getElementById('jersey-price-amount').textContent = `${player.jerseyPrice} zł`;
  
  // Update jersey image
  const jerseyImage = document.getElementById('jersey-image');
  console.log('=== JERSEY IMAGE DEBUG ===');
  console.log('Player data:', player);
  console.log('Jersey image URL:', player.jerseyImageUrl);
  
  // Set jersey image
  if (player.jerseyImageUrl) {
    console.log('Setting real jersey image URL:', player.jerseyImageUrl);
    jerseyImage.src = player.jerseyImageUrl;
    jerseyImage.alt = `Koszulka ${player.name}`;
    
    jerseyImage.onerror = function() {
      console.log('Real jersey image failed to load:', player.jerseyImageUrl);
      // Only use SVG as last resort if real image fails
      const fallbackSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
          <path d="M35 25 L85 25 L90 30 L90 50 L95 55 L95 110 L25 110 L25 55 L30 50 L30 30 Z" 
                fill="#0066cc" stroke="#003" stroke-width="1"/>
          <ellipse cx="20" cy="45" rx="12" ry="20" fill="#0066cc" stroke="#003" stroke-width="1"/>
          <ellipse cx="100" cy="45" rx="12" ry="20" fill="#0066cc" stroke="#003" stroke-width="1"/>
          <path d="M45 25 L45 35 L60 35 L60 25" fill="white" stroke="#003" stroke-width="1"/>
          <circle cx="60" cy="55" r="15" fill="white" opacity="0.9"/>
          <text x="60" y="62" text-anchor="middle" fill="#0066cc" font-family="Arial Black" 
                font-size="20" font-weight="900">10</text>
          <text x="60" y="85" text-anchor="middle" fill="white" font-family="Arial" 
                font-size="8" font-weight="bold">SSC NAPOLI</text>
        </svg>
      `;
      this.src = 'data:image/svg+xml;base64,' + btoa(fallbackSVG);
      this.alt = 'Koszulka (fallback)';
    };
    
    jerseyImage.onload = function() {
      console.log('Real jersey image loaded successfully!');
    };
  } else {
    console.log('No jersey image URL provided');
    jerseyImage.alt = 'Brak koszulki';
  }
  
  console.log('=== END JERSEY DEBUG ===');
  
  // Update stats
  document.getElementById('stat-goals').textContent = player.stats.goals;
  document.getElementById('stat-assists').textContent = player.stats.assists;
  document.getElementById('stat-matches').textContent = player.stats.matches;
  document.getElementById('stat-trophies').textContent = player.stats.trophies;
  
  // Update achievements
  const achievementsList = document.getElementById('achievements-list');
  achievementsList.innerHTML = player.achievements.map(achievement => 
    `<div class="achievement-item">🏆 ${achievement}</div>`
  ).join('');
  
  // Update biography
  document.getElementById('player-biography').textContent = player.biography;
  
  // Show content
  loading.classList.add('hidden');
  playerContent.classList.remove('hidden');
  
  // Setup purchase button
  buyJerseyBtn.addEventListener('click', () => {
    purchaseJersey(player);
  });
}

// Funkcja do zakupu koszulki
function purchaseJersey(player) {
  const confirmed = confirm(`Czy chcesz kupić koszulkę ${player.name} za ${player.jerseyPrice} zł?`);
  
  if (confirmed) {
    const purchase = {
      player: player.name,
      team: player.team,
      date: new Date().toLocaleDateString('pl-PL'),
      price: player.jerseyPrice + ' zł'
    };
    
    // Zapisz w localStorage
    let purchases = [];
    const savedPurchases = localStorage.getItem('userPurchases');
    if (savedPurchases) {
      try {
        purchases = JSON.parse(savedPurchases);
      } catch (e) {
        purchases = [];
      }
    }
    
    purchases.unshift(purchase);
    purchases = purchases.slice(0, 10); // Zachowaj tylko 10 ostatnich
    
    localStorage.setItem('userPurchases', JSON.stringify(purchases));
    
    showBanner(`🎉 Zakupiono koszulkę ${player.name}!`, true);
    
    // Opcjonalnie: przekieruj do dashboard po chwili
    setTimeout(() => {
      if (confirm('Przejść do dashboard, aby zobaczyć zakup w kolekcji?')) {
        window.location.href = '/dashboard.html';
      }
    }, 2000);
  }
}

// Ochrona strony: jeśli nie zalogowany, wróć do /
(async () => {
  console.log('Checking authentication...');
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('not auth');
    const { user } = await res.json();
    
    const displayName = user.display_name || user.username || user.email || 'Użytkownik';
    who.textContent = displayName;
    console.log('User authenticated:', displayName);
    
    // Load player data
    const playerId = getPlayerIdFromUrl();
    console.log('Player ID from URL:', playerId);
    if (playerId) {
      await loadPlayerData(playerId);
    } else {
      console.error('No player ID in URL');
      showErrorState();
    }
    
  } catch (error) {
    console.error('Authentication failed:', error);
    window.location.href = '/';
  }
})();

// Wylogowanie
logoutBtn?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'CSRF-Token': csrfToken || '' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error();
    window.location.href = '/';
  } catch {
    alert('Błąd wylogowania');
  }
});

// Dashboard navigation
dashboardBtn?.addEventListener('click', () => {
  console.log('Dashboard button clicked');
  window.location.href = '/dashboard.html';
});

// Error dashboard navigation
errorDashboardBtn?.addEventListener('click', () => {
  console.log('Error dashboard button clicked');
  window.location.href = '/dashboard.html';
});

// Handle errors for missing images
document.addEventListener('DOMContentLoaded', () => {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('error', (e) => {
      if (e.target.classList.contains('flag-icon')) {
        e.target.src = 'https://via.placeholder.com/24x16/333/fff?text=FLAG';
      } else if (e.target.classList.contains('team-logo')) {
        e.target.src = 'https://via.placeholder.com/40x40/333/fff?text=TEAM';
      } else {
        // Używamy placeholder zamiast lokalnego obrazka
        const playerName = e.target.alt || 'Player';
        const initials = playerName.split(' ').map(n => n[0]).join('');
        e.target.src = `https://via.placeholder.com/80x80/333/fff?text=${initials}`;
      }
    });
  });
});