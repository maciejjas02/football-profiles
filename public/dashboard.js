// 🚀 NOWY DASHBOARD.JS - HARD RESET! 🚀

// ===== SLIDER =====
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const sliderTrack = document.querySelector('.slider-track');
const arrowLeft = document.querySelector('.slider-arrow-left');
const arrowRight = document.querySelector('.slider-arrow-right');

function goToSlide(index) {
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;
  
  currentSlide = index;
  sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
  
  // Aktualizuj kropki
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
  });
}

function nextSlide() {
  goToSlide(currentSlide + 1);
}

function prevSlide() {
  goToSlide(currentSlide - 1);
}

// Event listenery dla strzałek
arrowLeft.addEventListener('click', prevSlide);
arrowRight.addEventListener('click', nextSlide);

// Event listenery dla kropek
dots.forEach((dot, index) => {
  dot.addEventListener('click', () => goToSlide(index));
});

// Auto-play co 5 sekund
setInterval(nextSlide, 5000);

// ===== RESZTA KODU =====

// Podstawowe elementy DOM
const playersSection = document.getElementById('players-section');
const playersGrid = document.getElementById('players-grid');
const sectionTitle = document.getElementById('section-title');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logoutBtn');

// Funkcja do wyświetlania zawodników z API
async function showPlayers(category, title) {
  
  try {
    // Pobierz zawodników z bazy danych
    const response = await fetch(`/api/players/category/${category}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const players = await response.json();
    
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
      console.log(`${player.name} - deceased:`, player.deceased); // DEBUG
      
      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';
      
      // Używamy imageUrl z bazy danych lub fallback
      const playerImg = player.imageUrl || `https://via.placeholder.com/400x400/333/fff?text=${player.name.split(' ').map(n => n[0]).join('')}`;
      
      // Ustaw zdjęcie jako tło
      playerCard.style.backgroundImage = `url('${playerImg}')`;
      playerCard.style.backgroundSize = 'cover';
      playerCard.style.backgroundPosition = 'center center';
      playerCard.style.backgroundRepeat = 'no-repeat';
      
      // Dodaj wstążkę żałobną dla nieżyjących legend
      const ribbonHTML = player.deceased ? `
        <div class="memorial-ribbon">
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/0a/Black_Ribbon.svg" alt="In Memoriam">
        </div>
      ` : '';
      
      console.log(`Ribbon HTML for ${player.name}:`, ribbonHTML ? 'YES' : 'NO'); // DEBUG
      
      playerCard.innerHTML = `
        ${ribbonHTML}
        <div class="player-info">
          <h3>${player.name}</h3>
          <p class="team">${player.team}</p>
          <p class="position">${player.position}</p>
          <button class="btn btn-primary" data-player-id="${player.id}">Zobacz Profil</button>
        </div>
      `;
      
      // Event listener dla przycisku "Zobacz Profil"
      const profileBtn = playerCard.querySelector('.btn-primary');
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const playerId = e.target.dataset.playerId;
        console.log('🎯 Przekierowanie do profilu:', playerId);
        window.location.href = `/player.html?id=${playerId}`;
      });
      
      playersGrid.appendChild(playerCard);
    });
    
    // Pokaż sekcję zawodników
    document.querySelector('.main-panels').style.display = 'none';
    playersSection.classList.remove('hidden');
    playersSection.style.display = 'block';
    
  } catch (error) {
    
    // Pokazuj fallback tylko dla gwiazd; dla innych kategorii pokaż komunikat
    if (category === 'top-players') {
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
    
    playerCard.style.backgroundImage = `url('${playerImg}')`;
    playerCard.style.backgroundSize = 'cover';
    playerCard.style.backgroundPosition = 'center center';
    playerCard.style.backgroundRepeat = 'no-repeat';
    
    playerCard.innerHTML = `
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
      showLeagues();
    } else if (action === 'my-collection') {
      console.log('💎 MOJA KOLEKCJA!');
      showPlayers([], '💎 Moja Kolekcja (Pusta)');
    } else {
      console.log('🚧 Panel w budowie:', action);
      alert(`Panel "${action}" jest w budowie!`);
    }
  }
});

// Funkcja do pokazywania lig
function showLeagues() {
  const leaguesSection = document.getElementById('leagues-section');
  document.querySelector('.main-panels').style.display = 'none';
  leaguesSection.classList.remove('hidden');
  leaguesSection.style.display = 'block';
}

// Event listener dla przycisku powrotu z lig
const leaguesBackBtn = document.getElementById('leagues-back-btn');
if (leaguesBackBtn) {
  leaguesBackBtn.addEventListener('click', () => {
    const leaguesSection = document.getElementById('leagues-section');
    leaguesSection.classList.add('hidden');
    leaguesSection.style.display = 'none';
    document.querySelector('.main-panels').style.display = 'grid';
  });
}

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
    const currentUser = data.user;
    console.log('👤 Zalogowany jako:', currentUser?.name || 'Admin');
    document.getElementById('who').textContent = currentUser?.name || 'Admin';
    
    // Pokaż linki na podstawie roli
    if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
      document.getElementById('moderatorLink').style.display = 'block';
    }
    if (currentUser.role === 'admin') {
      document.getElementById('adminLink').style.display = 'block';
    }
    
    // Obsługa wylogowania
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    });
  } catch (err) {
    console.log('❌ Nie zalogowany, przekierowanie...');
    window.location.href = '/';
  }
})();

console.log('🎯 Dashboard gotowy! Kliknij na "Gwiazdy Futbolu"!');