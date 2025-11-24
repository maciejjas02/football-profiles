let currentUser = null;
let postId = null;

function showBanner(msg, ok = true) {
  let banner = document.getElementById('banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'banner';
    banner.className = 'banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }
  banner.textContent = msg;
  banner.className = 'banner';
  banner.classList.add(ok ? 'banner--ok' : 'banner--err');
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 3000);
}

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  postId = urlParams.get('id');
  
  if (!postId) {
    window.location.href = 'forum.html';
    return;
  }
  
  await setupAuth();
  await loadPost();
  await loadComments();
}

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
      document.getElementById('commentFormSection').classList.remove('hidden');
      
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });

      if (currentUser.role === 'moderator' || currentUser.role === 'admin') {
        document.getElementById('moderatorLink').style.display = 'block';
      }
      if (currentUser.role === 'admin') {
        document.getElementById('adminLink').style.display = 'block';
      }
    } else {
      document.getElementById('who').textContent = "Gość";
      document.getElementById('logoutBtn').style.display = 'none';
      document.getElementById('loginToComment').classList.remove('hidden');
    }
  } catch (error) {}
}

async function loadPost() {
  try {
    const res = await fetch(`/api/forum/posts/${postId}`);
    if(!res.ok) throw new Error();
    const post = await res.json();
    
    const postContent = document.getElementById('postContent');
    postContent.innerHTML = `
      <div class="post-header-detail">
        <h1>${post.title || 'Bez tytułu'}</h1>
        <div class="post-meta-detail">
          <span class="post-category">${post.category_name || 'Ogólne'}</span>
          <span>👤 ${post.author_username || 'Nieznany'}</span>
          <span>🕒 ${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="post-content-html">
        ${post.content || '<p>Brak treści</p>'}
      </div>
    `;
    
    document.getElementById('loading').classList.add('hidden');
    postContent.classList.remove('hidden');
    document.getElementById('commentsSection').classList.remove('hidden');

  } catch (error) {
    document.getElementById('postContent').innerHTML = '<div class="error-state">Nie znaleziono posta.</div>';
  }
}
async function loadComments() {
  try {
    const res = await fetch(`/api/forum/posts/${postId}/comments`);
    const comments = await res.json();
    
    const commentsList = document.getElementById('commentsList');
    document.getElementById('commentCount').textContent = comments.length;
    
    if (comments.length === 0) {
      commentsList.innerHTML = '<div class="comments-empty">Brak komentarzy. Bądź pierwszy!</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => {
        const initials = comment.author_username.substring(0,2).toUpperCase();
        const isLiked = comment.user_vote === 1 ? 'active' : '';
        const isDisliked = comment.user_vote === -1 ? 'active' : '';

        return `
          <div class="comment-card">
            <div class="comment-header">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width:32px; height:32px; background: linear-gradient(45deg, #FFD700, #DAA520); border-radius:50%; display:flex; align-items:center; justify-content:center; color:black; font-weight:bold; font-size:12px;">${initials}</div>
                <div>
                    <span style="color: #FFD700; font-weight: bold; display:block;">${comment.author_username}</span>
                    <span style="font-size: 11px; color: #888;">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div class="comment-content">${comment.content}</div>
            
            <div class="comment-actions">
                <button onclick="rateComment(${comment.id}, 1)" class="btn-sm ${isLiked}" style="background: rgba(255,255,255,0.1); border:none; color: ${isLiked ? '#4ade80' : '#ccc'};">👍 ${comment.likes || 0}</button>
                <button onclick="rateComment(${comment.id}, -1)" class="btn-sm ${isDisliked}" style="background: rgba(255,255,255,0.1); border:none; color: ${isDisliked ? '#f87171' : '#ccc'};">👎 ${comment.dislikes || 0}</button>
            </div>
          </div>
        `;
    }).join('');
  } catch (error) { console.error(error); }
}

window.rateComment = async (id, rating) => {
    if(!currentUser) return showBanner('Zaloguj się, aby oceniać!', false);
    try {
        await fetch(`/api/forum/comments/${id}/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating })
        });
        loadComments();
    } catch(e) { showBanner('Błąd', false); }
};

const submitBtn = document.getElementById('submitCommentBtn');
if(submitBtn) {
    submitBtn.addEventListener('click', async () => {
        if(!currentUser) return showBanner("Musisz być zalogowany!", false);
        
        const content = document.getElementById('commentContent').value.trim();
        if (!content) return showBanner("Wpisz treść komentarza", false);
        
        try {
            const res = await fetch(`/api/forum/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            
            if(res.ok) {
                const data = await res.json();
                document.getElementById('commentContent').value = '';
                if(data.status === 'pending') showBanner('✅ Komentarz wysłany do moderacji.', true);
                else {
                    showBanner('✅ Komentarz dodany!', true);
                    loadComments();
                }
            } else showBanner('Błąd dodawania komentarza', false);
        } catch(e) { showBanner('Błąd połączenia', false); }
    });
}

init();