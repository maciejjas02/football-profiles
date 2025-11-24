import pg from 'pg';
const { Pool } = pg;

// Konfiguracja połączenia z PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'football_profiles',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test połączenia
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

export { pool };

// Funkcja do wykonywania zapytań
export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Stworzenie schematów tabel
export async function ensureSchema() {
  console.log('Creating PostgreSQL schema...');

  try {
    // Tabela użytkowników
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        username VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        avatar_url TEXT,
        role VARCHAR(50) DEFAULT 'user',
        reputation INTEGER DEFAULT 0,
        provider VARCHAR(50),
        provider_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela piłkarzy
    await query(`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        team VARCHAR(255),
        position VARCHAR(100),
        nationality VARCHAR(100),
        age INTEGER,
        height VARCHAR(20),
        weight VARCHAR(20),
        market_value VARCHAR(50),
        biography TEXT,
        jersey_price INTEGER,
        jersey_available BOOLEAN DEFAULT true,
        jersey_image_url TEXT,
        image_url TEXT,
        team_logo TEXT,
        national_flag TEXT,
        category VARCHAR(100),
        deceased BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela statystyk piłkarzy
    await query(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(100) REFERENCES players(id) ON DELETE CASCADE UNIQUE,
        goals INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        matches INTEGER DEFAULT 0,
        trophies INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela osiągnięć piłkarzy
    await query(`
      CREATE TABLE IF NOT EXISTS player_achievements (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(100) REFERENCES players(id) ON DELETE CASCADE,
        achievement VARCHAR(255) NOT NULL,
        year INTEGER,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela zakupów
    await query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        player_id VARCHAR(100) REFERENCES players(id) ON DELETE CASCADE,
        jersey_price INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // DODANO: Tabele Forum
    await query(`
        CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255) UNIQUE, description TEXT, parent_id INTEGER);
        CREATE TABLE IF NOT EXISTS moderator_categories (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, category_id INTEGER, UNIQUE(user_id, category_id));
        CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title TEXT, content TEXT, category_id INTEGER, author_id INTEGER, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS post_comments (id SERIAL PRIMARY KEY, post_id INTEGER, author_id INTEGER, content TEXT, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS comment_ratings (id SERIAL PRIMARY KEY, comment_id INTEGER, user_id INTEGER, rating INTEGER, UNIQUE(comment_id, user_id));
        CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER, type VARCHAR(50), title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);

    // DODANO: Tabele Galerii
    await query(`
        CREATE TABLE IF NOT EXISTS gallery_images (id SERIAL PRIMARY KEY, filename TEXT NOT NULL, title TEXT NOT NULL, description TEXT, width INTEGER, height INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS gallery_collections (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS gallery_items (id SERIAL PRIMARY KEY, collection_id INTEGER NOT NULL REFERENCES gallery_collections (id) ON DELETE CASCADE, image_id INTEGER NOT NULL REFERENCES gallery_images (id) ON DELETE CASCADE, position INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);


    console.log('PostgreSQL schema created successfully');
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  }
}

/* ---------- USER FUNCTIONS ---------- */

export async function getUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getSubcategories(id) {
  const result = await query(`
        SELECT c.*, 
        (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) as post_count 
        FROM categories c 
        WHERE parent_id = $1
    `, [id]);
  return result.rows;
}

export async function getUserByProvider(provider, providerId) {
  const result = await query('SELECT * FROM users WHERE provider = $1 AND provider_id = $2', [provider, providerId]);
  return result.rows[0] || null;
}

export async function getUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function findUserByLogin(login) {
  const result = await query('SELECT * FROM users WHERE email = $1 OR username = $1', [login]);
  return result.rows[0] || null;
}

export async function existsUserByEmail(email) {
  const result = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  return result.rows.length > 0;
}

export async function existsUserByUsername(username) {
  const result = await query('SELECT 1 FROM users WHERE username = $1', [username]);
  return result.rows.length > 0;
}

export async function createLocalUser({ email, username, password, name }) {
  const bcrypt = (await import('bcrypt')).default;
  const password_hash = await bcrypt.hash(password, 10);

  const result = await query(`
    INSERT INTO users (email, username, password_hash, name, role, provider)
    VALUES ($1, $2, $3, $4, 'user', 'local')
    RETURNING *
  `, [email, username, password_hash, name]);

  return result.rows[0];
}

export async function createOrUpdateUserFromProvider(provider, userData) {
  const { id: providerId, email, username, displayName, name, avatar_url } = userData;

  // Sprawdź czy użytkownik już istnieje
  let user = await getUserByProvider(provider, providerId);

  if (user) {
    // Aktualizuj istniejącego użytkownika
    const result = await query(`
      UPDATE users SET 
        email = COALESCE($1, email),
        name = COALESCE($2, name),
        avatar_url = COALESCE($3, avatar_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE provider = $4 AND provider_id = $5
      RETURNING *
    `, [email, displayName || name, avatar_url, provider, providerId]);
    return result.rows[0];
  }

  // Utwórz nowego użytkownika
  const usernameToUse = username || (email && email.split('@')[0]) ||
    (displayName ? displayName.replace(/\s+/g, '').toLowerCase() : `${provider}_${providerId}`);

  const result = await query(`
    INSERT INTO users (email, username, name, avatar_url, provider, provider_id) 
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [email, usernameToUse, displayName || name, avatar_url, provider, providerId]);

  return result.rows[0];
}

export async function ensureSeedAdmin() {
  const existing = await getUserByEmail('admin@example.com');

  if (!existing) {
    const bcrypt = (await import('bcrypt')).default;
    const hash = await bcrypt.hash('admin1234', 10);

    await query(`
      INSERT INTO users (email, username, password_hash, name, role, provider) 
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['admin@example.com', 'admin', hash, 'Admin', 'admin', 'local']);
  }

  const modExisting = await getUserByEmail('moderator@example.com');
  if (!modExisting) {
    const bcrypt = (await import('bcrypt')).default;
    const hash = await bcrypt.hash('moderator1234', 10);
    await query(`
        INSERT INTO users (email, username, password_hash, name, role, provider) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['moderator@example.com', 'moderator', hash, 'Moderator', 'moderator', 'local']);
  }
}

/* ---------- PLAYERS FUNCTIONS ---------- */

export async function getPlayerById(playerId) {
  const playerResult = await query('SELECT * FROM players WHERE id = $1', [playerId]);
  const player = playerResult.rows[0];

  if (!player) return null;

  // Pobierz statystyki
  const statsResult = await query('SELECT * FROM player_stats WHERE player_id = $1', [playerId]);
  const stats = statsResult.rows[0] || { goals: 0, assists: 0, matches: 0, trophies: 0 };

  // Pobierz osiągnięcia
  const achievementsResult = await query('SELECT achievement FROM player_achievements WHERE player_id = $1 ORDER BY year DESC', [playerId]);
  const achievements = achievementsResult.rows.map(row => row.achievement);

  return {
    id: player.id,
    name: player.name,
    fullName: player.full_name,
    team: player.team,
    position: player.position,
    nationality: player.nationality,
    age: player.age,
    height: player.height,
    weight: player.weight,
    marketValue: player.market_value,
    biography: player.biography,
    jerseyPrice: player.jersey_price,
    jerseyAvailable: player.jersey_available,
    jerseyImageUrl: player.jersey_image_url,
    imageUrl: player.image_url,
    teamLogo: player.team_logo,
    nationalFlag: player.national_flag,
    category: player.category,
    stats,
    achievements
  };
}

export async function getPlayersByCategory(category) {
  let whereClause = '';
  let params = [];

  switch (category) {
    case 'gwiazdy':
      whereClause = `WHERE CAST(REPLACE(REPLACE(market_value, 'M €', ''), ',', '.') AS NUMERIC) >= 100 ORDER BY market_value DESC`;
      break;
    case 'ligi':
      whereClause = `WHERE team = ANY($1) ORDER BY name`;
      params = [['Manchester City', 'Real Madrid', 'Inter Miami CF']];
      break;
    case 'mlode-talenty':
      whereClause = `WHERE age <= 25 ORDER BY age`;
      break;
    case 'legendy':
      whereClause = `WHERE age >= 35 ORDER BY age DESC`;
      break;
    case 'pomocnicy':
      whereClause = `WHERE position = 'Pomocnik' ORDER BY name`;
      break;
    case 'napastnicy':
      whereClause = `WHERE position = 'Napastnik' ORDER BY name`;
      break;
    default:
      whereClause = `ORDER BY name`;
  }

  const result = await query(`SELECT * FROM players ${whereClause}`, params);
  const players = result.rows;

  const playersWithDetails = await Promise.all(players.map(async (player) => {
    const statsResult = await query('SELECT * FROM player_stats WHERE player_id = $1', [player.id]);
    const stats = statsResult.rows[0] || { goals: 0, assists: 0, matches: 0, trophies: 0 };

    const achievementsResult = await query('SELECT achievement FROM player_achievements WHERE player_id = $1 ORDER BY year DESC', [player.id]);
    const achievements = achievementsResult.rows.map(row => row.achievement);

    return {
      id: player.id,
      name: player.name,
      fullName: player.full_name,
      team: player.team,
      position: player.position,
      nationality: player.nationality,
      age: player.age,
      height: player.height,
      weight: player.weight,
      marketValue: player.market_value,
      biography: player.biography,
      jerseyPrice: player.jersey_price,
      jerseyAvailable: player.jersey_available,
      jerseyImageUrl: player.jersey_image_url,
      imageUrl: player.image_url,
      teamLogo: player.team_logo,
      nationalFlag: player.national_flag,
      category: player.category,
      stats,
      achievements
    };
  }));

  return playersWithDetails;
}

export async function getAllPlayers() {
  const result = await query('SELECT * FROM players ORDER BY name');
  return result.rows;
}

export async function createPlayer(playerData) {
  const result = await query(`
    INSERT INTO players (
      id, name, full_name, team, position, nationality, age, height, weight, 
      market_value, biography, jersey_price, jersey_available, jersey_image_url, image_url, 
      team_logo, national_flag, category
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING id
  `, [
    playerData.id,
    playerData.name,
    playerData.fullName,
    playerData.team,
    playerData.position,
    playerData.nationality,
    playerData.age,
    playerData.height,
    playerData.weight,
    playerData.marketValue,
    playerData.biography,
    playerData.jerseyPrice,
    playerData.jerseyAvailable,
    playerData.jerseyImageUrl,
    playerData.imageUrl,
    playerData.teamLogo,
    playerData.nationalFlag,
    playerData.category
  ]);

  return result.rows[0].id;
}

export async function createPlayerStats(playerId, stats) {
  await query(`
    INSERT INTO player_stats (player_id, goals, assists, matches, trophies)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (player_id) DO UPDATE SET
      goals = EXCLUDED.goals,
      assists = EXCLUDED.assists,
      matches = EXCLUDED.matches,
      trophies = EXCLUDED.trophies
  `, [playerId, stats.goals, stats.assists, stats.matches, stats.trophies]);
}

export async function addPlayerAchievement(playerId, achievement, year = null, description = null) {
  await query(`
    INSERT INTO player_achievements (player_id, achievement, year, description)
    VALUES ($1, $2, $3, $4)
  `, [playerId, achievement, year, description]);
}

export async function createPurchase(userId, playerId, jerseyPrice) {
  const result = await query(`
    INSERT INTO purchases (user_id, player_id, jersey_price)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [userId, playerId, jerseyPrice]);

  return result.rows[0].id;
}

export async function getUserPurchases(userId) {
  const result = await query(`
    SELECT p.*, pl.name as player_name, pl.team, pl.image_url as player_image
    FROM purchases p
    JOIN players pl ON p.player_id = pl.id
    WHERE p.user_id = $1
    ORDER BY p.purchase_date DESC
  `, [userId]);

  return result.rows;
}

export async function updatePurchaseStatus(id, s) {
  await query('UPDATE purchases SET status=$1 WHERE id=$2', [s, id]);
  return { changes: 1 };
}

// DODANO: Funkcje Forum
export async function getAllCategories() {
  const result = await query(`
        SELECT c.*, 
        (
            SELECT COUNT(*) FROM posts p 
            WHERE p.category_id = c.id 
            OR p.category_id IN (SELECT sub.id FROM categories sub WHERE sub.parent_id = c.id)
        ) as post_count 
        FROM categories c
    `);
  return result.rows;
}
export async function createCategory(n, s, d, p) {
  const result = await query('INSERT INTO categories (name, slug, description, parent_id) VALUES ($1, $2, $3, $4) RETURNING id', [n, s, d, p]);
  return result.rows[0];
}
export async function updateCategory(id, n, s, d) {
  await query('UPDATE categories SET name=$1, slug=$2, description=$3 WHERE id=$4', [n, s, d, id]);
  return { changes: 1 };
}
export async function deleteCategory(id) {
  await query('DELETE FROM posts WHERE category_id=$1', [id]);
  await query('DELETE FROM categories WHERE id=$1', [id]);
  return { changes: 1 };
}

export async function getCategoryModerators(id) {
  const result = await query(`
        SELECT u.id, u.username, u.name, u.email
        FROM moderator_categories mc
        JOIN users u ON mc.user_id = u.id
        WHERE mc.category_id = $1
    `, [id]);
  return result.rows;
}
export async function assignModeratorToCategory(u, c) {
  try {
    const result = await query('INSERT INTO moderator_categories (user_id, category_id) VALUES ($1, $2) RETURNING id', [u, c]);
    return result.rows[0];
  } catch (e) {
    if (e.code === '23505') return { changes: 0 }; // Unique violation
    throw e;
  }
}
export async function removeModeratorFromCategory(u, c) {
  await query('DELETE FROM moderator_categories WHERE user_id=$1 AND category_id=$2', [u, c]);
  return { changes: 1 };
}

export async function getAllPosts(limit, offset) {
  const result = await query(`
        SELECT p.*, u.username as author_username, c.name as category_name, 
        (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id AND status='approved') as comment_count
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.status = 'approved' 
        ORDER BY p.created_at DESC 
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
  return result.rows;
}

export async function getPostsByCategory(catId, limit, offset) {
  const result = await query(`
        SELECT p.*, u.username as author_username, c.name as category_name,
        (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id AND status='approved') as comment_count
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.category_id = $1 AND p.status = 'approved' 
        ORDER BY p.created_at DESC 
        LIMIT $2 OFFSET $3
    `, [catId, limit, offset]);
  return result.rows;
}

export async function getPostById(id) {
  const result = await query(`
        SELECT p.*, u.username as author_username, c.name as category_name 
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = $1
    `, [id]);
  return result.rows[0];
}

export async function createPost(t, c, cat, aut, stat) {
  const result = await query('INSERT INTO posts (title, content, category_id, author_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id', [t, c, cat, aut, stat]);
  return result.rows[0];
}
export async function updatePost(id, t, c, cat) {
  await query('UPDATE posts SET title=$1, content=$2, category_id=$3 WHERE id=$4', [t, c, cat, id]);
  return { changes: 1 };
}
export async function approvePost(id) { await query("UPDATE posts SET status='approved' WHERE id=$1", [id]); return { changes: 1 }; }
export async function rejectPost(id) { await query("UPDATE posts SET status='rejected' WHERE id=$1", [id]); return { changes: 1 }; }
export async function deletePost(id) { await query("DELETE FROM posts WHERE id=$1", [id]); return { changes: 1 }; }
export async function getPendingPosts() {
  const result = await query("SELECT p.*, c.name as category_name, u.username as author_username FROM posts p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN users u ON p.author_id=u.id WHERE p.status='pending' ORDER BY p.created_at DESC");
  return result.rows;
}

export async function getPostComments(pid, userId) {
  const result = await query(`
        SELECT pc.*, u.username as author_username, 
        (SELECT COUNT(*) FROM comment_ratings WHERE comment_id = pc.id AND rating = 1) as likes,
        (SELECT COUNT(*) FROM comment_ratings WHERE comment_id = pc.id AND rating = -1) as dislikes,
        (SELECT rating FROM comment_ratings WHERE comment_id = pc.id AND user_id = $1) as user_vote
        FROM post_comments pc 
        LEFT JOIN users u ON pc.author_id=u.id 
        WHERE post_id=$2 AND status='approved'
        ORDER BY pc.created_at DESC
    `, [userId || -1, pid]);
  return result.rows;
}
export async function createComment(pid, c, aid) {
  const user = await getUserById(aid);
  const status = (user.role === 'admin' || user.role === 'moderator') ? 'approved' : 'pending';
  const result = await query("INSERT INTO post_comments (post_id, content, author_id, status) VALUES ($1, $2, $3, $4) RETURNING id", [pid, c, aid, status]);
  return result.rows[0];
}
export async function getCommentById(id) {
  const result = await query("SELECT * FROM post_comments WHERE id=$1", [id]);
  return result.rows[0];
}

export async function updateComment(id, content) {
  await query("UPDATE post_comments SET content=$1 WHERE id=$2", [content, id]);
  return { changes: 1 };
}
export async function approveComment(id) { await query("UPDATE post_comments SET status='approved' WHERE id=$1", [id]); return { changes: 1 }; }
export async function rejectComment(id) { await query("UPDATE post_comments SET status='rejected' WHERE id=$1", [id]); return { changes: 1 }; }
export async function deleteComment(id) { await query("DELETE FROM post_comments WHERE id=$1", [id]); return { changes: 1 }; }

export async function getPendingComments() {
  const result = await query(`
        SELECT pc.*, u.username as author_username, p.title as post_title, c.name as category_name
        FROM post_comments pc 
        LEFT JOIN users u ON pc.author_id=u.id
        LEFT JOIN posts p ON pc.post_id=p.id
        LEFT JOIN categories c ON p.category_id=c.id
        WHERE pc.status='pending'
        ORDER BY pc.created_at DESC
    `);
  return result.rows;
}

export async function rateComment(cid, uid, r) {
  const existing = await query("SELECT rating FROM comment_ratings WHERE comment_id=$1 AND user_id=$2", [cid, uid]);
  if (existing.rows.length > 0) {
    if (existing.rows[0].rating === r) {
      await query("DELETE FROM comment_ratings WHERE comment_id=$1 AND user_id=$2", [cid, uid]);
    } else {
      await query("UPDATE comment_ratings SET rating=$1 WHERE comment_id=$2 AND user_id=$3", [r, cid, uid]);
    }
  } else {
    await query("INSERT INTO comment_ratings (comment_id, user_id, rating) VALUES ($1, $2, $3)", [cid, uid, r]);
  }
}

// DODANO: Funkcje Powiadomień
export async function createNotification(userId, type, title, message, link) {
  if (userId === null) return;
  await query('INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5)', [userId, type, title, message, link]);
}

export async function getUserNotifications(userId) {
  const result = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [userId]);
  return result.rows;
}
export async function markNotificationAsRead(id) {
  await query('UPDATE notifications SET is_read=1 WHERE id=$1', [id]);
  return { changes: 1 };
}
export async function markAllNotificationsAsRead(userId) {
  await query('UPDATE notifications SET is_read=1 WHERE user_id=$1', [userId]);
  return { changes: 1 };
}

// DODANO: Funkcje Galerii
export async function createGalleryImage(d) {
  const result = await query(`
      INSERT INTO gallery_images (filename, title, description, width, height) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [d.filename, d.title, d.description, d.width, d.height]);
  return result.rows[0].id;
}

export async function getAllGalleryImages() {
  const result = await query('SELECT * FROM gallery_images ORDER BY created_at DESC');
  return result.rows;
}

export async function getGalleryImageById(id) {
  const result = await query('SELECT * FROM gallery_images WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function deleteGalleryImage(id) {
  await query('DELETE FROM gallery_items WHERE image_id = $1', [id]);
  await query('DELETE FROM gallery_images WHERE id = $1', [id]);
  return { changes: 1 };
}

export async function createGalleryCollection(d) {
  const result = await query(`
      INSERT INTO gallery_collections (name, description) 
      VALUES ($1, $2)
      RETURNING id
    `, [d.name, d.description]);
  return result.rows[0].id;
}

export async function getAllGalleryCollections() {
  const result = await query('SELECT * FROM gallery_collections ORDER BY created_at DESC');
  return result.rows;
}

export async function getGalleryCollectionById(id) {
  const result = await query('SELECT * FROM gallery_collections WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getActiveGalleryCollection() {
  const result = await query('SELECT * FROM gallery_collections WHERE is_active = 1', []);
  return result.rows[0] || null;
}

export async function setActiveGalleryCollection(id) {
  await query('UPDATE gallery_collections SET is_active = 0', []);
  await query('UPDATE gallery_collections SET is_active = 1 WHERE id = $1', [id]);
}

export async function deleteGalleryCollection(id) {
  await query('DELETE FROM gallery_items WHERE collection_id = $1', [id]);
  await query('DELETE FROM gallery_collections WHERE id = $1', [id]);
  return { changes: 1 };
}

export async function addImageToCollection(d) {
  const result = await query(`
        INSERT INTO gallery_items (collection_id, image_id, position) 
        VALUES ($1, $2, $3)
        RETURNING id
    `, [d.collection_id, d.image_id, d.position]);
  return result.rows[0].id;
}

export async function getCollectionItems(id) {
  const result = await query(`
        SELECT gi.*, i.filename, i.title, i.description
        FROM gallery_items gi 
        JOIN gallery_images i ON gi.image_id = i.id 
        WHERE collection_id = $1
        ORDER BY position
    `, [id]);
  return result.rows;
}

export async function removeImageFromCollection(id) {
  await query('DELETE FROM gallery_items WHERE id = $1', [id]);
  return { changes: 1 };
}

export async function reorderCollectionItems(collectionId, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query('UPDATE gallery_items SET position = $1 WHERE id = $2 AND collection_id = $3', [item.position, item.itemId, collectionId]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}