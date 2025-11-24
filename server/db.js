import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = new Database(path.join(__dirname, 'app.sqlite'));

export function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, username TEXT UNIQUE, password_hash TEXT, name TEXT, avatar_url TEXT, role TEXT DEFAULT 'user', reputation INTEGER DEFAULT 0, provider TEXT, provider_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS clubs (id TEXT PRIMARY KEY, name TEXT, full_name TEXT, country TEXT, league TEXT, founded INTEGER, stadium TEXT, logo_url TEXT, primary_color TEXT, secondary_color TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT, full_name TEXT, club_id TEXT, team TEXT, position TEXT, nationality TEXT, age INTEGER, height TEXT, weight TEXT, market_value TEXT, biography TEXT, jersey_price INTEGER, jersey_available BOOLEAN DEFAULT 1, jersey_image_url TEXT, image_url TEXT, team_logo TEXT, national_flag TEXT, category TEXT, deceased BOOLEAN DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (club_id) REFERENCES clubs (id));

    CREATE TABLE IF NOT EXISTS player_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT, goals INTEGER, assists INTEGER, matches INTEGER, trophies INTEGER);
    CREATE TABLE IF NOT EXISTS player_achievements (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT, achievement TEXT, year INTEGER, description TEXT);

    CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, player_id TEXT, jersey_price INTEGER, purchase_date TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'pending');

    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE, description TEXT, parent_id INTEGER);
    CREATE TABLE IF NOT EXISTS moderator_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, category_id INTEGER, UNIQUE(user_id, category_id));
    CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, category_id INTEGER, author_id INTEGER, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS post_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, author_id INTEGER, content TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS comment_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, comment_id INTEGER, user_id INTEGER, rating INTEGER, UNIQUE(comment_id, user_id));
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS user_discussions (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, moderator_id INTEGER, message TEXT, sender_type TEXT, created_at TEXT DEFAULT (datetime('now')));
    
    CREATE TABLE IF NOT EXISTS gallery_images (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL, title TEXT NOT NULL, description TEXT, width INTEGER, height INTEGER, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS gallery_collections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, is_active INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS gallery_items (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL, image_id INTEGER NOT NULL, position INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (collection_id) REFERENCES gallery_collections (id) ON DELETE CASCADE, FOREIGN KEY (image_id) REFERENCES gallery_images (id) ON DELETE CASCADE);
  `);
}

// --- SEEDING ---
export async function ensureSeedAdmin() {
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com');
  if (!row) {
    const hash = await bcrypt.hash('admin1234', 10);
    db.prepare(`INSERT INTO users (email, username, password_hash, name, role, provider) VALUES (?, ?, ?, ?, ?, ?)`).run('admin@example.com', 'admin', hash, 'Admin', 'admin', 'local');
  } else {
    // Fix role if exists but wrong
    db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'").run();
  }
}

export function ensureSeedCategories() {
  if (!db.prepare("SELECT id FROM categories WHERE slug='news'").get()) {
    db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)").run('Aktualności', 'news', 'Newsy ze świata piłki');
    db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)").run('Dyskusje', 'discussions', 'Ogólne rozmowy o meczach');
  }
}

export function ensureSeedClubs() {
  if(db.prepare('SELECT count(*) as c FROM clubs').get().c > 0) return;
  const insert = db.prepare(`INSERT INTO clubs (id, name, full_name, country, league, founded, stadium, logo_url, primary_color, secondary_color) VALUES (@id, @name, @full_name, @country, @league, @founded, @stadium, @logo_url, @primary_color, @secondary_color)`);
  
  const clubsData = [
    { id: 'manchester-city', name: 'Manchester City', full_name: 'Manchester City FC', country: 'Anglia', league: 'Premier League', founded: 1880, stadium: 'Etihad', logo_url: '', primary_color: '#6CABDD', secondary_color: '#FFF' },
    { id: 'real-madrid', name: 'Real Madrid', full_name: 'Real Madrid CF', country: 'Hiszpania', league: 'La Liga', founded: 1902, stadium: 'Bernabeu', logo_url: '', primary_color: '#FFF', secondary_color: '#000' },
    { id: 'inter-miami', name: 'Inter Miami', full_name: 'Inter Miami CF', country: 'USA', league: 'MLS', founded: 2018, stadium: 'DRV PNK', logo_url: '', primary_color: '#F7B5CD', secondary_color: '#000' },
    { id: 'al-nassr', name: 'Al Nassr', full_name: 'Al Nassr FC', country: 'Arabia Saudyjska', league: 'Saudi Pro League', founded: 1955, stadium: 'Al-Awwal', logo_url: '', primary_color: '#FFD700', secondary_color: '#000' },
    { id: 'fc-barcelona', name: 'FC Barcelona', full_name: 'Futbol Club Barcelona', country: 'Hiszpania', league: 'La Liga', founded: 1899, stadium: 'Camp Nou', logo_url: '', primary_color: '#A50044', secondary_color: '#004D98' }
  ];
  clubsData.forEach(club => insert.run(club));
}

export function ensureSeedPlayers() {
  if(db.prepare('SELECT count(*) as c FROM players').get().c > 0) return;
  const insertPlayer = db.prepare(`INSERT OR IGNORE INTO players (id, name, full_name, club_id, team, position, nationality, age, height, weight, market_value, biography, jersey_price, jersey_available, category) VALUES (@id, @name, @full_name, @club_id, @team, @position, @nationality, @age, @height, @weight, @market_value, @biography, @jersey_price, @jersey_available, @category)`);
  const insertStats = db.prepare(`INSERT OR REPLACE INTO player_stats (player_id, goals, assists, matches, trophies) VALUES (@player_id, @goals, @assists, @matches, @trophies)`);
  
  const players = [
    { id: 'lionel-messi', name: 'Lionel Messi', full_name: 'Lionel Andrés Messi', club_id: 'inter-miami', team: 'Inter Miami', position: 'Napastnik', nationality: 'Argentyna', age: 36, height: '1.70m', weight: '67kg', market_value: '30M', biography: 'Legenda.', jersey_price: 299, jersey_available: 1, category: 'top-players', goals: 800, assists: 350, matches: 1000, trophies: 44 }
  ];

  players.forEach(p => {
    const { goals, assists, matches, trophies, ...playerData } = p;
    insertPlayer.run(playerData);
    insertStats.run({ player_id: p.id, goals, assists, matches, trophies });
  });
}

// --- USERS ---
export function findUserByLogin(l) { return db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(l, l); }
export function getUserById(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
export async function createLocalUser({ email, username, password, name }) {
    const hash = await bcrypt.hash(password, 10);
    const res = db.prepare('INSERT INTO users (email, username, password_hash, name, role, provider) VALUES (?,?,?,?,?,?)').run(email, username, hash, name, 'user', 'local');
    return getUserById(res.lastInsertRowid);
}
export function createOrUpdateUserFromProvider(p, d) { return getUserById(1); }
export function existsUserByEmail(e) { return !!db.prepare('SELECT 1 FROM users WHERE email=?').get(e); }
export function existsUserByUsername(u) { return !!db.prepare('SELECT 1 FROM users WHERE username=?').get(u); }

// --- DATA ---
export function getPlayerById(id) { 
  const p = db.prepare('SELECT * FROM players WHERE id=?').get(id);
  if(!p) return null;
  p.stats = db.prepare('SELECT * FROM player_stats WHERE player_id=?').get(id) || {};
  p.achievements = db.prepare('SELECT achievement FROM player_achievements WHERE player_id=?').all(id).map(x=>x.achievement);
  return p;
}
export function getPlayersByCategory(cat) { 
    const rows = db.prepare('SELECT * FROM players WHERE category=?').all(cat);
    return rows.map(p => getPlayerById(p.id));
}
export function getAllClubs() { return db.prepare('SELECT * FROM clubs').all(); }
export function getClubById(id) { return db.prepare('SELECT * FROM clubs WHERE id=?').get(id); }
export function createPurchase(u, p, j) { return db.prepare('INSERT INTO purchases (user_id, player_id, jersey_price) VALUES (?,?,?)').run(u, p, j); }
export function getUserPurchases(id) { return db.prepare('SELECT * FROM purchases WHERE user_id=?').all(id); }
export function updatePurchaseStatus(id, s) { return db.prepare('UPDATE purchases SET status=? WHERE id=?').run(s, id); }

// --- FORUM ---
export function getAllCategories() { return db.prepare('SELECT * FROM categories').all(); }
export function getCategoryBySlug(s) { return db.prepare('SELECT * FROM categories WHERE slug=?').get(s); }
export function getSubcategories(id) { return []; }
export function createCategory(n, s, d, p) { return db.prepare('INSERT INTO categories (name, slug, description, parent_id) VALUES (?,?,?,?)').run(n,s,d,p); }
export function updateCategory(id, n, s, d) { return db.prepare('UPDATE categories SET name=?, slug=?, description=? WHERE id=?').run(n, s, d, id); }
export function deleteCategory(id) { db.prepare('DELETE FROM categories WHERE id=?').run(id); }
export function getCategoryModerators(id) { return []; }
export function assignModeratorToCategory(u, c) {}
export function removeModeratorFromCategory(u, c) {}

// --- POSTS (TO BYŁO ZEPSUTE) ---
export function getAllPosts(limit, offset) {
    return db.prepare(`
        SELECT p.*, u.username as author_username, c.name as category_name 
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.status = 'approved' 
        ORDER BY p.created_at DESC 
        LIMIT ? OFFSET ?
    `).all(limit, offset);
}

export function getPostsByCategory(catId, limit, offset) {
    return db.prepare(`
        SELECT p.*, u.username as author_username, c.name as category_name 
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.category_id = ? AND p.status = 'approved' 
        ORDER BY p.created_at DESC 
        LIMIT ? OFFSET ?
    `).all(catId, limit, offset);
}

// *** TO JEST NAPRAWIONA FUNKCJA ***
export function getPostById(id) {
    const p = db.prepare(`
        SELECT p.*, u.username as author_username, c.name as category_name 
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ?
    `).get(id);
    return p;
}

export function createPost(t, c, cat, aut, stat) { 
    return db.prepare('INSERT INTO posts (title, content, category_id, author_id, status) VALUES (?,?,?,?,?)').run(t, c, cat, aut, stat); 
}
export function updatePost(id, t, c, cat) { return db.prepare('UPDATE posts SET title=?, content=?, category_id=? WHERE id=?').run(t, c, cat, id); }
export function approvePost(id) { return db.prepare("UPDATE posts SET status='approved' WHERE id=?").run(id); }
export function rejectPost(id) { return db.prepare("UPDATE posts SET status='rejected' WHERE id=?").run(id); }
export function deletePost(id) { return db.prepare("DELETE FROM posts WHERE id=?").run(id); }
export function getPendingPosts() { 
    return db.prepare("SELECT p.*, c.name as category_name, u.username as author_username FROM posts p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN users u ON p.author_id=u.id WHERE p.status='pending'").all(); 
}

// COMMENTS
export function getPostComments(pid, userId) { 
    return db.prepare(`
        SELECT pc.*, u.username as author_username, 
        (SELECT COUNT(*) FROM comment_ratings WHERE comment_id = pc.id AND rating = 1) as likes,
        (SELECT COUNT(*) FROM comment_ratings WHERE comment_id = pc.id AND rating = -1) as dislikes,
        (SELECT rating FROM comment_ratings WHERE comment_id = pc.id AND user_id = ?) as user_vote
        FROM post_comments pc 
        LEFT JOIN users u ON pc.author_id=u.id 
        WHERE post_id=? AND status='approved'
    `).all(userId || -1, pid); 
}
export function createComment(pid, c, aid) { 
    const user = getUserById(aid);
    const status = (user.role === 'admin' || user.role === 'moderator') ? 'approved' : 'pending';
    return db.prepare("INSERT INTO post_comments (post_id, content, author_id, status) VALUES (?,?,?,?)").run(pid, c, aid, status); 
}
export function getCommentById(id) { return db.prepare("SELECT * FROM post_comments WHERE id=?").get(id); }
export function updateComment() {}
export function approveComment(id) { return db.prepare("UPDATE post_comments SET status='approved' WHERE id=?").run(id); }
export function rejectComment(id) { return db.prepare("UPDATE post_comments SET status='rejected' WHERE id=?").run(id); }
export function deleteComment(id) { return db.prepare("DELETE FROM post_comments WHERE id=?").run(id); }
export function getPendingComments(modId) { return db.prepare("SELECT * FROM post_comments WHERE status='pending'").all(); }

export function rateComment(cid, uid, r) {
    const e = db.prepare("SELECT rating FROM comment_ratings WHERE comment_id=? AND user_id=?").get(cid, uid);
    if(e) {
        if(e.rating === r) db.prepare("DELETE FROM comment_ratings WHERE comment_id=? AND user_id=?").run(cid, uid);
        else db.prepare("UPDATE comment_ratings SET rating=? WHERE comment_id=? AND user_id=?").run(r, cid, uid);
    } else db.prepare("INSERT INTO comment_ratings (comment_id, user_id, rating) VALUES (?,?,?)").run(cid, uid, r);
}

// GALLERY (skrócone, bo działają)
export function createGalleryImage(d) { return db.prepare("INSERT INTO gallery_images (filename, title, description, width, height) VALUES (@filename, @title, @description, @width, @height)").run(d).lastInsertRowid; }
export function getAllGalleryImages() { return db.prepare("SELECT * FROM gallery_images").all(); }
export function getGalleryImageById(id) { return db.prepare("SELECT * FROM gallery_images WHERE id=?").get(id); }
export function deleteGalleryImage(id) { return db.prepare("DELETE FROM gallery_images WHERE id=?").run(id); }
export function createGalleryCollection(d) { return db.prepare("INSERT INTO gallery_collections (name, description) VALUES (@name, @description)").run(d).lastInsertRowid; }
export function getAllGalleryCollections() { return db.prepare("SELECT * FROM gallery_collections").all(); }
export function getGalleryCollectionById(id) { return db.prepare("SELECT * FROM gallery_collections WHERE id=?").get(id); }
export function getActiveGalleryCollection() { return db.prepare("SELECT * FROM gallery_collections WHERE is_active=1").get(); }
export function setActiveGalleryCollection(id) { db.prepare("UPDATE gallery_collections SET is_active=0").run(); return db.prepare("UPDATE gallery_collections SET is_active=1 WHERE id=?").run(id); }
export function deleteGalleryCollection(id) { return db.prepare("DELETE FROM gallery_collections WHERE id=?").run(id); }
export function addImageToCollection(d) { return db.prepare("INSERT INTO gallery_items (collection_id, image_id, position) VALUES (@collection_id, @image_id, @position)").run(d).lastInsertRowid; }
export function getCollectionItems(id) { return db.prepare("SELECT gi.*, i.filename FROM gallery_items gi JOIN gallery_images i ON gi.image_id=i.id WHERE collection_id=? ORDER BY position").all(id); }
export function removeImageFromCollection(id) { return db.prepare("DELETE FROM gallery_items WHERE id=?").run(id); }
export function reorderCollectionItems() {}

export function getUserCommentRating() {}
export function createNotification() {}
export function getUserNotifications() { return []; }
export function markNotificationAsRead() {}
export function markAllNotificationsAsRead() {}
export function createDiscussion() {}
export function getDiscussionMessages() { return []; }