// 🚀 NOWY DASHBOARD.JS - HARD RESET! 🚀

console.log('🎉 Nowy Dashboard załadowany!');

// Podstawowe elementy DOM
const playersSection = document.getElementById('players-section');
const playersGrid = document.getElementById('players-grid');
const sectionTitle = document.getElementById('section-title');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logoutBtn');

// Funkcja do wyświetlania zawodników z API
async function showPlayers(category, title) {
  console.log('🌟 Pobieranie zawodników z API:', category, title);
  
  try {
    // Pobierz zawodników z bazy danych
    const response = await fetch(`/api/players/category/${category}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const players = await response.json();
    console.log('✅ Otrzymano zawodników z API:', players.length);
    
    // Ustaw tytuł
    sectionTitle.textContent = title;
    
    // Wyczyść grid
    playersGrid.innerHTML = '';

    // Gdy API działa, ale nie ma danych dla kategorii
    if (!Array.isArray(players) || players.length === 0) {
      const info = document.createElement('div');
      info.className = 'empty-state';
      info.style.padding = '24px';
      info.style.color = '#cbd5e1';
      info.textContent = 'Brak zawodników w tej kategorii.';
      playersGrid.appendChild(info);
      document.querySelector('.main-panels').style.display = 'none';
      playersSection.classList.remove('hidden');
      playersSection.style.display = 'block';
      return;
    }
    
    // Dodaj zawodników z prawdziwymi zdjęciami z bazy danych
    players.forEach(player => {
      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';
      
      // Używamy imageUrl z bazy danych lub fallback
      const playerImg = player.imageUrl || `https://via.placeholder.com/80x80/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}`;
      
      playerCard.innerHTML = `
        <div class="player-avatar">
          <img src="${playerImg}" alt="${player.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/80x80/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}'">
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
    
    console.log('✅ Wyświetlono', players.length, 'zawodników z bazy danych');
    
  } catch (error) {
    console.error('❌ Błąd pobierania zawodników:', error);
    
    // Pokazuj fallback tylko dla gwiazd; dla innych kategorii pokaż komunikat
    if (category === 'top-players') {
      console.log('🔄 Używam danych fallback dla Gwiazd Futbolu...');
      const fallbackPlayers = [
        { id: 'lionel-messi', name: 'Lionel Messi', team: 'Inter Miami CF', position: 'Napastnik' },
        { id: 'cristiano-ronaldo', name: 'Cristiano Ronaldo', team: 'Al Nassr FC', position: 'Napastnik' },
        { id: 'kylian-mbappe', name: 'Kylian Mbappé', team: 'Real Madrid', position: 'Napastnik' },
        { id: 'erling-haaland', name: 'Erling Haaland', team: 'Manchester City', position: 'Napastnik' },
        { id: 'robert-lewandowski', name: 'Robert Lewandowski', team: 'FC Barcelona', position: 'Napastnik' },
        { id: 'ousmane-dembele', name: 'Ousmane Dembélé', team: 'Paris Saint-Germain', position: 'Skrzydłowy' }
      ];
      showPlayersFromData(fallbackPlayers, title);
    } else {
      sectionTitle.textContent = title;
      playersGrid.innerHTML = '<div class="empty-state" style="padding:24px;color:#cbd5e1;">Nie udało się pobrać danych. Spróbuj ponownie.</div>';
      document.querySelector('.main-panels').style.display = 'none';
      playersSection.classList.remove('hidden');
      playersSection.style.display = 'block';
    }
  }
}

// Funkcja pomocnicza dla hardcodowanych danych
function showPlayersFromData(players, title) {
  sectionTitle.textContent = title;
  playersGrid.innerHTML = '';
  
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    // Fallback do Kevin De Bruyne jeśli nie ma API
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
  
  document.querySelector('.main-panels').style.display = 'none';
  playersSection.classList.remove('hidden');
  playersSection.style.display = 'block';
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
      console.log('⭐ GWIAZDY FUTBOLU - pobieranie z API!');
      showPlayers('top-players', '⭐ Gwiazdy Futbolu');
    } else if (action === 'new-talents') {
        console.log('🌟 MŁODE TALENTY - pobieranie z API!');
        showPlayers('new-talents', '🌟 Młode Talenty');
    } else if (action === 'goalkeepers') {
      console.log('🥅 BRAMKARZE - pobieranie z API!');
      showPlayers('goalkeepers', '🥅 Bramkarze');
    } else if (action === 'legends') {
      console.log('👑 LEGENDY - pobieranie z API!');
      showPlayers('legends', '👑 Legendy');
    } else if (action === 'leagues') {
      console.log('🏆 NAJLEPSZE LIGI!');
      alert('Sekcja lig w budowie! 🏆');
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