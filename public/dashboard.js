// public/dashboard.js (pełny kod z poprawką nawigacji)

// Slider
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const sliderTrack = document.querySelector('.slider-track');
const arrowLeft = document.querySelector('.slider-arrow-left');
const arrowRight = document.querySelector('.slider-arrow-right');

// --- NOWA FUNKCJA POPRAWIAJĄCA NAWIGACJĘ ---
function setActiveNav() {
    const currentPath = window.location.pathname;
    
    // Iteracja po wszystkich linkach w pasku nawigacyjnym
    document.querySelectorAll('.topbar-nav .nav-tab').forEach(link => {
        // 1. Usuń klasę 'active' z każdego linku
        link.classList.remove('active');
        
        // 2. Sprawdź, czy href linku pasuje do aktualnej ścieżki
        const linkPath = new URL(link.href).pathname;
        
        // Specjalna obsługa dla "/" i "/dashboard.html"
        const isDashboardHome = (currentPath === '/' || currentPath === '/dashboard.html') && linkPath === '/dashboard.html';

        if (linkPath === currentPath || isDashboardHome) {
            link.classList.add('active');
        }
    });
}
// ---------------------------------------------


function goToSlide(index) {
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;
  currentSlide = index;
  if(sliderTrack) sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
}
if(arrowLeft) arrowLeft.addEventListener('click', () => goToSlide(currentSlide - 1));
if(arrowRight) arrowRight.addEventListener('click', () => goToSlide(currentSlide + 1));
setInterval(() => goToSlide(currentSlide + 1), 5000);

// Dashboard Logic
const playersSection = document.getElementById('players-section');
const playersGrid = document.getElementById('players-grid');
const sectionTitle = document.getElementById('section-title');
const backBtn = document.getElementById('back-btn');
const leaguesBackBtn = document.getElementById('leagues-back-btn');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;

async function setupAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not auth');
        const data = await res.json();
        currentUser = data.user;
        
        document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
        
        if(currentUser.role === 'admin' || currentUser.role === 'moderator') {
            document.getElementById('moderatorLink').style.display = 'block';
            
            const galleryManageLink = document.getElementById('galleryManageLink');
            if(galleryManageLink) galleryManageLink.style.display = 'block';
        }
        if(currentUser.role === 'admin') {
            document.getElementById('adminLink').style.display = 'block';
        }

        // LOGOUT HANDLER
        if(logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
            });
        }

        // Load collection stats
        const purRes = await fetch('/api/user/purchases');
        if(purRes.ok) {
            const purchases = await purRes.json();
            const countEl = document.getElementById('collection-count');
            if(countEl) countEl.textContent = `${purchases.length} koszulek`;
        }

    } catch (e) {
        console.log('Nie zalogowany');
        window.location.href = '/';
    }
}

async function showPlayers(category, title) {
    // ... (pozostała logika showPlayers)
    try {
        const res = await fetch(`/api/players/category/${category}`);
        const players = await res.json();
        
        sectionTitle.textContent = title;
        playersGrid.innerHTML = '';
        
        if(players.length === 0) {
            playersGrid.innerHTML = '<div class="empty-state">Brak zawodników</div>';
        } else {
            players.forEach(p => {
                const card = document.createElement('div');
                card.className = 'player-card';
                card.style.backgroundImage = `url('${p.imageUrl}')`;
                card.innerHTML = `
                    <div class="player-info">
                        <h3>${p.name}</h3>
                        <p class="team">${p.team}</p>
                        <a href="/player.html?id=${p.id}" class="btn btn-primary">Profil</a>
                    </div>
                `;
                playersGrid.appendChild(card);
            });
        }
        hideAll();
        playersSection.classList.remove('hidden');
        playersSection.style.display = 'block';
    } catch (e) { console.error(e); }
}

function hideAll() {
    document.querySelector('.main-panels').style.display = 'none';
    playersSection.style.display = 'none';
    document.getElementById('leagues-section').style.display = 'none';
}

function showMain() {
    playersSection.style.display = 'none';
    document.getElementById('leagues-section').style.display = 'none';
    document.querySelector('.main-panels').style.display = 'grid';
}

document.addEventListener('click', (e) => {
    const card = e.target.closest('.panel-card');
    if(card) {
        const action = card.dataset.action;
        if(action === 'my-collection') window.location.href = '/my-collection.html';
        else if(action === 'leagues') {
            hideAll();
            document.getElementById('leagues-section').style.display = 'block';
        }
        else if(action === 'top-players') showPlayers('top-players', 'Gwiazdy');
        else if(action === 'new-talents') showPlayers('new-talents', 'Talenty');
        else if(action === 'goalkeepers') showPlayers('goalkeepers', 'Bramkarze');
        else if(action === 'legends') showPlayers('legends', 'Legendy');
    }
});

if(backBtn) backBtn.addEventListener('click', showMain);
if(leaguesBackBtn) leaguesBackBtn.addEventListener('click', showMain);

// Theme init
function initTheme() {
    const div = document.createElement('div');
    div.className = 'theme-selector';
    div.innerHTML = `
        <div class="theme-btn gold" data-theme="default"></div>
        <div class="theme-btn blue" data-theme="blue"></div>
        <div class="theme-btn red" data-theme="red"></div>
    `;
    document.body.appendChild(div);
    div.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            if(theme==='default') {
                document.body.removeAttribute('data-theme');
                localStorage.removeItem('theme');
            } else {
                document.body.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
            }
        });
    });
    const saved = localStorage.getItem('theme');
    if(saved) document.body.setAttribute('data-theme', saved);
}

initTheme();
setupAuth().then(setActiveNav); // Dodajemy wywołanie, by ustawić aktywny link po załadowaniu strony