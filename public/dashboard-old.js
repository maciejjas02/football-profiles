(async () => {
let csrfToken = null;
try {
  const r = await fetch('/api/auth/csrf-token', { credentials: 'include' });
  const j = await r.json();
  csrfToken = j.csrfToken;
} catch {}

console.log('Dashboard JS loaded!');

const who = document.getElementById('who');
const userData = document.getElementById('userData');
const logoutBtn = document.getElementById('logoutBtn');
const playersSection = document.getElementById('players-section');
const playersGrid = document.getElementById('players-grid');
const backBtn = document.getElementById('back-btn');
const sectionTitle = document.getElementById('section-title');
const collectionCount = document.getElementById('collection-count');
const userName = document.getElementById('user-name');
const userPurchases = document.getElementById('user-purchases');
const userRole = document.getElementById('user-role');

console.log('Main panels element:', document.querySelector('.main-panels'));
console.log('Players section element:', playersSection);

// NATYCHMIASTOWY TEST - dodaj inline style żeby zobaczyć panele
const mainPanels = document.querySelector('.main-panels');
if (mainPanels) {
  console.log('Found main panels, panels are working!');
  // Usuń czerwone tło testowe
  mainPanels.style.background = ''; 
} else {
  console.log('MAIN PANELS NOT FOUND!!!');
}
  
  // Sprawdź czy players-section nie zasłania
  if (playersSection) {
    console.log('Players section display:', window.getComputedStyle(playersSection).display);
    console.log('Players section classes:', playersSection.className);
    // Ukryj players-section na wszelki wypadek
    playersSection.style.display = 'none';
  }
} else {
  console.log('MAIN PANELS NOT FOUND!!!');
}

// Dane zawodników według kategorii
const playersData = {
  'top-players': [
    { id: 'lionel-messi', name: 'Lionel Messi', team: 'Inter Miami CF', position: 'Napastnik' },
    { id: 'cristiano-ronaldo', name: 'Cristiano Ronaldo', team: 'Al Nassr FC', position: 'Napastnik' },
    { id: 'kylian-mbappe', name: 'Kylian Mbappé', team: 'Real Madrid', position: 'Napastnik' },
    { id: 'erling-haaland', name: 'Erling Haaland', team: 'Manchester City', position: 'Napastnik' },
    { id: 'robert-lewandowski', name: 'Robert Lewandowski', team: 'FC Barcelona', position: 'Napastnik' },
    { id: 'ousmane-dembele', name: 'Ousmane Dembélé', team: 'Paris Saint-Germain', position: 'Skrzydłowy' }
  ],
  'leagues': [
    { id: 'pedri', name: 'Pedri', team: 'FC Barcelona', position: 'Pomocnik', stats: ['⚽ Młody talent', '🏆 La Liga'], price: 199 },
    { id: 'jamal-musiala', name: 'Jamal Musiala', team: 'Bayern Munich', position: 'Pomocnik', stats: ['🎨 Kreatywność', '🏆 Bundesliga'], price: 189 },
    { id: 'federico-chiesa', name: 'Federico Chiesa', team: 'Liverpool', position: 'Skrzydłowy', stats: ['⚡ Szybkość', '🏆 Serie A'], price: 179 },
    { id: 'khvicha-kvaratskhelia', name: 'Khvicha Kvaratskhelia', team: 'SSC Napoli', position: 'Napastnik', stats: ['🎨 Kreatywność', '🏆 Serie A'], price: 169 }
  ],
  'new-talents': [
    { id: 'jude-bellingham', name: 'Jude Bellingham', team: 'Real Madrid', position: 'Pomocnik', stats: ['⭐ 21 lat', '🏆 Złoty Chłopak'], price: 209 },
    { id: 'gavi', name: 'Gavi', team: 'FC Barcelona', position: 'Pomocnik', stats: ['⭐ 20 lat', '🎯 Przyszłość'], price: 189 },
    { id: 'florian-wirtz', name: 'Florian Wirtz', team: 'Bayer Leverkusen', position: 'Napastnik', stats: ['⭐ 21 lat', '🚀 Niemiecki talent'], price: 169 },
    { id: 'eduardo-camavinga', name: 'Eduardo Camavinga', team: 'Real Madrid', position: 'Pomocnik', stats: ['⭐ 22 lata', '🌟 Francuski talent'], price: 159 }
  ],
  'goalkeepers': [
    { id: 'thibaut-courtois', name: 'Thibaut Courtois', team: 'Real Madrid', position: 'Bramkarz', stats: ['🥅 Reflexy', '🏆 Mistrz świata'], price: 149 },
    { id: 'alisson', name: 'Alisson', team: 'Liverpool', position: 'Bramkarz', stats: ['🥅 Pewność', '🏆 Premier League'], price: 139 },
    { id: 'manuel-neuer', name: 'Manuel Neuer', team: 'Bayern Munich', position: 'Bramkarz', stats: ['🥅 Legenda', '🏆 Mistrz świata'], price: 159 },
    { id: 'gianluigi-donnarumma', name: 'Gianluigi Donnarumma', team: 'PSG', position: 'Bramkarz', stats: ['🥅 Młody mistrz', '🏆 Euro 2021'], price: 129 }
  ],
  'legends': [
    { id: 'pele', name: 'Pelé', team: 'Santos (Legenda)', position: 'Napastnik', stats: ['👑 Król futbolu', '🏆 3x Mistrz świata'], price: 399 },
    { id: 'diego-maradona', name: 'Diego Maradona', team: 'Napoli (Legenda)', position: 'Napastnik', stats: ['👑 Boska lewa', '🏆 Mistrz świata'], price: 389 },
    { id: 'johan-cruyff', name: 'Johan Cruyff', team: 'Ajax (Legenda)', position: 'Napastnik', stats: ['👑 Total Football', '🏆 3x Złota Piłka'], price: 379 },
    { id: 'david-beckham', name: 'David Beckham', team: 'Man United (Legenda)', position: 'Pomocnik', stats: ['👑 Rzuty wolne', '🏆 6x Premier League'], price: 289 }
  ]
};

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

// Funkcja do aktualizacji liczby zakupów
function updatePurchaseCount() {
  const savedPurchases = localStorage.getItem('userPurchases');
  let purchases = [];
  
  if (savedPurchases) {
    try {
      purchases = JSON.parse(savedPurchases);
    } catch (e) {
      purchases = [];
    }
  }
  
  if (collectionCount) {
    collectionCount.textContent = `${purchases.length} koszulek`;
  }
  if (userPurchases) {
    userPurchases.textContent = `${purchases.length} zakupów`;
  }
}

// Funkcja do pokazywania sekcji lig
function showLeaguesSection() {
  // Ukryj sekcję zawodników
  playersSection.style.display = 'none';
  // Ukryj główne panele
  document.querySelector('.main-panels').style.display = 'none';
  // Pokaż sekcję lig
  const leaguesSection = document.getElementById('leagues-section');
  leaguesSection.classList.remove('hidden');
  leaguesSection.style.display = 'block';
  
  // Przewiń do sekcji lig
  leaguesSection.scrollIntoView({ 
    behavior: 'smooth' 
  });
}

// Funkcja do wyświetlania zawodników (uniwersalna)
function displayPlayers(players) {
  playersGrid.innerHTML = '';
  
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    const playerAvatar = document.createElement('div');
    playerAvatar.className = 'player-avatar';
    
    const playerImg = document.createElement('img');
    playerImg.alt = player.name;
    playerImg.src = `https://via.placeholder.com/80x80/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}`;
    
    playerAvatar.appendChild(playerImg);
    
    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';
    playerInfo.innerHTML = `
      <h3 class="player-name">${player.name}</h3>
      <p class="team">${player.team}</p>
      <p class="position">${player.position}</p>
      <button class="btn btn-primary">Zobacz Profil</button>
    `;
    
    playerCard.appendChild(playerAvatar);
    playerCard.appendChild(playerInfo);
    
    playerCard.addEventListener('click', () => {
      window.location.href = `/player.html?id=${player.id}`;
    });
    
    playersGrid.appendChild(playerCard);
  });
}

// Funkcja do wyświetlania zawodników
async function showPlayers(category, title) {
  console.log('showPlayers called with:', category, title);
  
  try {
    // Pobierz zawodników z API
    const response = await fetch(`/api/players/category/${category}`);
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const players = await response.json();
    console.log('Players from API:', players);
    
    sectionTitle.textContent = title;
    playersGrid.innerHTML = '';
    
    players.forEach(player => {
      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';
      
      const playerAvatar = document.createElement('div');
      playerAvatar.className = 'player-avatar';
      
      const playerImg = document.createElement('img');
      playerImg.alt = player.name;
      // Używaj imageUrl z bazy danych (prawdziwe zdjęcia z Wikipedii)
      playerImg.src = player.imageUrl || `https://via.placeholder.com/80x80/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}`;
      
      // Dodaj fallback bez inline handler
      playerImg.addEventListener('error', () => {
        playerImg.src = `https://via.placeholder.com/80x80/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}`;
      });
      
      playerAvatar.appendChild(playerImg);
      
      const playerInfo = document.createElement('div');
      playerInfo.className = 'player-info';
      playerInfo.innerHTML = `
        <h3>${player.name}</h3>
        <p class="team">${player.team}</p>
        <p class="position">${player.position}</p>
        <button class="btn btn-primary">Zobacz Profil</button>
      `;
      
      playerCard.appendChild(playerAvatar);
      playerCard.appendChild(playerInfo);
      
      playerCard.addEventListener('click', () => {
        window.location.href = `/player.html?id=${player.id}`;
      });
      
      playersGrid.appendChild(playerCard);
    });
    
    // Ukryj główne panele i sekcję lig, pokaż zawodników
    document.querySelector('.main-panels').style.display = 'none';
    document.getElementById('leagues-section').style.display = 'none';
    playersSection.style.display = 'block';
  } catch (error) {
    console.error('Błąd podczas ładowania zawodników:', error);
    // Fallback - użyj statycznych danych
    showPlayersStatic(category, title);
  }
}

// Funkcja fallback ze statycznymi danymi
function showPlayersStatic(category, title) {
  console.log('showPlayersStatic called with:', category, title);
  
  const players = playersData[category] || [];
  console.log('Static players data:', players);
  
  sectionTitle.textContent = title;
  playersGrid.innerHTML = '';
  
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    const playerAvatar = document.createElement('div');
    playerAvatar.className = 'player-avatar';
    
    const playerImg = document.createElement('img');
    playerImg.alt = player.name;
    playerImg.src = `https://via.placeholder.com/80x80/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}`;
    
    // Dodaj fallback bez inline handler
    playerImg.addEventListener('error', () => {
      playerImg.src = 'https://via.placeholder.com/80x80/333/fff?text=?';
    });
    
    playerAvatar.appendChild(playerImg);
    
    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';
    playerInfo.innerHTML = `
      <h3>${player.name}</h3>
      <p class="team">${player.team}</p>
      <p class="position">${player.position}</p>
      <button class="btn btn-primary">Zobacz Profil</button>
    `;
    
    playerCard.appendChild(playerAvatar);
    playerCard.appendChild(playerInfo);
    
    playerCard.addEventListener('click', () => {
      window.location.href = `/player.html?id=${player.id}`;
    });
    
    playersGrid.appendChild(playerCard);
  });
  
  console.log('Cards created, showing players section');
  
  // Ukryj główne panele i sekcję lig, pokaż zawodników
  document.querySelector('.main-panels').style.display = 'none';
  document.getElementById('leagues-section').style.display = 'none';
  playersSection.style.display = 'block';
  playersSection.classList.remove('hidden');
}


// Funkcja do ukrywania sekcji zawodników
function hidePlayers() {
  playersSection.style.display = 'none';
  document.querySelector('.main-panels').style.display = 'grid';
  document.getElementById('leagues-section').style.display = 'block';
}

// Funkcja do symulacji zakupu koszulki
function purchaseJersey(playerName, teamName, price) {
  const purchase = {
    player: playerName,
    team: teamName,
    date: new Date().toLocaleDateString('pl-PL'),
    price: price + ' zł'
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
  
  showBanner(`🎉 Zakupiono koszulkę ${playerName}!`, true);
  updatePurchaseCount();
}

// Funkcja do wyświetlania kolekcji
function showMyCollection() {
  const savedPurchases = localStorage.getItem('userPurchases');
  let purchases = [];
  
  if (savedPurchases) {
    try {
      purchases = JSON.parse(savedPurchases);
    } catch (e) {
      purchases = [];
    }
  }
  
  sectionTitle.textContent = 'Moja Kolekcja';
  playersGrid.innerHTML = '';
  
  if (purchases.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-collection-message';
    emptyMessage.textContent = 'Nie masz jeszcze żadnych koszulek. Kup swoją pierwszą!';
    playersGrid.appendChild(emptyMessage);
  } else {
    purchases.forEach(purchase => {
      const purchaseCard = document.createElement('div');
      purchaseCard.className = 'player-card';
      
      const playerAvatar = document.createElement('div');
      playerAvatar.className = 'player-avatar';
      
      const playerImg = document.createElement('img');
      playerImg.alt = purchase.player;
      playerImg.src = `https://via.placeholder.com/80x80/333/fff?text=${purchase.player.split(' ').map(n => n[0]).join('')}`;
      
      // Dodaj fallback bez inline handler
      playerImg.addEventListener('error', () => {
        playerImg.src = `https://via.placeholder.com/80x80/333/fff?text=${purchase.player.split(' ').map(n => n[0]).join('')}`;
      });
      
      playerAvatar.appendChild(playerImg);
      
      const playerInfo = document.createElement('div');
      playerInfo.className = 'player-info';
      playerInfo.innerHTML = `
        <h3>${purchase.player}</h3>
        <p class="team">${purchase.team}</p>
        <p class="position">Zakupiono: ${purchase.date}</p>
        <div class="stats">
          <span class="stat">💰 ${purchase.price}</span>
          <span class="stat">✅ W kolekcji</span>
        </div>
      `;
      
      purchaseCard.appendChild(playerAvatar);
      purchaseCard.appendChild(playerInfo);
      playersGrid.appendChild(purchaseCard);
    });
  }
  
  playersSection.classList.remove('hidden');
}

// Ochrona strony: jeśli nie zalogowany, wróć do /
(async () => {
  // Wyczyść stare dane localStorage które mogą mieć stare obrazki
  try {
    console.log('Clearing ALL localStorage...');
    localStorage.clear(); // Wyczyść wszystko
    sessionStorage.clear(); // I sessionStorage też
  } catch (e) {}
  
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('not auth');
    const { user, via } = await res.json();
    
    const displayName = user.display_name || user.username || user.email || 'Użytkownik';
    who.textContent = `${displayName}`;
    
    if (userName) userName.textContent = displayName;
    if (userRole) userRole.textContent = user.role || 'Użytkownik';
    
    updatePurchaseCount();
    
  } catch {
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

// Obsługa powrotu
backBtn?.addEventListener('click', hidePlayers);

// Obsługa powrotu z sekcji lig
document.getElementById('leagues-back-btn')?.addEventListener('click', () => {
  const leaguesSection = document.getElementById('leagues-section');
  leaguesSection.classList.add('hidden');
  leaguesSection.style.display = 'none';
  document.querySelector('.main-panels').style.display = 'grid';
});

// Obsługa kliknięć na panele główne
document.addEventListener('click', (e) => {
  const panelCard = e.target.closest('.panel-card');
  if (panelCard) {
    const action = panelCard.dataset.action;
    console.log('Panel clicked:', action);
    
    switch (action) {
      case 'top-players':
        console.log('🌟 GWIAZDY FUTBOLU CLICKED! 🌟');
        alert('Panel Gwiazdy Futbolu został kliknięty!'); // Test
        showPlayers('top-players', '⭐ Gwiazdy Futbolu');
        break;
      case 'leagues':
        showLeaguesSection();
        break;
      case 'new-talents':
        showPlayers('new-talents', '🚀 Młode Talenty');
        break;
      case 'goalkeepers':
        showPlayers('goalkeepers', '🥅 Bramkarze');
        break;
      case 'legends':
        showPlayers('legends', '👑 Legendy Futbolu');
        break;
      case 'my-collection':
        showMyCollection();
        break;
      default:
        showBanner(`Panel: ${action}`, true);
    }
  }
});

// Dane zawodników według lig
const leaguePlayersData = {
  'premier-league': [
    { id: 'erling-haaland', name: 'Erling Haaland', team: 'Manchester City', position: 'Napastnik' },
    { id: 'kevin-de-bruyne', name: 'Kevin De Bruyne', team: 'SSC Napoli', position: 'Pomocnik' },
    { id: 'alisson', name: 'Alisson', team: 'Liverpool', position: 'Bramkarz' },
    { id: 'federico-chiesa', name: 'Federico Chiesa', team: 'Liverpool', position: 'Skrzydłowy' }
  ],
  'la-liga': [
    { id: 'kylian-mbappe', name: 'Kylian Mbappé', team: 'Real Madrid', position: 'Napastnik' },
    { id: 'robert-lewandowski', name: 'Robert Lewandowski', team: 'FC Barcelona', position: 'Napastnik' },
    { id: 'jude-bellingham', name: 'Jude Bellingham', team: 'Real Madrid', position: 'Pomocnik' },
    { id: 'pedri', name: 'Pedri', team: 'FC Barcelona', position: 'Pomocnik' },
    { id: 'gavi', name: 'Gavi', team: 'FC Barcelona', position: 'Pomocnik' },
    { id: 'thibaut-courtois', name: 'Thibaut Courtois', team: 'Real Madrid', position: 'Bramkarz' },
    { id: 'eduardo-camavinga', name: 'Eduardo Camavinga', team: 'Real Madrid', position: 'Pomocnik' }
  ],
  'bundesliga': [
    { id: 'jamal-musiala', name: 'Jamal Musiala', team: 'Bayern Munich', position: 'Pomocnik' },
    { id: 'florian-wirtz', name: 'Florian Wirtz', team: 'Bayer Leverkusen', position: 'Napastnik' },
    { id: 'manuel-neuer', name: 'Manuel Neuer', team: 'Bayern Munich', position: 'Bramkarz' }
  ],
  'serie-a': [
    { id: 'gianluigi-donnarumma', name: 'Gianluigi Donnarumma', team: 'PSG', position: 'Bramkarz' }
  ],
  'ligue-1': [
    { id: 'ousmane-dembele', name: 'Ousmane Dembélé', team: 'Paris Saint-Germain', position: 'Skrzydłowy' },
    { id: 'gianluigi-donnarumma', name: 'Gianluigi Donnarumma', team: 'PSG', position: 'Bramkarz' }
  ]
};

// Obsługa kliknięć na karty lig
document.addEventListener('click', (e) => {
  const leagueCard = e.target.closest('.league-card');
  if (leagueCard) {
    const leagueId = leagueCard.dataset.league;
    const leagueName = leagueCard.querySelector('h3').textContent;
    
    // Ukryj główne panele i pokaż zawodników ligi
    document.querySelector('.main-panels').style.display = 'none';
    document.getElementById('leagues-section').style.display = 'none';
    playersSection.style.display = 'block';
    
    // Ustaw tytuł
    sectionTitle.textContent = leagueName;
    
    // Pokaż zawodników z danej ligi
    const leaguePlayers = leaguePlayersData[leagueId] || [];
    displayPlayers(leaguePlayers);
  }
});

// Debug: sprawdź czy panele są widoczne na końcu
console.log('End of dashboard.js - checking panels visibility...');
setTimeout(() => {
  const mainPanels = document.querySelector('.main-panels');
  if (mainPanels) {
    console.log('Main panels display style:', window.getComputedStyle(mainPanels).display);
    console.log('Main panels visibility:', window.getComputedStyle(mainPanels).visibility);
    console.log('Number of panel cards:', mainPanels.querySelectorAll('.panel-card').length);
  } else {
    console.log('Main panels element not found!');
  }
}, 1000);

})(); // Zamknięcie async IIFE
