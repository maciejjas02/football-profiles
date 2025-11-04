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
  
  // Set jersey image
  if (player.jerseyImageUrl) {
    jerseyImage.src = player.jerseyImageUrl;
    jerseyImage.alt = `Koszulka ${player.name}`;
    
    jerseyImage.onerror = function() {
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
  } else {
    jerseyImage.alt = 'Brak koszulki';
  }
  
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
  
  // Initialize player rating system
  const playerId = getPlayerIdFromUrl();
  if (playerId) {
    initPlayerRating(playerId);
  }
  
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

// ============================================
// PLAYER RATING SYSTEM
// ============================================

// Initialize player rating from localStorage
let playerRatings = JSON.parse(localStorage.getItem('playerRatings') || '{}');

function initPlayerRating(playerId) {
  const likeBtn = document.getElementById('player-like-btn');
  const dislikeBtn = document.getElementById('player-dislike-btn');
  
  if (!likeBtn || !dislikeBtn) return;
  
  // Initialize rating if doesn't exist
  if (!playerRatings[playerId]) {
    playerRatings[playerId] = {
      likes: 0,
      dislikes: 0,
      userVote: null // 'like', 'dislike', or null
    };
  }
  
  const rating = playerRatings[playerId];
  
  // Update UI
  updatePlayerRatingUI(playerId);
  
  // Event listeners
  likeBtn.addEventListener('click', () => {
    if (rating.userVote === 'like') {
      // Remove like
      rating.likes--;
      rating.userVote = null;
    } else {
      // Add like
      if (rating.userVote === 'dislike') {
        rating.dislikes--;
      }
      rating.likes++;
      rating.userVote = 'like';
    }
    savePlayerRatings();
    updatePlayerRatingUI(playerId);
  });
  
  dislikeBtn.addEventListener('click', () => {
    if (rating.userVote === 'dislike') {
      // Remove dislike
      rating.dislikes--;
      rating.userVote = null;
    } else {
      // Add dislike
      if (rating.userVote === 'like') {
        rating.likes--;
      }
      rating.dislikes++;
      rating.userVote = 'dislike';
    }
    savePlayerRatings();
    updatePlayerRatingUI(playerId);
  });
}

function updatePlayerRatingUI(playerId) {
  const rating = playerRatings[playerId];
  if (!rating) return;
  
  const likeBtn = document.getElementById('player-like-btn');
  const dislikeBtn = document.getElementById('player-dislike-btn');
  const likesCount = document.getElementById('player-likes-count');
  const dislikesCount = document.getElementById('player-dislikes-count');
  const ratingBar = document.getElementById('player-rating-bar');
  const positivePercent = document.getElementById('positive-percent');
  const negativePercent = document.getElementById('negative-percent');
  
  // Update counts
  likesCount.textContent = rating.likes;
  dislikesCount.textContent = rating.dislikes;
  
  // Update button states
  likeBtn.classList.toggle('active', rating.userVote === 'like');
  dislikeBtn.classList.toggle('active', rating.userVote === 'dislike');
  
  // Calculate percentages
  const total = rating.likes + rating.dislikes;
  let positivePercentValue = 0;
  let negativePercentValue = 0;
  
  if (total > 0) {
    positivePercentValue = Math.round((rating.likes / total) * 100);
    negativePercentValue = 100 - positivePercentValue;
  }
  
  // Update bar
  ratingBar.style.width = `${positivePercentValue}%`;
  positivePercent.textContent = `${positivePercentValue}%`;
  negativePercent.textContent = `${negativePercentValue}%`;
}

function savePlayerRatings() {
  localStorage.setItem('playerRatings', JSON.stringify(playerRatings));
}

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

// ===== COMMENTS FUNCTIONALITY =====
const commentInput = document.getElementById('comment-input');
const charCounter = document.getElementById('char-counter');
const submitCommentBtn = document.getElementById('submit-comment-btn');
const commentsList = document.getElementById('comments-list');
const commentsEmpty = document.getElementById('comments-empty');
const commentsCount = document.getElementById('comments-count');

// Mock comments data (in real app, this would come from backend)
let comments = [];

// Character counter
commentInput?.addEventListener('input', () => {
  const length = commentInput.value.length;
  charCounter.textContent = `${length}/500`;
  
  if (length > 450) {
    charCounter.style.color = '#ff6b6b';
  } else {
    charCounter.style.color = 'rgba(255, 255, 255, 0.5)';
  }
});

// Submit comment
submitCommentBtn?.addEventListener('click', () => {
  const text = commentInput.value.trim();
  
  if (!text) {
    showBanner('Wpisz treść komentarza!', false);
    return;
  }
  
  // Get current user (from auth)
  const userName = who?.textContent || 'Użytkownik';
  
  // Create comment object
  const comment = {
    id: Date.now(),
    author: userName,
    text: text,
    date: new Date().toISOString(),
    likes: 0,
    dislikes: 0,
    userVote: null,
    replies: []
  };
  
  // Add to comments array
  comments.unshift(comment);
  
  // Clear input
  commentInput.value = '';
  charCounter.textContent = '0/500';
  
  // Render comments
  renderComments();
  
  showBanner('Komentarz dodany!', true);
});

// Render comments
function renderComments() {
  if (comments.length === 0) {
    commentsList.innerHTML = '';
    commentsEmpty.classList.remove('hidden');
    commentsCount.textContent = '0';
    return;
  }
  
  commentsEmpty.classList.add('hidden');
  commentsCount.textContent = comments.length;
  
  commentsList.innerHTML = comments.map(comment => {
    const initials = comment.author.split(' ').map(n => n[0]).join('').toUpperCase();
    const date = new Date(comment.date);
    const timeAgo = getTimeAgo(date);
    
    // Ensure likes/dislikes exist
    if (comment.likes === undefined) comment.likes = 0;
    if (comment.dislikes === undefined) comment.dislikes = 0;
    if (comment.userVote === undefined) comment.userVote = null;
    if (comment.replies === undefined) comment.replies = [];
    
    const likeActiveClass = comment.userVote === 'like' ? 'like-active' : '';
    const dislikeActiveClass = comment.userVote === 'dislike' ? 'dislike-active' : '';
    const repliesCount = comment.replies.length;
    
    // Render replies
    const repliesHTML = comment.replies.length > 0 ? `
      <div class="replies-list">
        ${comment.replies.map(reply => {
          const replyInitials = reply.author.split(' ').map(n => n[0]).join('').toUpperCase();
          const replyDate = new Date(reply.date);
          const replyTimeAgo = getTimeAgo(replyDate);
          
          if (reply.likes === undefined) reply.likes = 0;
          if (reply.dislikes === undefined) reply.dislikes = 0;
          if (reply.userVote === undefined) reply.userVote = null;
          
          const replyLikeActive = reply.userVote === 'like' ? 'like-active' : '';
          const replyDislikeActive = reply.userVote === 'dislike' ? 'dislike-active' : '';
          
          return `
            <div class="reply-card" data-reply-id="${reply.id}" data-comment-id="${comment.id}">
              <div class="reply-header">
                <div class="reply-author">
                  <div class="reply-avatar">${replyInitials}</div>
                  <span class="reply-author-name">${reply.author}</span>
                </div>
                <span class="reply-date">${replyTimeAgo}</span>
              </div>
              <div class="reply-text">${escapeHtml(reply.text)}</div>
              <div class="reply-actions">
                <button class="reply-action-btn reply-like-btn ${replyLikeActive}" data-reply-id="${reply.id}" data-comment-id="${comment.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                  <span>${reply.likes}</span>
                </button>
                <button class="reply-action-btn reply-dislike-btn ${replyDislikeActive}" data-reply-id="${reply.id}" data-comment-id="${comment.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                  </svg>
                  <span>${reply.dislikes}</span>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';
    
    return `
      <div class="comment-card" data-comment-id="${comment.id}">
        <div class="comment-header">
          <div class="comment-author">
            <div class="comment-avatar">${initials}</div>
            <span class="comment-author-name">${comment.author}</span>
          </div>
          <span class="comment-date">${timeAgo}</span>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
        <div class="comment-actions">
          <button class="comment-action-btn comment-like-btn ${likeActiveClass}" data-comment-id="${comment.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
            <span>${comment.likes}</span>
          </button>
          <button class="comment-action-btn comment-dislike-btn ${dislikeActiveClass}" data-comment-id="${comment.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
            </svg>
            <span>${comment.dislikes}</span>
          </button>
          <button class="comment-action-btn comment-reply-btn" data-comment-id="${comment.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <span>Odpowiedz</span>
          </button>
        </div>
        ${repliesCount > 0 ? `<div class="replies-count">💬 ${repliesCount} ${repliesCount === 1 ? 'odpowiedź' : repliesCount < 5 ? 'odpowiedzi' : 'odpowiedzi'}</div>` : ''}
        <div class="reply-form" data-comment-id="${comment.id}">
          <textarea class="reply-input" placeholder="Napisz odpowiedź..." maxlength="300" rows="2"></textarea>
          <div class="reply-form-actions">
            <span class="reply-char-counter">0/300</span>
            <div class="reply-form-buttons">
              <button class="btn-reply-cancel">Anuluj</button>
              <button class="btn-reply-submit">Odpowiedz</button>
            </div>
          </div>
        </div>
        ${repliesHTML}
      </div>
    `;
  }).join('');
  
  // Add event listeners
  attachCommentEventListeners();
}

// Attach all event listeners for comments and replies
function attachCommentEventListeners() {
  // Comment like buttons
  document.querySelectorAll('.comment-like-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = parseInt(btn.dataset.commentId);
      handleCommentLike(commentId);
    });
  });
  
  // Comment dislike buttons
  document.querySelectorAll('.comment-dislike-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = parseInt(btn.dataset.commentId);
      handleCommentDislike(commentId);
    });
  });
  
  // Reply buttons
  document.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = parseInt(btn.dataset.commentId);
      toggleReplyForm(commentId);
    });
  });
  
  // Reply form character counters
  document.querySelectorAll('.reply-input').forEach(input => {
    input.addEventListener('input', () => {
      const counter = input.closest('.reply-form').querySelector('.reply-char-counter');
      const length = input.value.length;
      counter.textContent = `${length}/300`;
      
      if (length > 270) {
        counter.style.color = '#ff6b6b';
      } else {
        counter.style.color = 'rgba(255, 255, 255, 0.5)';
      }
    });
  });
  
  // Reply submit buttons
  document.querySelectorAll('.btn-reply-submit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const replyForm = btn.closest('.reply-form');
      const commentId = parseInt(replyForm.dataset.commentId);
      const replyInput = replyForm.querySelector('.reply-input');
      submitReply(commentId, replyInput.value.trim());
    });
  });
  
  // Reply cancel buttons
  document.querySelectorAll('.btn-reply-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const replyForm = btn.closest('.reply-form');
      const commentId = parseInt(replyForm.dataset.commentId);
      toggleReplyForm(commentId);
    });
  });
  
  // Reply like buttons
  document.querySelectorAll('.reply-like-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = parseInt(btn.dataset.commentId);
      const replyId = parseInt(btn.dataset.replyId);
      handleReplyLike(commentId, replyId);
    });
  });
  
  // Reply dislike buttons
  document.querySelectorAll('.reply-dislike-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = parseInt(btn.dataset.commentId);
      const replyId = parseInt(btn.dataset.replyId);
      handleReplyDislike(commentId, replyId);
    });
  });
}

function toggleReplyForm(commentId) {
  const replyForm = document.querySelector(`.reply-form[data-comment-id="${commentId}"]`);
  if (!replyForm) return;
  
  const isActive = replyForm.classList.contains('active');
  
  // Close all reply forms
  document.querySelectorAll('.reply-form').forEach(form => {
    form.classList.remove('active');
    form.querySelector('.reply-input').value = '';
    form.querySelector('.reply-char-counter').textContent = '0/300';
  });
  
  // Toggle current form
  if (!isActive) {
    replyForm.classList.add('active');
    replyForm.querySelector('.reply-input').focus();
  }
}

function submitReply(commentId, text) {
  if (!text || text.length === 0) {
    showBanner('Odpowiedź nie może być pusta!', false);
    return;
  }
  
  const comment = comments.find(c => c.id === commentId);
  if (!comment) return;
  
  const userName = who?.textContent || 'Użytkownik';
  
  const reply = {
    id: Date.now(),
    author: userName,
    text: text,
    date: new Date().toISOString(),
    likes: 0,
    dislikes: 0,
    userVote: null
  };
  
  if (!comment.replies) comment.replies = [];
  comment.replies.push(reply);
  
  renderComments();
  showBanner('Odpowiedź dodana!', true);
}

function handleCommentLike(commentId) {
  const comment = comments.find(c => c.id === commentId);
  if (!comment) return;
  
  if (comment.userVote === 'like') {
    // Remove like
    comment.likes--;
    comment.userVote = null;
  } else {
    // Add like
    if (comment.userVote === 'dislike') {
      comment.dislikes--;
    }
    comment.likes++;
    comment.userVote = 'like';
  }
  
  renderComments();
}

function handleCommentDislike(commentId) {
  const comment = comments.find(c => c.id === commentId);
  if (!comment) return;
  
  if (comment.userVote === 'dislike') {
    // Remove dislike
    comment.dislikes--;
    comment.userVote = null;
  } else {
    // Add dislike
    if (comment.userVote === 'like') {
      comment.likes--;
    }
    comment.dislikes++;
    comment.userVote = 'dislike';
  }
  
  renderComments();
}

function handleReplyLike(commentId, replyId) {
  const comment = comments.find(c => c.id === commentId);
  if (!comment || !comment.replies) return;
  
  const reply = comment.replies.find(r => r.id === replyId);
  if (!reply) return;
  
  if (reply.userVote === 'like') {
    reply.likes--;
    reply.userVote = null;
  } else {
    if (reply.userVote === 'dislike') {
      reply.dislikes--;
    }
    reply.likes++;
    reply.userVote = 'like';
  }
  
  renderComments();
}

function handleReplyDislike(commentId, replyId) {
  const comment = comments.find(c => c.id === commentId);
  if (!comment || !comment.replies) return;
  
  const reply = comment.replies.find(r => r.id === replyId);
  if (!reply) return;
  
  if (reply.userVote === 'dislike') {
    reply.dislikes--;
    reply.userVote = null;
  } else {
    if (reply.userVote === 'like') {
      reply.likes--;
    }
    reply.dislikes++;
    reply.userVote = 'dislike';
  }
  
  renderComments();
}

// Helper: Time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Przed chwilą';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min temu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} godz. temu`;
  return `${Math.floor(seconds / 86400)} dni temu`;
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initial render
renderComments();

