// 🚀 NOWY DASHBOARD.JS - HARD RESET! 🚀

console.log('🎉 Nowy Dashboard załadowany!');

// Podstawowe elementy DOM
const playersSection = document.getElementById('players-section');
const playersGrid = document.getElementById('players-grid');
const sectionTitle = document.getElementById('section-title');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logoutBtn');

// Dane zawodników - 6 gwiazd futbolu
const topPlayers = [
  { id: 'lionel-messi', name: 'Lionel Messi', team: 'Inter Miami CF', position: 'Napastnik' },
  { id: 'cristiano-ronaldo', name: 'Cristiano Ronaldo', team: 'Al Nassr FC', position: 'Napastnik' },
  { id: 'kylian-mbappe', name: 'Kylian Mbappé', team: 'Real Madrid', position: 'Napastnik' },
  { id: 'erling-haaland', name: 'Erling Haaland', team: 'Manchester City', position: 'Napastnik' },
  { id: 'robert-lewandowski', name: 'Robert Lewandowski', team: 'FC Barcelona', position: 'Napastnik' },
  { id: 'ousmane-dembele', name: 'Ousmane Dembélé', team: 'Paris Saint-Germain', position: 'Skrzydłowy' }
];

// Funkcja do wyświetlania zawodników
function showPlayers(players, title) {
  console.log('🌟 Pokazuję zawodników:', title);
  
  // Ustaw tytuł
  sectionTitle.textContent = title;
  
  // Wyczyść grid
  playersGrid.innerHTML = '';
  
  // Dodaj zawodników
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    // Używamy Kevin De Bruyne obrazek dla wszystkich (działa!)
    const playerImg = 'https://upload.wikimedia.org/wikipedia/commons/b/bf/De_Bruyne_%28cropped%29.jpg';
    
    playerCard.innerHTML = `
      <div class="player-avatar">
        <img src="${playerImg}" alt="${player.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
      </div>
      <div class="player-info">
        <h3>${player.name}</h3>
        <p class="team">${player.team}</p>
        <p class="position">${player.position}</p>
        <button class="btn btn-primary">Zobacz Profil</button>
      </div>
    `;
    
    playersGrid.appendChild(playerCard);
  });
  
  // Pokaż sekcję zawodników
  document.querySelector('.main-panels').style.display = 'none';
  playersSection.classList.remove('hidden');
  playersSection.style.display = 'block';
  
  console.log('✅ Wyświetlono', players.length, 'zawodników');
}

// Funkcja do ukrywania zawodników
function hidePlayers() {
  console.log('🔙 Ukrywam zawodników');
  playersSection.classList.add('hidden');
  playersSection.style.display = 'none';
  document.querySelector('.main-panels').style.display = 'grid';
}

// Event listener dla paneli
document.addEventListener('click', (e) => {
  const panelCard = e.target.closest('.panel-card');
  if (panelCard) {
    const action = panelCard.dataset.action;
    console.log('🎯 Kliknięto panel:', action);
    
    if (action === 'top-players') {
      console.log('⭐ GWIAZDY FUTBOLU!');
      showPlayers(topPlayers, '⭐ Gwiazdy Futbolu');
    } else if (action === 'my-collection') {
      console.log('💎 MOJA KOLEKCJA!');
      showPlayers([], '💎 Moja Kolekcja (Pusta)');
    } else {
      console.log('🚧 Panel w budowie:', action);
      alert(`Panel "${action}" jest w budowie!`);
    }
  }
});

// Event listener dla przycisku powrotu
if (backBtn) {
  backBtn.addEventListener('click', hidePlayers);
}

// Event listener dla wylogowania
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    console.log('👋 Wylogowanie');
    window.location.href = '/';
  });
}

// Sprawdź autoryzację
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('not auth');
    const data = await res.json();
    console.log('👤 Zalogowany jako:', data.user?.name || 'Admin');
    document.getElementById('who').textContent = data.user?.name || 'Admin';
  } catch (err) {
    console.log('❌ Nie zalogowany, przekierowanie...');
    window.location.href = '/';
  }
})();

console.log('🎯 Dashboard gotowy! Kliknij na "Gwiazdy Futbolu"!');