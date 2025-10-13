import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = new Database(path.join(__dirname, 'app.sqlite'));

export function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      provider TEXT,           -- 'local' | 'google' | 'github'
      provider_id TEXT,        -- provider user id
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export async function ensureSeedAdmin() {
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com');
  if (!row) {
    const bcrypt = (await import('bcrypt')).default;
    const hash = await bcrypt.hash('admin1234', 10);
    db.prepare(`INSERT INTO users (email, username, password_hash, name, role, provider) 
                VALUES (@email, @username, @password_hash, @name, @role, @provider)`)
      .run({ email: 'admin@example.com', username: 'admin', password_hash: hash, name: 'Admin', role: 'admin', provider: 'local' });
    console.log('Seeded admin user: admin@example.com / admin1234');
  }
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// SQLi-resistant lookups: parameter binding only
export async function findUserByLogin(login) {
  // try email, then username
  let user = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(login);
  if (!user) user = db.prepare('SELECT * FROM users WHERE username = ? LIMIT 1').get(login);
  return user || null;
}

export function getUserByProvider(provider, providerId) {
  return db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export async function createOrUpdateUserFromProvider(provider, profile) {
  // profile: {id, displayName, emails[], photos[]}
  const providerId = String(profile.id);
  let user = getUserByProvider(provider, providerId);
  if (user) return user;

  // If email exists, link account
  const email = (profile.emails && profile.emails[0] && profile.emails[0].value) ? profile.emails[0].value : null;
  const name = profile.displayName || (profile.username ? profile.username : null);
  const avatar = (profile.photos && profile.photos[0] && profile.photos[0].value) ? profile.photos[0].value : null;

  if (email) {
    const existing = getUserByEmail(email);
    if (existing) {
      db.prepare('UPDATE users SET provider = ?, provider_id = ?, name = COALESCE(name, ?), avatar_url = COALESCE(avatar_url, ?), updated_at = datetime(\'now\') WHERE id = ?')
        .run(provider, providerId, name, avatar, existing.id);
      return getUserById(existing.id);
    }
  }

  // Create new
  const username = (email && email.split('@')[0]) || (name ? name.replace(/\s+/g, '').toLowerCase() : `${provider}_${providerId}`);
  const info = db.prepare(`INSERT INTO users (email, username, name, avatar_url, provider, provider_id) 
                           VALUES (@email, @username, @name, @avatar_url, @provider, @provider_id)`)
                 .run({ email, username, name, avatar_url: avatar, provider, provider_id: providerId });
  return getUserById(info.lastInsertRowid);
}
// Sprawdzenia unikalności
export function existsUserByEmail(email) {
  return db.prepare('SELECT 1 FROM users WHERE email = ?').get(email) ? true : false;
}
export function existsUserByUsername(username) {
  return db.prepare('SELECT 1 FROM users WHERE username = ?').get(username) ? true : false;
}

// Utworzenie użytkownika lokalnego (z hasłem)
export async function createLocalUser({ email, username, password, name }) {
  const bcrypt = (await import('bcrypt')).default;
  const password_hash = await bcrypt.hash(password, 10);

  const info = db.prepare(`
    INSERT INTO users (email, username, password_hash, name, role, provider)
    VALUES (@email, @username, @password_hash, @name, 'user', 'local')
  `).run({ email, username, password_hash, name });

  return getUserById(info.lastInsertRowid);
}
