const loading = document.getElementById('loading');
const errorState = document.getElementById('error-state');
const playerContent = document.getElementById('player-content');
const buyJerseyBtn = document.getElementById('buy-jersey-btn');
const logoutBtn = document.getElementById('logoutBtn');

let currentPlayer = null;
let currentUser = null;

function getId() { return new URLSearchParams(window.location.search).get('id'); }

async function init() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            document.getElementById('who').textContent = currentUser.display_name || currentUser.username;

            logoutBtn.addEventListener('click', async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
            });
        } else {
            document.getElementById('who').textContent = "Gość";
            logoutBtn.style.display = 'none';
        }
    } catch (e) { console.log(e); }

    const id = getId();
    if (id) loadPlayer(id);
    else showError();
}

async function loadPlayer(id) {
    try {
        const res = await fetch(`/api/player/${id}`);
        if (!res.ok) throw new Error();
        currentPlayer = await res.json();
        displayPlayer(currentPlayer);
    } catch (e) { showError(); }
}

function showError() {
    loading.classList.add('hidden');
    errorState.classList.remove('hidden');
}

function displayPlayer(p) {
    document.title = p.name;
    document.getElementById('player-breadcrumb').textContent = p.name;
    document.getElementById('player-name').textContent = p.name;
    document.getElementById('player-team').textContent = p.team;
    document.getElementById('player-position').textContent = p.position;

    document.getElementById('player-age').textContent = p.age;
    document.getElementById('player-height').textContent = p.height;
    document.getElementById('player-weight').textContent = p.weight;
    document.getElementById('player-value').textContent = p.marketValue;

    const img = document.getElementById('player-image');
    img.src = p.imageUrl;
    img.onerror = () => { img.src = 'https://via.placeholder.com/200x200/333/fff?text=PLAYER'; };

    document.getElementById('national-flag').src = p.nationalFlag || '';
    document.getElementById('team-logo').src = p.teamLogo || '';

    document.getElementById('jersey-team').textContent = p.team;
    document.getElementById('jersey-price-amount').textContent = (p.jerseyPrice || 299) + ' zł';

    const jImg = document.getElementById('jersey-image');
    jImg.src = p.jerseyImageUrl || 'https://via.placeholder.com/120x120/333/fff?text=SHIRT';

    document.getElementById('stat-goals').textContent = p.stats.goals;
    document.getElementById('stat-assists').textContent = p.stats.assists;
    document.getElementById('stat-matches').textContent = p.stats.matches;
    document.getElementById('stat-trophies').textContent = p.stats.trophies;

    document.getElementById('player-biography').textContent = p.biography;

    if (p.achievements) {
        document.getElementById('achievements-list').innerHTML = p.achievements.map(a => `<div class="achievement-item">🏆 ${a}</div>`).join('');
    }

    buyJerseyBtn.onclick = buyJersey;

    loading.classList.add('hidden');
    playerContent.classList.remove('hidden');
}

async function buyJersey() {
    if (!currentUser) return alert("Zaloguj się!");
    if (!confirm(`Kupić koszulkę ${currentPlayer.name}?`)) return;

    try {
        const res = await fetch('/api/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: currentPlayer.id })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message || "Kupiono!");
            if (confirm("Przejść do kolekcji?")) window.location.href = '/my-collection.html';
        } else {
            alert("Błąd: " + data.error);
        }
    } catch (e) { alert("Błąd sieci"); }
}

document.getElementById('dashboard-btn')?.addEventListener('click', () => window.location.href = '/dashboard.html');
document.getElementById('error-dashboard-btn')?.addEventListener('click', () => window.location.href = '/dashboard.html');

init();