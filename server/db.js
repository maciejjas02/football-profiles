import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = new Database(path.join(__dirname, 'app.sqlite'));

export function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = 10000;
    PRAGMA temp_store = MEMORY;
    
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

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

    CREATE TABLE IF NOT EXISTS clubs (
      id TEXT PRIMARY KEY,     -- np. 'manchester-city'
      name TEXT NOT NULL,      -- 'Manchester City'
      full_name TEXT,          -- 'Manchester City Football Club'
      country TEXT,            -- 'Anglia'
      league TEXT,             -- 'Premier League'
      founded INTEGER,         -- 1880
      stadium TEXT,            -- 'Etihad Stadium'
      logo_url TEXT,           -- URL do logo klubu
      primary_color TEXT,      -- '#6CABDD'
      secondary_color TEXT,    -- '#FFFFFF'
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_clubs_league ON clubs(league);
    CREATE INDEX IF NOT EXISTS idx_clubs_country ON clubs(country);

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,     -- np. 'lionel-messi'
      name TEXT NOT NULL,      -- 'Lionel Messi'
      full_name TEXT,          -- 'Lionel Andrés Messi'
      club_id TEXT,            -- 'inter-miami' - referencja do tabeli clubs
      team TEXT,               -- DEPRECATED - zostaw dla kompatybilności
      position TEXT,           -- 'Napastnik'
      nationality TEXT,        -- 'Argentyna'
      age INTEGER,
      height TEXT,             -- '1.70m'
      weight TEXT,             -- '67kg'
      market_value TEXT,       -- '25M €'
      biography TEXT,
      jersey_price INTEGER,    -- 299
      jersey_available BOOLEAN DEFAULT 1,
      jersey_image_url TEXT,   -- URL do zdjęcia koszulki
      image_url TEXT,
      team_logo TEXT,          -- DEPRECATED - pobieraj z clubs.logo_url
      national_flag TEXT,
      category TEXT,           -- 'top-players', 'legends', etc.
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (club_id) REFERENCES clubs (id)
    );

    CREATE INDEX IF NOT EXISTS idx_players_club ON players(club_id);
    CREATE INDEX IF NOT EXISTS idx_players_category ON players(category);
    CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);

    CREATE TABLE IF NOT EXISTS player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      matches INTEGER DEFAULT 0,
      trophies INTEGER DEFAULT 0,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_stats(player_id);

    CREATE TABLE IF NOT EXISTS player_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      achievement TEXT NOT NULL,
      year INTEGER,
      description TEXT,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      jersey_price INTEGER,
      purchase_date TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'completed',
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_player ON purchases(player_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
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

export function getUserByProvider(provider, providerId) {
  return db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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

// Znajdź użytkownika po loginie (email lub nazwa użytkownika)
export function findUserByLogin(login) {
  return db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(login, login);
}

// Utwórz lub zaktualizuj użytkownika z providera OAuth
export function createOrUpdateUserFromProvider(provider, userData) {
  const { id: providerId, email, username, displayName, name, avatar_url } = userData;
  
  // Sprawdź czy użytkownik już istnieje
  let user = getUserByProvider(provider, providerId);
  
  if (user) {
    // Aktualizuj istniejącego użytkownika
    db.prepare(`UPDATE users SET 
      email = COALESCE(@email, email),
      name = COALESCE(@name, name),
      avatar_url = COALESCE(@avatar_url, avatar_url)
      WHERE provider = @provider AND provider_id = @provider_id`)
      .run({ 
        email, 
        name: displayName || name, 
        avatar_url, 
        provider, 
        provider_id: providerId 
      });
    return getUserByProvider(provider, providerId);
  }
  
  // Utwórz nowego użytkownika
  const usernameToUse = username || (email && email.split('@')[0]) || 
    (displayName ? displayName.replace(/\s+/g, '').toLowerCase() : `${provider}_${providerId}`);
  
  const info = db.prepare(`INSERT INTO users (email, username, name, avatar_url, provider, provider_id) 
                           VALUES (@email, @username, @name, @avatar_url, @provider, @provider_id)`)
                 .run({ 
                   email, 
                   username: usernameToUse, 
                   name: displayName || name, 
                   avatar_url, 
                   provider, 
                   provider_id: providerId 
                 });
  return getUserById(info.lastInsertRowid);
}

/* ---------- PLAYERS FUNCTIONS ---------- */

// Pobierz piłkarza po ID
export function getPlayerById(playerId) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) return null;

  // Pobierz statystyki
  const stats = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(playerId) || 
    { goals: 0, assists: 0, matches: 0, trophies: 0 };

  // Pobierz osiągnięcia
  const achievements = db.prepare('SELECT achievement FROM player_achievements WHERE player_id = ? ORDER BY year DESC')
    .all(playerId).map(row => row.achievement);

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

// Pobierz wszystkich piłkarzy z kategorii
export function getPlayersByCategory(category) {
  let players = [];
  
  switch(category) {
    
    case 'top-players':
      // Wysokie wartości rynkowe (100M+ EUR)
      players = db.prepare("SELECT * FROM players WHERE category = 'top-players' ORDER BY age").all();
      break;
    case 'ligi':
      players = db.prepare("SELECT * FROM players WHERE team IN ('Manchester City', 'Real Madrid', 'Inter Miami CF') ORDER BY name").all();
      break;
    case 'talenty':
    case 'new-talents':
    case 'mlode-talenty':
      players = db.prepare("SELECT * FROM players WHERE category = 'new-talents' ORDER BY age").all();
      break;
    case 'legendy':
      players = db.prepare('SELECT * FROM players WHERE age >= 35 ORDER BY age DESC').all();
      break;
    case 'bramkarze':
    case 'goalkeepers':
      players = db.prepare("SELECT * FROM players WHERE position = 'Bramkarz' ORDER BY name").all();
      break;
    case 'napastnicy':
      players = db.prepare("SELECT * FROM players WHERE position = 'Napastnik' ORDER BY name").all();
      break;
    case 'pomocnicy':
      players = db.prepare("SELECT * FROM players WHERE position = 'Pomocnik' ORDER BY name").all();
      break;
    default:
      players = db.prepare('SELECT * FROM players ORDER BY name').all();
  }
  
  // Dla każdego piłkarza dodaj pełne dane
  return players.map(player => {
    const stats = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(player.id) || 
      { goals: 0, assists: 0, matches: 0, trophies: 0 };
    
    const achievements = db.prepare('SELECT achievement FROM player_achievements WHERE player_id = ? ORDER BY year DESC')
      .all(player.id).map(row => row.achievement);
    
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
  });
}

// Pobierz wszystkich piłkarzy
export function getAllPlayers() {
  return db.prepare('SELECT * FROM players ORDER BY name').all();
}

// Dodaj piłkarza
export function createPlayer(playerData) {
  // Mapowanie właściwości obiektu na kolumny bazy danych
  const mappedData = {
    id: playerData.id,
    name: playerData.name,
    full_name: playerData.fullName,
    club_id: playerData.clubId,
    team: playerData.team,
    position: playerData.position,
    nationality: playerData.nationality,
    age: playerData.age,
    height: playerData.height,
    weight: playerData.weight,
    market_value: playerData.marketValue,
    biography: playerData.biography,
    jersey_price: playerData.jerseyPrice,
    jersey_available: playerData.jerseyAvailable ? 1 : 0,
    jersey_image_url: playerData.jerseyImageUrl,
    image_url: playerData.imageUrl,
    team_logo: playerData.teamLogo,
    national_flag: playerData.nationalFlag,
    category: playerData.category
  };

  const info = db.prepare(`
    INSERT INTO players (
      id, name, full_name, club_id, team, position, nationality, age, height, weight, 
      market_value, biography, jersey_price, jersey_available, jersey_image_url, image_url, 
      team_logo, national_flag, category
    ) VALUES (
      @id, @name, @full_name, @club_id, @team, @position, @nationality, @age, @height, @weight,
      @market_value, @biography, @jersey_price, @jersey_available, @jersey_image_url, @image_url,
      @team_logo, @national_flag, @category
    )
  `).run(mappedData);

  return info.lastInsertRowid;
}

// Dodaj statystyki piłkarza
export function createPlayerStats(playerId, stats) {
  return db.prepare(`
    INSERT OR REPLACE INTO player_stats (player_id, goals, assists, matches, trophies)
    VALUES (@playerId, @goals, @assists, @matches, @trophies)
  `).run({ playerId, ...stats });
}

// Dodaj osiągnięcie piłkarza
export function addPlayerAchievement(playerId, achievement, year = null, description = null) {
  return db.prepare(`
    INSERT INTO player_achievements (player_id, achievement, year, description)
    VALUES (@playerId, @achievement, @year, @description)
  `).run({ playerId, achievement, year, description });
}

// Dodaj zakup koszulki
export function createPurchase(userId, playerId, jerseyPrice) {
  return db.prepare(`
    INSERT INTO purchases (user_id, player_id, jersey_price)
    VALUES (@userId, @playerId, @jerseyPrice)
  `).run({ userId, playerId, jerseyPrice });
}

// Pobierz zakupy użytkownika
export function getUserPurchases(userId) {
  return db.prepare(`
    SELECT p.*, pl.name as player_name, pl.team, pl.image_url as player_image
    FROM purchases p
    JOIN players pl ON p.player_id = pl.id
    WHERE p.user_id = ?
    ORDER BY p.purchase_date DESC
  `).all(userId);
}

// Seed klubów
export function ensureSeedClubs() {
  const existingClubs = db.prepare('SELECT COUNT(*) as count FROM clubs').get();
  if (existingClubs.count > 0) return; // Kluby już istnieją

  console.log('Seeding clubs...');

  const clubs = [
    {
      id: 'manchester-city',
      name: 'Manchester City',
      fullName: 'Manchester City Football Club',
      country: 'Anglia',
      league: 'Premier League',
      founded: 1880,
      stadium: 'Etihad Stadium',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/281.png?lm=1467356331',
      primaryColor: '#6CABDD',
      secondaryColor: '#FFFFFF'
    },
    {
      id: 'inter-miami',
      name: 'Inter Miami CF',
      fullName: 'Club Internacional de Fútbol Miami',
      country: 'USA',
      league: 'MLS',
      founded: 2018,
      stadium: 'DRV PNK Stadium',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/12237.png?lm=1580585439',
      primaryColor: '#F7B5CD',
      secondaryColor: '#231F20'
    },
    {
      id: 'al-nassr',
      name: 'Al Nassr FC',
      fullName: 'Al-Nassr Football Club',
      country: 'Arabia Saudyjska',
      league: 'Saudi Pro League',
      founded: 1955,
      stadium: 'Al-Awwal Park',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/898.png?lm=1448911445',
      primaryColor: '#FFD700',
      secondaryColor: '#0000FF'
    },
    {
      id: 'real-madrid',
      name: 'Real Madrid',
      fullName: 'Real Madrid Club de Fútbol',
      country: 'Hiszpania',
      league: 'La Liga',
      founded: 1902,
      stadium: 'Santiago Bernabéu',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/418.png?lm=1403873126',
      primaryColor: '#FFFFFF',
      secondaryColor: '#FFD700'
    },
    {
      id: 'fc-barcelona',
      name: 'FC Barcelona',
      fullName: 'Futbol Club Barcelona',
      country: 'Hiszpania',
      league: 'La Liga',
      founded: 1899,
      stadium: 'Camp Nou',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/131.png?lm=1406739548',
      primaryColor: '#A50044',
      secondaryColor: '#004D98'
    },
    {
      id: 'bayern-munich',
      name: 'Bayern Munich',
      fullName: 'FC Bayern München',
      country: 'Niemcy',
      league: 'Bundesliga',
      founded: 1900,
      stadium: 'Allianz Arena',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/27.png?lm=1498251238',
      primaryColor: '#DC052D',
      secondaryColor: '#FFFFFF'
    },
    {
      id: 'liverpool',
      name: 'Liverpool',
      fullName: 'Liverpool Football Club',
      country: 'Anglia',
      league: 'Premier League',
      founded: 1892,
      stadium: 'Anfield',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/31.png?lm=1456567819',
      primaryColor: '#C8102E',
      secondaryColor: '#FFFFFF'
    },
    {
      id: 'psg',
      name: 'PSG',
      fullName: 'Paris Saint-Germain Football Club',
      country: 'Francja',
      league: 'Ligue 1',
      founded: 1970,
      stadium: 'Parc des Princes',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/583.png?lm=1522312265',
      primaryColor: '#004170',
      secondaryColor: '#E30613'
    },
    {
      id: 'bayer-leverkusen',
      name: 'Bayer Leverkusen',
      fullName: 'Bayer 04 Leverkusen',
      country: 'Niemcy',
      league: 'Bundesliga',
      founded: 1904,
      stadium: 'BayArena',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/15.png?lm=1406739261',
      primaryColor: '#E32221',
      secondaryColor: '#000000'
    },
    {
      id: 'ssc-napoli',
      name: 'SSC Napoli',
      fullName: 'Società Sportiva Calcio Napoli',
      country: 'Włochy',
      league: 'Serie A',
      founded: 1926,
      stadium: 'Stadio Diego Armando Maradona',
      logoUrl: 'https://tmssl.akamaized.net//images/wappen/head/6195.png?lm=1753167643',
      primaryColor: '#007FFF',
      secondaryColor: '#FFFFFF'
    }
  ];

  const insertClub = db.prepare(`
    INSERT INTO clubs (id, name, full_name, country, league, founded, stadium, logo_url, primary_color, secondary_color)
    VALUES (@id, @name, @fullName, @country, @league, @founded, @stadium, @logoUrl, @primaryColor, @secondaryColor)
  `);

  clubs.forEach(club => {
    insertClub.run(club);
  });

  console.log(`Seeded ${clubs.length} clubs`);
}

// Seed piłkarzy
export function ensureSeedPlayers() {
  // Idempotent seeding: always attempt to seed using INSERT OR IGNORE
  // This allows adding new players (e.g., new categories) without wiping the table
  const existingPlayers = db.prepare('SELECT COUNT(*) as count FROM players').get();
  if (existingPlayers.count > 0) {
    console.log(`Players already exist (${existingPlayers.count}) — running idempotent seed to add any missing records...`);
  }

  console.log('Seeding players...');

  const players = [
    {
      id: 'lionel-messi',
      name: 'Lionel Messi',
      fullName: 'Lionel Andrés Messi',
      team: 'Inter Miami CF',
      position: 'Napastnik',
      nationality: 'Argentyna',
      age: 36,
      height: '1.70m',
      weight: '67kg',
      marketValue: '25M €',
      biography: 'Lionel Messi, urodzony 24 czerwca 1987 roku w Rosario w Argentynie, to jeden z najlepszych piłkarzy w historii futbolu. Od młodości wykazywał niezwykły talent, który doprowadził go do FC Barcelony, gdzie spędził większość swojej kariery.',
      jerseyPrice: 299,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://shop.intermiamicf.com/cdn/shop/files/7048MMPIMJSP24_P1.jpg?v=1706810024&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-043_%28cropped%29.jpg',
      teamLogo: '/images/teams/inter-miami.png',
      nationalFlag: '/images/flags/argentina.png',
      category: 'top-players',
      stats: { goals: 808, assists: 374, matches: 1003, trophies: 44 },
      achievements: ['8x Złota Piłka', 'Mistrz Świata 2022', '4x Liga Mistrzów', '10x La Liga', 'Copa América 2021']
    },
    {
      id: 'cristiano-ronaldo',
      name: 'Cristiano Ronaldo',
      fullName: 'Cristiano Ronaldo dos Santos Aveiro',
      team: 'Al Nassr FC',
      position: 'Napastnik',
      nationality: 'Portugalia',
      age: 39,
      height: '1.87m',
      weight: '84kg',
      marketValue: '15M €',
      biography: 'Cristiano Ronaldo, urodzony 5 lutego 1985 roku na Maderze, to portugalski piłkarz uważany za jednego z najlepszych w historii. Znany ze swojej dedykacji, atletyzmu i niesamowitej skuteczności bramkowej.',
      jerseyPrice: 279,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://www.alnassrstore.com/cdn/shop/files/CR7_HOME_SHIRT_24_25_1_600x.jpg?v=1720012374',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis%2C_September_2023_%28cropped%29.jpg',
      teamLogo: '/images/teams/al-nassr.png',
      nationalFlag: '/images/flags/portugal.png',
      category: 'top-players',
      stats: { goals: 895, assists: 245, matches: 1198, trophies: 34 },
      achievements: ['5x Złota Piłka', '5x Liga Mistrzów', 'Euro 2016', '3x Premier League', '2x Serie A']
    },
    {
      id: 'kylian-mbappe',
      name: 'Kylian Mbappé',
      fullName: 'Kylian Mbappé Lottin',
      team: 'Real Madrid',
      position: 'Napastnik',
      nationality: 'Francja',
      age: 25,
      height: '1.78m',
      weight: '73kg',
      marketValue: '180M €',
      biography: 'Kylian Mbappé, urodzony 20 grudnia 1998 roku w Paryżu, to francuski napastnik znany ze swojej niesamowitej szybkości i skuteczności. Uważany za następcę Messi i Ronaldo.',
      jerseyPrice: 259,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/57/2019-07-17_SG_Dynamo_Dresden_vs._Paris_Saint-Germain_by_Sandro_Halank%E2%80%93129_%28cropped%29.jpg',
      teamLogo: '/images/teams/real-madrid.png',
      nationalFlag: '/images/flags/france.png',
      category: 'top-players',
      stats: { goals: 300, assists: 120, matches: 380, trophies: 8 },
      achievements: ['Mistrz Świata 2018', '7x Ligue 1', 'Liga Narodów 2021', 'Złoty But Ligue 1', 'Król strzelców MŚ 2022']
    },
    {
      id: 'erling-haaland',
      name: 'Erling Haaland',
      fullName: 'Erling Braut Haaland',
      team: 'Manchester City',
      position: 'Napastnik',
      nationality: 'Norwegia',
      age: 24,
      height: '1.95m',
      weight: '88kg',
      marketValue: '170M €',
      biography: 'Erling Haaland, urodzony 21 lipca 2000 roku w Leeds, to norweski napastnik znany ze swojej siły fizycznej i niesamowitej skuteczności bramkowej. Uważany za przyszłość światowego futbolu.',
      jerseyPrice: 239,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://shop.mancity.com/dw/image/v2/BDWJ_PRD/on/demandware.static/-/Sites-master-catalog-MAN/default/dwc8b67e7a/images/large/701225359002_pp_01_mcfc.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Norway_Italy_-_June_2025_E_07.jpg',
      teamLogo: '/images/teams/manchester-city.png',
      nationalFlag: '/images/flags/norway.png',
      category: 'top-players',
      stats: { goals: 250, assists: 45, matches: 280, trophies: 5 },
      achievements: ['Premier League 2023', 'Liga Mistrzów 2023', 'Złoty But Premier League', 'Młody Piłkarz Roku UEFA', 'Król strzelców LM 2023']
    },
    {
      id: 'robert-lewandowski',
      name: 'Robert Lewandowski',
      fullName: 'Robert Lewandowski',
      team: 'FC Barcelona',
      position: 'Napastnik',
      nationality: 'Polska',
      age: 35,
      height: '1.85m',
      weight: '81kg',
      marketValue: '15M €',
      biography: 'Robert Lewandowski, urodzony 21 sierpnia 1988 roku w Warszawie, to polski napastnik, jeden z najlepszych strzelców w historii futbolu. Kapitan reprezentacji Polski i ikona polskiego sportu.',
      jerseyPrice: 219,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.fcbarcelona.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/2019147183134_2019-05-27_Fussball_1.FC_Kaiserslautern_vs_FC_Bayern_M%C3%BCnchen_-_Sven_-_1D_X_MK_II_-_0228_-_B70I8527_%28cropped%29.jpg/800px-2019147183134_2019-05-27_Fussball_1.FC_Kaiserslautern_vs_FC_Bayern_M%C3%BCnchen_-_Sven_-_1D_X_MK_II_-_0228_-_B70I8527_%28cropped%29.jpg',
      teamLogo: '/images/teams/fc-barcelona.png',
      nationalFlag: '/images/flags/poland.png',
      category: 'top-players',
      stats: { goals: 600, assists: 85, matches: 750, trophies: 30 },
      achievements: ['Złoty But 2021', 'FIFA The Best 2020/2021', '8x Bundesliga', 'Liga Mistrzów 2020', 'Król strzelców Bundesligi 7x']
    },
    {
      id: 'ousmane-dembele',
      name: 'Ousmane Dembélé',
      fullName: 'Masour Ousmane Dembélé',
      team: 'Paris Saint-Germain',
      position: 'Skrzydłowy',
      nationality: 'Francja',
      age: 27,
      height: '1.78m',
      weight: '67kg',
      marketValue: '50M €',
      biography: 'Ousmane Dembélé, urodzony 15 maja 1997 roku w Vernon, to francuski skrzydłowy znany ze swojej szybkości, drybli i umiejętności gry obiema nogami. Mistrz świata z 2018 roku.',
      jerseyPrice: 199,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.psg.fr/cdn/shop/files/DH7197_411_ECOM.jpg?v=1720076543&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg',
      teamLogo: '/images/teams/psg.png',
      nationalFlag: '/images/flags/france.png',
      category: 'top-players',
      stats: { goals: 85, assists: 95, matches: 285, trophies: 12 },
      achievements: ['Mistrz Świata 2018', '2x La Liga', '5x Ligue 1', 'Liga Narodów 2021', 'Puchar Hiszpanii 2021']
    },
    {
      id: 'kevin-de-bruyne',
      name: 'Kevin De Bruyne',
      fullName: 'Kevin De Bruyne',
      clubId: 'ssc-napoli',
      team: 'SSC Napoli',
      position: 'Pomocnik',
      nationality: 'Belgia',
      age: 32,
      height: '1.81m',
      weight: '68kg',
      marketValue: '20M €',
      biography: 'Kevin De Bruyne, urodzony 28 czerwca 1991 roku w Drongen, to belgijski pomocnik znany ze swojej wizji gry, precyzyjnych podań i umiejętności strzeleckich. Uważany za jednego z najlepszych rozgrywających na świecie.',
      jerseyPrice: 219,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.sscnapoli.it/cdn/shop/files/Maglia-home-Europa-800-x-800-px_02.jpg?v=1757583551&width=800',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/De_Bruyne_%28cropped%29.jpg',
      teamLogo: 'https://tmssl.akamaized.net//images/wappen/head/6195.png?lm=1753167643',
      nationalFlag: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg',
      category: 'top-players',
      stats: { goals: 95, assists: 180, matches: 485, trophies: 15 },
      achievements: ['6x Premier League', 'Liga Mistrzów 2023', '2x Piłkarz Roku PFA', 'Najlepszy Pomocnik UEFA', 'Mistrz Europy U21']
    },
    {
      id: 'jude-bellingham',
      name: 'Jude Bellingham',
      fullName: 'Jude Victor William Bellingham',
      team: 'Real Madrid',
      position: 'Pomocnik',
      nationality: 'Anglia',
      age: 21,
      height: '1.86m',
      weight: '75kg',
      marketValue: '150M €',
      biography: 'Jude Bellingham, urodzony 29 czerwca 2003 roku w Stourbridge, to angielski pomocnik uważany za jeden z najlepszych młodych talentów na świecie. Jego dojrzałość na boisku i umiejętności techniczne robią ogromne wrażenie.',
      jerseyPrice: 209,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg',
      teamLogo: '/images/teams/real-madrid.png',
      nationalFlag: '/images/flags/england.png',
      category: 'top-players',
      stats: { goals: 85, assists: 55, matches: 180, trophies: 3 },
      achievements: ['Złoty Chłopak 2023', 'La Liga 2024', 'Liga Mistrzów 2024', 'Młody Piłkarz Roku UEFA', 'Mistrz Europy U21']
    },
    {
      id: 'virgil-van-dijk',
      name: 'Virgil van Dijk',
      fullName: 'Virgil van Dijk',
      team: 'Liverpool FC',
      position: 'Obrońca',
      nationality: 'Holandia',
      age: 34,
      height: '1.95m',
      weight: '92kg',
      marketValue: '80M €',
      biography: 'Virgil van Dijk, urodzony 8 lipca 1991 roku w Breda, to holenderski obrońca znany ze swojej siły fizycznej, umiejętności czytania gry i zdolności do wyprowadzania piłki. Uważany za jednego z najlepszych obrońców na świecie.',
      jerseyPrice: 209,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/20160604_AUT_NED_8876_%28cropped%29.jpg/250px-20160604_AUT_NED_8876_%28cropped%29.jpg',
      teamLogo: '/images/teams/liverpool-fc.png',
      nationalFlag: '/images/flags/netherlands.png',
      category: 'top-players',
      stats: { goals: 30, assists: 15, matches: 320, trophies: 10 },
      achievements: ['Premier League 2020', 'Liga Mistrzów 2019', 'PFA Player of the Year 2019', 'UEFA Team of the Year', 'Mistrz Europy U17']
    },
    // MŁODE TALENTY - nowa kategoria
    {
      id: 'oskar-pietuszewski',
      name: 'Oskar Pietuszewski',
      fullName: 'Oskar Pietuszewski',
      team: 'Jagielonia Białystok',
      position: 'Pomocnik',
      nationality: 'Polska',
      age: 17,
      height: '1.79m',
      weight: '70kg',
      marketValue: '8M €',
      biography: 'Oskar Pietuszewski, urodzony 15 marca 2006 roku w Białymstoku, to polski pomocnik uważany za jeden z największych talentów światowego futbolu..',
      jerseyPrice: 49,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/OskarPietuszewskiJagiellonia.png/800px-OskarPietuszewskiJagiellonia.png',
      teamLogo: '/images/teams/jagielonia-bialystok.png',
      nationalFlag: '/images/flags/poland.png',
      category: 'new-talents',
      stats: { goals: 7, assists: 10, matches: 63, trophies: 1 },
      achievements: ['Debiut w Ekstraklasie', 'MVP Młodej Ekstraklasy', 'Najlepszy Młody Zawodnik Ekstraklasy', 'Najlepszy Strzelec U19', 'Powołanie do Reprezentacji U21']
    },
    {
      id: 'pedri',
      name: 'Pedri',
      fullName: 'Pedro González López',
      team: 'FC Barcelona',
      position: 'Pomocnik',
      nationality: 'Hiszpania',
      age: 22,
      height: '1.74m',
      weight: '60kg',
      marketValue: '100M €',
      biography: 'Pedri, urodzony 25 listopada 2002 roku w Tegueste, to hiszpański pomocnik znany ze swojej wizji gry i techniki. Jeden z najjaśniejszych talentów FC Barcelony.',
      jerseyPrice: 159,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.fcbarcelona.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Pedri.jpg/250px-Pedri.jpg',
      teamLogo: '/images/teams/fc-barcelona.png',
      nationalFlag: '/images/flags/spain.png',
      category: 'new-talents',
      stats: { goals: 12, assists: 22, matches: 120, trophies: 3 },
      achievements: ['La Liga 2023', 'Copa del Rey 2021', 'Młody Zawodnik Euro 2021', 'Złoty Chłopiec 2021', 'Liga Narodów 2023']
    },
    {
      id: 'jamal-musiala',
      name: 'Jamal Musiala',
      fullName: 'Jamal Musiala',
      team: 'Bayern Munich',
      position: 'Pomocnik',
      nationality: 'Niemcy',
      age: 21,
      height: '1.80m',
      weight: '70kg',
      marketValue: '120M €',
      biography: 'Jamal Musiala, urodzony 26 lutego 2003 roku w Stuttgarcie, to niemiecki pomocnik o wyjątkowej kreatywności i umiejętnościach driblingu. Gwiazda Bayernu Monachium.',
      jerseyPrice: 209,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://shop.fcbayern.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Jamal_Musiala_2022_%28cropped%29.jpg',
      teamLogo: '/images/teams/bayern-munich.png',
      nationalFlag: '/images/flags/germany.png',
      category: 'new-talents',
      stats: { goals: 35, assists: 28, matches: 140, trophies: 6 },
      achievements: ['Bundesliga 2023', '2x Bundesliga', 'Mistrz Świata U17', 'Najlepszy Młody Zawodnik Bundesligi', 'UEFA Team of the Year']
    },
    {
      id: 'ednrick',
      name: 'Ednrick',
      fullName: 'Endrick Felipe Moreira de Sousa',
      team: 'Real Madrid',
      position: 'Napastnik',
      nationality: 'Brazylia',
      age: 19,
      height: '1.80m',
      weight: '77kg',
      marketValue: '60M €',
      biography: 'Ednrick, urodzony 21 lipca 2006 roku w São Paulo, to brazylijski napastnik o niesamowitym instynkcie strzeleckim i technice. Uważany za jeden z największych talentów brazylijskiego futbolu.',
      jerseyPrice: 119,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Endrick_sele%C3%A7%C3%A3o_vs_inglaterra.jpg/1024px-Endrick_sele%C3%A7%C3%A3o_vs_inglaterra.jpg',
      teamLogo: '/images/teams/real-madrid.png',
      nationalFlag: '/images/flags/brazil.png',
      category: 'new-talents',
      stats: { goals: 25, assists: 10, matches: 70, trophies: 2 },
      achievements: ['Mistrz Świata U17', 'Najlepszy Młody Zawodnik Copa São Paulo', 'Król Strzelców U17', 'Debiut w Reprezentacji Brazylii']
    },
    {
      id:'arda-guler',
      name: 'Arda Güler',
      fullName: 'Arda Güler',
      team: 'Fenerbahçe SK',
      position: 'Pomocnik',
      nationality: 'Turcja',
      age: 20,
      height: '1.78m',
      weight: '68kg',
      marketValue: '40M €',
      biography: 'Arda Güler, urodzony 25 lutego 2005 roku w Ankara, to turecki pomocnik znany ze swojej kreatywności i umiejętności technicznych. Jeden z najbardziej obiecujących młodych talentów w Turcji.',
      jerseyPrice: 129,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Derbide_Fenerbah%C3%A7e_Yedek_Oyuncu_Arda_G%C3%BCler_%282021-22_S%C3%BCper_Lig_-_Cropped%29.jpg',
      teamLogo: '/images/teams/real-madrid.png',
      nationalFlag: '/images/flags/turkey.png',
      category: 'new-talents',
      stats: { goals: 15, assists: 20, matches: 60, trophies: 1 },
      achievements: ['Debiut w Super Lig', 'Najlepszy Młody Zawodnik Tureckiej Ligi', 'Powołanie do Reprezentacji Turcji']
    },
    {
      id:'lamine-yamal',
      name: 'Lamine Yamal',
      fullName: 'Lamine Yamal',
      team: 'FC Barcelona',
      position: 'Napastnik',
      nationality: 'Hiszpania',
      age: 16,
      height: '1.72m',
      weight: '65kg',
      marketValue: '200M €',
      biography: 'Lamine Yamal, urodzony 13 lipca 2007 roku w Barcelonie, to hiszpański napastnik o niesamowitym talencie i technice. Uważany za jeden z największych talentów młodego pokolenia w Europie.',
      jerseyPrice: 159,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.fcbarcelona.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Lamine_Yamal_a_Xina_%282025%29.png',
      teamLogo: '/images/teams/fc-barcelona.png',
      nationalFlag: '/images/flags/spain.png',
      category: 'new-talents',
      stats: { goals: 10, assists: 8, matches: 40, trophies: 1 },
      achievements: ['Debiut w La Liga', 'Najmłodszy Strzelec w Historii FC Barcelony', 'Młody Zawodnik Miesiąca La Liga','2 miejsce w Złotej Piłce']
    },
    {
      id:'jorrel-hato',
      name: 'Jorrel Hato',
      fullName: 'Jorrel Hato',
      team: 'Chelsea FC',
      position: 'Obrońca',
      nationality: 'Holandia',
      age: 18,
      height: '1.84m',
      weight: '75kg',
      marketValue: '30M €',
      biography: 'Jorrel Hato, urodzony 7 stycznia 2006 roku w Rotterdamie, to holenderski obrońca znany ze swojej siły fizycznej i umiejętności czytania gry. Jeden z najbardziej obiecujących młodych talentów w Holandii.',
      jerseyPrice: 59,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://img.a.transfermarkt.technology/portrait/big/904802-1701361717.jpg?lm=1',
      teamLogo: '/images/teams/chelsea-fc.png',
      nationalFlag: '/images/flags/netherlands.png',
      category: 'new-talents',
      stats: { goals: 5, assists: 3, matches: 50, trophies: 1 },
      achievements: ['Debiut w Eredivisie', 'Najlepszy Młody Zawodnik Roku w Holandii', 'Powołanie do Reprezentacji U19']
    },
    {
      id:'desire-doue',
      name: 'Desire Doue',
      fullName: 'Desire Doue',
      team: 'PSG',
      position: 'Pomocnik',
      nationality: 'Francja',
      age: 19,
      height: '1.75m',
      weight: '64kg',
      marketValue: '85M €',
      biography: 'Desire Doue, urodzony 10 października 2005 roku w Paryżu, to francuski pomocnik o wyjątkowej kreatywności i umiejętnościach technicznych. Jeden z najbardziej obiecujących młodych talentów we Francji.',
      jerseyPrice: 89,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.psg.fr/cdn/shop/files/DH7197_411_ECOM.jpg?v=1720076543&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Doue_asse_psg_2425.png',
      teamLogo: '/images/teams/psg.png',
      nationalFlag: '/images/flags/france.png',
      category: 'new-talents',
      stats: { goals: 18, assists: 12, matches: 55, trophies: 2 },
      achievements: ['Debiut w Ligue 1', 'Najlepszy Młody Zawodnik Roku we Francji', 'Powołanie do Reprezentacji U20']
    },
    {
      id:'xavi-simons',
      name: 'Xavi Simons',
      fullName: 'Xavi Simons',
      team: 'RB Leipzig',
      position: 'Pomocnik',
      nationality: 'Holandia',
      age: 21,
      height: '1.78m',
      weight: '70kg',
      marketValue: '70M €',
      biography: 'Xavi Simons, urodzony 21 kwietnia 2003 roku w Amsterdamie, to holenderski pomocnik znany ze swojej wizji gry i precyzyjnych podań. Jeden z najbardziej obiecujących młodych talentów w Holandii.',
      jerseyPrice: 109,
      jerseyAvailable: true,  
      jerseyImageUrl: 'https://store.rbleipzig.com/cdn/shop/files/DM6607_457_ECOM.jpg?v=1720074891&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Xavi_Simons%2C_Nick_Verhagen_in_duel_met_Xavi_Simons.jpg',
      teamLogo: '/images/teams/rb-leipzig.png',
      nationalFlag: '/images/flags/netherlands.png',
      category: 'new-talents',
      stats: { goals: 12, assists: 10, matches: 60, trophies: 3 },
      achievements: ['Debiut w Eredivisie', 'Najlepszy Młody Zawodnik Roku w Holandii', 'Powołanie do Reprezentacji U21']
    },
    //BRAMKARZE - nowa kategoria
    {
      id:'thibaut-courtois',
      name: 'Thibaut Courtois',
      fullName: 'Thibaut Courtois',
      team: 'Real Madrid',
      position: 'Bramkarz',
      nationality: 'Belgia',
      age: 33,
      height: '1.99m',
      weight: '91kg',
      marketValue: '35M €',
      biography: 'Thibaut Courtois, urodzony 11 maja 1992 roku w Bree, to belgijski bramkarz znany ze swojej refleksu, umiejętności gry na linii i zdolności do wykonywania spektakularnych interwencji. Jeden z najlepszych bramkarzy na świecie.',
      jerseyPrice: 199,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.realmadrid.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Thibaut_Courtois_WC2022.jpg',
      teamLogo: '/images/teams/real-madrid.png',
      category: 'goalkeepers',
    },
    {
      id:'alisson-becker',
      name: 'Alisson Becker',
      fullName: 'Alisson Ramses Becker',
      team: 'Liverpool FC',
      position: 'Bramkarz',
      nationality: 'Brazylia',
      age: 33,
      height: '1.93m',
      weight: '87kg',
      marketValue: '20M €',
      biography: 'Alisson Becker, urodzony 2 października 1992 roku w Novo Hamburgo, to brazylijski bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 89,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.liverpoolfc.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_850_1625.jpg/800px-20180610_FIFA_Friendly_Match_Austria_vs._Brazil_850_1625.jpg',
      teamLogo: '/images/teams/liverpool.png',
      category: 'goalkeepers'
    },
    {
      id:'jan-oblak',
      name: 'Jan Oblak',
      fullName: 'Jan Oblak',
      team: 'Atlético Madrid',
      position: 'Bramkarz',
      nationality: 'Słowenia',
      age: 33,
      height: '1.88m',
      weight: '81kg',
      marketValue: '15M €',
      biography: 'Jan Oblak, urodzony 7 stycznia 1993 roku w Ljubljanie, to słoweński bramkarz znany ze swojej refleksu, umiejętności gry na linii i zdolności do wykonywania spektakularnych interwencji. Jeden z najlepszych bramkarzy na świecie.',
      jerseyPrice: 79,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.atleticodemadrid.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Sweden-Slovenia_Nations_League_2022-09-27_27.jpg/960px-Sweden-Slovenia_Nations_League_2022-09-27_27.jpg',
      teamLogo: '/images/teams/atletico-madrid.png',
      category: 'goalkeepers'
    },
    {
      id:'wojciech-szczesny',
      name: 'Wojciech Szczęsny',
      fullName: 'Wojciech Szczęsny',
      team: 'FC Barcelona',
      position: 'Bramkarz',
      nationality: 'Polska',
      age: 35,
      height: '1.95m',
      weight: '90kg',
      marketValue: '20M €',
      biography: 'Wojciech Szczęsny, urodzony 18 kwietnia 1990 roku w Warszawie, to polski bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 89,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.fcbarcelona.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Wojciech_Szcz%C4%99sny.png',
      teamLogo: '/images/teams/fc-barcelona.png',
      category: 'goalkeepers'
    },
    {
      id:'gianluigi-donnarumma',
      name: 'Gianluigi Donnarumma',
      fullName: 'Gianluigi Donnarumma',
      team: 'Manchester City',
      position: 'Bramkarz',
      nationality: 'Włochy',
      age: 26,
      height: '1.96m',
      weight: '90kg',
      marketValue: '25M €',
      biography: 'Gianluigi Donnarumma, urodzony 25 lutego 1999 roku w Castellammare di Stabia, to włoski bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 89,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.mancity.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Norway_Italy_-_June_2025_B_33_-_Gianluigi_Donnarumma_%28close-up%29.jpg/800px-Norway_Italy_-_June_2025_B_33_-_Gianluigi_Donnarumma_%28close-up%29.jpg',
      teamLogo: '/images/teams/manchester-city.png',
      category: 'goalkeepers'
    },
    {
      id:'manuel-neuer',
      name: 'Manuel Neuer',
      fullName: 'Manuel Neuer',
      team: 'Bayern Munich',
      position: 'Bramkarz', 
      nationality: 'Niemcy',
      age: 39,
      height: '1.93m',
      weight: '92kg',
      marketValue: '10M €',
      biography: 'Manuel Neuer, urodzony 27 marca 1986 roku w Gelsenkirchen, to niemiecki bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 89,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.bayern.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/20180602_FIFA_Friendly_Match_Austria_vs._Germany_Manuel_Neuer_850_0723.jpg/800px-20180602_FIFA_Friendly_Match_Austria_vs._Germany_Manuel_Neuer_850_0723.jpg',
      teamLogo: '/images/teams/bayern-munich.png',
      category: 'goalkeepers'
    },
    {
      id:'yann-sommer',
      name: 'Yann Sommer',
      fullName: 'Yann Sommer',
      team: 'Inter Milan',
      position: 'Bramkarz',
      nationality: 'Szwajcaria',
      age: 35,
      height: '1.83m',
      weight: '82kg',
      marketValue: '8M €',
      biography: 'Yann Sommer, urodzony 17 grudnia 1988 roku w Morges, to szwajcarski bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 79,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.inter.it/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Ser-Swi_%2818%29_%28cropped%29.jpg',
      teamLogo: '/images/teams/inter-milan.png',
      category: 'goalkeepers'
    },
    {
      id:'mike-maignan',
      name: 'Mike Maignan',
      fullName: 'Mike Maignan',
      team: 'AC Milan',
      position: 'Bramkarz',
      nationality: 'Francja',
      age: 30,
      height: '1.91m',
      weight: '86kg',
      marketValue: '18M €',
      biography: 'Mike Maignan, urodzony 3 lipca 1995 roku w Cayenne, to francuski bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 89,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.acmilan.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Mike_Maignan_2022_Salzburg_vs_AC_Milan_2022-09-06.jpg',
      teamLogo: '/images/teams/ac-milan.png',
      category: 'goalkeepers'
    },
    {
      id:'david-raya',
      name: 'David Raya',
      fullName: 'David Raya',
      team: 'Arsenal FC',
      position: 'Bramkarz',
      nationality: 'Hiszpania',
      age: 30,
      height: '1.88m',
      weight: '85kg',
      marketValue: '12M €',
      biography: 'David Raya, urodzony 22 maja 1995 roku w Barcelona, to hiszpański bramkarz znany ze swojej pewności siebie, umiejętności gry nogami i refleksu. Uważany za jednego z najlepszych bramkarzy na świecie.',
      jerseyPrice: 79,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://store.arsenal.com/cdn/shop/files/DZ0344_101_ECOM.jpg?v=1720013764&width=600',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/90/RC_Lens_-_Arsenal_FC_%2803-10-2023%29_21_%28cropped%29.jpg',
      teamLogo: '/images/teams/arsenal-fc.png',
      category: 'goalkeepers'
    }
  ];  

  const insertPlayer = db.prepare(`
    INSERT OR IGNORE INTO players (
      id, name, full_name, club_id, team, position, nationality, age, height, weight,
      market_value, biography, jersey_price, jersey_available, jersey_image_url, image_url,
      team_logo, national_flag, category
    ) VALUES (
      @id, @name, @full_name, @club_id, @team, @position, @nationality, @age, @height, @weight,
      @market_value, @biography, @jersey_price, @jersey_available, @jersey_image_url, @image_url,
      @team_logo, @national_flag, @category
    )
  `);

  players.forEach(p => {
    const { stats, achievements, ...player } = p;
    // Map to DB columns
    const mapped = {
      id: player.id,
      name: player.name,
      full_name: player.fullName || null,
      club_id: player.clubId || null,
      team: player.team || null,
      position: player.position || null,
      nationality: player.nationality || null,
      age: player.age || null,
      height: player.height || null,
      weight: player.weight || null,
      market_value: player.marketValue || null,
      biography: player.biography || null,
      jersey_price: player.jerseyPrice || null,
      jersey_available: player.jerseyAvailable ? 1 : 0,
      jersey_image_url: player.jerseyImageUrl || null,
      image_url: player.imageUrl || null,
      team_logo: player.teamLogo || null,
      national_flag: player.nationalFlag || null,
      category: player.category || null
    };

    const info = insertPlayer.run(mapped);
    // Only seed stats/achievements when newly inserted to avoid duplicates
    if (info.changes > 0) {
      if (stats) createPlayerStats(mapped.id, stats);
      if (Array.isArray(achievements)) {
        achievements.forEach(achievement => addPlayerAchievement(mapped.id, achievement));
      }
    }
  });

  console.log(`Seeded ${players.length} players`);
}

/* ---------- CLUBS FUNCTIONS ---------- */

// Pobierz wszystkie kluby
export function getAllClubs() {
  return db.prepare('SELECT * FROM clubs ORDER BY name').all();
}

// Pobierz klub po ID
export function getClubById(clubId) {
  return db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId);
}

// Dodaj klub
export function createClub(clubData) {
  const mappedData = {
    id: clubData.id,
    name: clubData.name,
    full_name: clubData.fullName,
    country: clubData.country,
    league: clubData.league,
    founded: clubData.founded,
    stadium: clubData.stadium,
    logo_url: clubData.logoUrl,
    primary_color: clubData.primaryColor,
    secondary_color: clubData.secondaryColor
  };

  const info = db.prepare(`
    INSERT INTO clubs (
      id, name, full_name, country, league, founded, stadium, logo_url, primary_color, secondary_color
    ) VALUES (
      @id, @name, @full_name, @country, @league, @founded, @stadium, @logo_url, @primary_color, @secondary_color
    )
  `).run(mappedData);

  return info.lastInsertRowid;
}
