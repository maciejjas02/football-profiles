import Database from 'better-sqlite3';
import { pool, query } from './db-postgres.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skrypt migracji danych z SQLite do PostgreSQL
async function migrateSQLiteToPostgreSQL() {
  console.log('Starting migration from SQLite to PostgreSQL...');
  
  try {
    // Połącz z SQLite
    const sqliteDb = new Database(path.join(__dirname, 'app.sqlite'));
    
    // Sprawdź połączenie z PostgreSQL
    await query('SELECT 1');
    console.log('Connected to PostgreSQL');
    
    // Migracja użytkowników
    console.log('Migrating users...');
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    
    for (const user of users) {
      try {
        await query(`
          INSERT INTO users (id, email, username, password_hash, name, avatar_url, role, provider, provider_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          user.id, user.email, user.username, user.password_hash, user.name,
          user.avatar_url, user.role, user.provider, user.provider_id,
          user.created_at, user.updated_at
        ]);
      } catch (err) {
        console.warn(`Failed to migrate user ${user.email}:`, err.message);
      }
    }
    console.log(`Migrated ${users.length} users`);
    
    // Migracja piłkarzy
    console.log('Migrating players...');
    const players = sqliteDb.prepare('SELECT * FROM players').all();
    
    for (const player of players) {
      try {
        await query(`
          INSERT INTO players (id, name, full_name, team, position, nationality, age, height, weight, market_value, biography, jersey_price, jersey_available, image_url, team_logo, national_flag, category, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (id) DO NOTHING
        `, [
          player.id, player.name, player.full_name, player.team, player.position,
          player.nationality, player.age, player.height, player.weight, player.market_value,
          player.biography, player.jersey_price, player.jersey_available, player.image_url,
          player.team_logo, player.national_flag, player.category, player.created_at, player.updated_at
        ]);
      } catch (err) {
        console.warn(`Failed to migrate player ${player.name}:`, err.message);
      }
    }
    console.log(`Migrated ${players.length} players`);
    
    // Migracja statystyk piłkarzy
    console.log('Migrating player stats...');
    const playerStats = sqliteDb.prepare('SELECT * FROM player_stats').all();
    
    for (const stats of playerStats) {
      try {
        await query(`
          INSERT INTO player_stats (player_id, goals, assists, matches, trophies, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (player_id) DO UPDATE SET
            goals = EXCLUDED.goals,
            assists = EXCLUDED.assists,
            matches = EXCLUDED.matches,
            trophies = EXCLUDED.trophies
        `, [
          stats.player_id, stats.goals, stats.assists, stats.matches, stats.trophies, stats.created_at
        ]);
      } catch (err) {
        console.warn(`Failed to migrate stats for player ${stats.player_id}:`, err.message);
      }
    }
    console.log(`Migrated ${playerStats.length} player stats`);
    
    // Migracja osiągnięć piłkarzy
    console.log('Migrating player achievements...');
    const achievements = sqliteDb.prepare('SELECT * FROM player_achievements').all();
    
    for (const achievement of achievements) {
      try {
        await query(`
          INSERT INTO player_achievements (player_id, achievement, year, description, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          achievement.player_id, achievement.achievement, achievement.year, 
          achievement.description, achievement.created_at
        ]);
      } catch (err) {
        console.warn(`Failed to migrate achievement for player ${achievement.player_id}:`, err.message);
      }
    }
    console.log(`Migrated ${achievements.length} achievements`);
    
    // Migracja zakupów
    console.log('Migrating purchases...');
    const purchases = sqliteDb.prepare('SELECT * FROM purchases').all();
    
    for (const purchase of purchases) {
      try {
        await query(`
          INSERT INTO purchases (user_id, player_id, jersey_price, purchase_date)
          VALUES ($1, $2, $3, $4)
        `, [
          purchase.user_id, purchase.player_id, purchase.jersey_price, purchase.purchase_date
        ]);
      } catch (err) {
        console.warn(`Failed to migrate purchase:`, err.message);
      }
    }
    console.log(`Migrated ${purchases.length} purchases`);
    
    // Zamknij połączenia
    sqliteDb.close();
    await pool.end();
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Uruchom migrację jeśli plik jest wywołany bezpośrednio
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateSQLiteToPostgreSQL();
}

export { migrateSQLiteToPostgreSQL };