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
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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
    
    const result = await query(`
      INSERT INTO users (email, username, password_hash, name, role, provider) 
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, ['admin@example.com', 'admin', hash, 'Admin', 'admin', 'local']);
    
    console.log('Seeded admin user: admin@example.com / admin1234');
    return result.rows[0];
  }
  
  return existing;
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
  
  switch(category) {
    case 'gwiazdy':
      // Wysokie wartości rynkowe (100M+ EUR)
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
  
  // Dla każdego piłkarza dodaj pełne dane
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

// Seed piłkarzy
export async function ensureSeedPlayers() {
  const existingResult = await query('SELECT COUNT(*) as count FROM players');
  const existingCount = parseInt(existingResult.rows[0].count);
  
  if (existingCount > 0) return; // Piłkarze już istnieją

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
      imageUrl: '/images/players/lionel-messi.jpg',
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
      imageUrl: '/images/players/cristiano-ronaldo.jpg',
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
      imageUrl: '/images/players/kylian-mbappe.jpg',
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
      imageUrl: '/images/players/erling-haaland.jpg',
      teamLogo: '/images/teams/manchester-city.png',
      nationalFlag: '/images/flags/norway.png',
      category: 'top-players',
      stats: { goals: 250, assists: 45, matches: 280, trophies: 5 },
      achievements: ['Premier League 2023', 'Liga Mistrzów 2023', 'Złoty But Premier League', 'Młody Piłkarz Roku UEFA', 'Król strzelców LM 2023']
    },
    {
      id: 'kevin-de-bruyne',
      name: 'Kevin De Bruyne',
      fullName: 'Kevin De Bruyne',
      team: 'SSC Napoli',
      position: 'Pomocnik',
      nationality: 'Belgia',
      age: 34,
      height: '1.81m',
      weight: '68kg',
      marketValue: '20M €',
      biography: 'Kevin De Bruyne, urodzony 28 czerwca 1991 roku w Drongen, to belgijski pomocnik znany ze swojej wizji gry, precyzyjnych podań i umiejętności strzeleckich. Uważany za jednego z najlepszych rozgrywających na świecie.',
      jerseyPrice: 219,
      jerseyAvailable: true,
      jerseyImageUrl: 'https://img4.dhresource.com/webp/m/0x0/f3/albu/ys/o/25/06405338-62fe-4ae3-991f-ad9b4acb4110.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/De_Bruyne_%28cropped%29.jpg',
      teamLogo: 'https://tmssl.akamaized.net//images/wappen/head/6195.png?lm=1753167643',
      nationalFlag: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg',
      category: 'leagues',
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
      imageUrl: '/images/players/jude-bellingham.jpg',
      teamLogo: '/images/teams/real-madrid.png',
      nationalFlag: '/images/flags/england.png',
      category: 'new-talents',
      stats: { goals: 85, assists: 55, matches: 180, trophies: 3 },
      achievements: ['Złoty Chłopak 2023', 'La Liga 2024', 'Liga Mistrzów 2024', 'Młody Piłkarz Roku UEFA', 'Mistrz Europy U21']
    }
  ];

  for (const player of players) {
    const { stats, achievements, ...playerData } = player;
    await createPlayer(playerData);
    await createPlayerStats(player.id, stats);
    for (const achievement of achievements) {
      await addPlayerAchievement(player.id, achievement);
    }
  }

  console.log(`Seeded ${players.length} players`);
}