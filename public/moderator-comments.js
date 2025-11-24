let currentUser = null;

async function init() {
  await setupAuth();
  await loadPendingComments();
  document.getElementById('refreshBtn').addEventListener('click', loadPendingComments);
}

async function setupAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('who').textContent = currentUser.display_name || currentUser.username;
      if (currentUser.role !== 'moderator' && currentUser.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
      }
      if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
    } else window.location.href = 'index.html';
  } catch (error) { window.location.href = 'index.html'; }
}

async function loadPendingComments() {
  try {
    const res = await fetch('/api/forum/comments/pending/list');
    const comments = await res.json();
    document.getElementById('pendingCount').textContent = comments.length;
    const list = document.getElementById('pendingCommentsList');
    
    if (comments.length === 0) {
      list.innerHTML = '<div class="empty-state">Brak komentarzy do zatwierdzenia</div>';
      return;
    }
    
    list.innerHTML = comments.map(comment => `
      <div class="pending-comment-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div class="comment-context" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.5);">Post: <strong style="color: var(--primary-color);">${comment.post_title}</strong> | Kategoria: ${comment.category_name}</div>
          <div style="font-size: 13px; margin-top: 5px;">Autor: <strong>${comment.author_username}</strong></div>
        </div>
        <div class="comment-content-preview" style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; margin-bottom: 15px;">${comment.content}</div>
        <div class="comment-moderate-actions" style="display:flex; gap:10px;">
          <button class="btn btn-primary btn-sm" onclick="editAndApprove(${comment.id}, '${comment.content.replace(/'/g, "\\'")}')">✏️ Edytuj</button>
          <button class="btn btn-success btn-sm" onclick="approveComment(${comment.id})" style="background:#28a745; border:none; color:white;">✅ Zatwierdź</button>
          <button class="btn btn-danger btn-sm" onclick="rejectComment(${comment.id})" style="background:#dc3545; border:none; color:white;">❌ Odrzuć</button>
          <button class="btn btn-secondary btn-sm" onclick="window.open('post.html?id=${comment.post_id}', '_blank')">👁️ Post</button>
        </div>
      </div>
    `).join('');
  } catch (error) { console.error(error); }
}

window.approveComment = async (id) => {
  if (!confirm('Zatwierdzić?')) return;
  try { await fetch(`/api/forum/comments/${id}/approve`, { method: 'POST' }); loadPendingComments(); } catch(e){}
};
window.rejectComment = async (id) => {
  if (!confirm('Odrzucić?')) return;
  try { await fetch(`/api/forum/comments/${id}/reject`, { method: 'POST' }); loadPendingComments(); } catch(e){}
};
window.editAndApprove = async (id, oldContent) => {
  const newContent = prompt('Edytuj treść:', oldContent);
  if (!newContent) return;
  try {
    await fetch(`/api/forum/comments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newContent }) });
    await fetch(`/api/forum/comments/${id}/approve`, { method: 'POST' });
    alert('✅ Gotowe!');
    loadPendingComments();
  } catch (e) { alert('Błąd'); }
};

init();