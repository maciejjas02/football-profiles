// server/db.js
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
    PRAGMA foreign_keys = ON; 
    
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        email TEXT UNIQUE, 
        username TEXT UNIQUE, 
        password_hash TEXT, 
        name TEXT, 
        avatar_url TEXT, 
        role TEXT DEFAULT 'user', 
        reputation INTEGER DEFAULT 0, 
        provider TEXT, 
        provider_id TEXT, 
        
        -- 👇 NOWE KOLUMNY ADRESOWE 👇
        address TEXT,
        city TEXT,
        postal_code TEXT,
        -- 👆 KONIEC NOWYCH KOLUMN 👆

        created_at TEXT DEFAULT (datetime('now')), 
        updated_at TEXT DEFAULT (datetime('now'))
    );
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
    CREATE TABLE IF NOT EXISTS user_discussions (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, message TEXT, sender_type TEXT, created_at TEXT DEFAULT (datetime('now')));
    
    CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        player_id TEXT, 
        quantity INTEGER DEFAULT 1, 
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, player_id)
    );

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
        db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'").run();
        const modRow = db.prepare('SELECT id FROM users WHERE email = ?').get('moderator@example.com');
        if (!modRow) {
            const hash = await bcrypt.hash('moderator1234', 10);
            db.prepare(`INSERT INTO users (email, username, password_hash, name, role, provider) VALUES (?, ?, ?, ?, ?, ?)`).run('moderator@example.com', 'moderator', hash, 'Moderator', 'moderator', 'local');
        }
    }
}

export function ensureSeedCategories() {
    if (!db.prepare("SELECT id FROM categories WHERE slug='news'").get()) {
        db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)").run('Aktualności', 'news', 'Newsy ze świata piłki');
        db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)").run('Dyskusje', 'discussions', 'Ogólne rozmowy o meczach');
    }
}

export function ensureSeedClubs() {
    const insert = db.prepare(`INSERT OR IGNORE INTO clubs (id, name, full_name, country, league, founded, stadium, logo_url, primary_color, secondary_color) VALUES (@id, @name, @full_name, @country, @league, @founded, @stadium, @logo_url, @primary_color, @secondary_color)`);

    const clubsData = [
        { id: 'manchester-city', name: 'Manchester City', full_name: 'Manchester City FC', country: 'Anglia', league: 'Premier League', founded: 1880, stadium: 'Etihad', logo_url: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg', primary_color: '#6CABDD', secondary_color: '#FFF' },
        { id: 'real-madrid', name: 'Real Madrid', full_name: 'Real Madrid CF', country: 'Hiszpania', league: 'La Liga', founded: 1902, stadium: 'Bernabeu', logo_url: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg', primary_color: '#FFF', secondary_color: '#000' },
        { id: 'inter-miami', name: 'Inter Miami', full_name: 'Inter Miami CF', country: 'USA', league: 'MLS', founded: 2018, stadium: 'DRV PNK', logo_url: 'https://upload.wikimedia.org/wikipedia/en/5/5c/Inter_Miami_CF_logo.svg', primary_color: '#F7B5CD', secondary_color: '#000' },
        { id: 'al-nassr', name: 'Al Nassr', full_name: 'Al Nassr FC', country: 'Arabia Saudyjska', league: 'Saudi Pro League', founded: 1955, stadium: 'Al-Awwal', logo_url: 'https://upload.wikimedia.org/wikipedia/en/e/e8/Al_Nassr_FC_Logo.svg', primary_color: '#FFD700', secondary_color: '#000' },
        { id: 'fc-barcelona', name: 'FC Barcelona', full_name: 'Futbol Club Barcelona', country: 'Hiszpania', league: 'La Liga', founded: 1899, stadium: 'Camp Nou', logo_url: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg', primary_color: '#A50044', secondary_color: '#004D98' },
        { id: 'bayern-monachium', name: 'Bayern Monachium', full_name: 'FC Bayern München', country: 'Niemcy', league: 'Bundesliga', founded: 1900, stadium: 'Allianz Arena', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_München_logo_%282017%29.svg', primary_color: '#DC052D', secondary_color: '#FFF' },
        { id: 'sevilla', name: 'Sevilla FC', full_name: 'Sevilla Fútbol Club', country: 'Hiszpania', league: 'La Liga', founded: 1890, stadium: 'Ramón Sánchez Pizjuán', logo_url: 'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg', primary_color: '#FFFFFF', secondary_color: '#F43333' },
        { id: 'monterrey', name: 'Monterrey FC', full_name: 'Monterrey Fútbol Club', country: 'Meksyk', league: 'Liga MX', founded: 1926, stadium: 'Estadio Azteca', logo_url: 'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg', primary_color: '#FFFFFF', secondary_color: '#F43333' },
    ];
    clubsData.forEach(club => insert.run(club));
}

export function ensureSeedPlayers() {
    const insertPlayer = db.prepare(`INSERT OR IGNORE INTO players (id, name, full_name, club_id, team, position, nationality, age, height, weight, market_value, biography, jersey_price, jersey_available, jersey_image_url, category, image_url, team_logo, national_flag) VALUES (@id, @name, @full_name, @club_id, @team, @position, @nationality, @age, @height, @weight, @market_value, @biography, @jersey_price, @jersey_available, @jersey_image_url, @category, @image_url, @team_logo, @national_flag)`);
    const insertStats = db.prepare(`INSERT OR REPLACE INTO player_stats (player_id, goals, assists, matches, trophies) VALUES (@player_id, @goals, @assists, @matches, @trophies)`);

    const players = [
        {
            id: 'lionel-messi',
            name: 'Lionel Messi',
            full_name: 'Lionel Andrés Messi',
            club_id: 'inter-miami',
            team: 'Inter Miami',
            position: 'Napastnik',
            nationality: 'Argentyna',
            age: 36,
            height: '1.70m',
            weight: '67kg',
            market_value: '30M €',
            biography: 'Argentyński piłkarz, kapitan reprezentacji Argentyny. Uważany za jednego z najlepszych piłkarzy w historii.',
            jersey_price: 499,
            jersey_available: 100,
            jersey_image_url: 'https://m.media-amazon.com/images/I/51PJkLI+fFL._AC_UY1000_.jpg',
            category: 'top-players',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/28003-1740766555.jpg?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/5/5c/Inter_Miami_CF_logo.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_Argentina.svg',
            goals: 821, assists: 350, matches: 1047, trophies: 44
        },
        {
            id: 'cristiano-ronaldo',
            name: 'Cristiano Ronaldo',
            full_name: 'Cristiano Ronaldo dos Santos Aveiro',
            club_id: 'al-nassr',
            team: 'Al Nassr',
            position: 'Napastnik',
            nationality: 'Portugalia',
            age: 39,
            height: '1.87m',
            weight: '83kg',
            market_value: '15M €',
            biography: 'Portugalski piłkarz występujący na pozycji napastnika, kapitan reprezentacji Portugalii. Legenda Realu Madryt i Manchesteru United.',
            jersey_price: 459,
            jersey_available: 100,
            jersey_image_url: 'https://assets.adidas.com/images/w_600,f_auto,q_auto/92103a27abea4abbb23ccc98cbbd2c4c_9366/Koszulka_Al_Nassr_FC_24-25_Ronaldo_Home_Zolty_JP0459_02_laydown.jpg',
            category: 'legends',
            image_url: 'https://b.fssta.com/uploads/application/soccer/headshots/885.vresize.350.350.medium.14.png',
            team_logo: 'https://tmssl.akamaized.net//images/wappen/head/18544.png?lm=1750928656',
            national_flag: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg',
            goals: 873, assists: 249, matches: 1204, trophies: 35
        },
        {
            id: 'kylian-mbappe',
            name: 'Kylian Mbappé',
            full_name: 'Kylian Mbappé Lottin',
            club_id: 'real-madrid',
            team: 'Real Madrid',
            position: 'Napastnik',
            nationality: 'Francja',
            age: 25,
            height: '1.78m',
            weight: '73kg',
            market_value: '180M €',
            biography: 'Jeden z najszybszych i najbardziej utalentowanych napastników na świecie. Mistrz Świata 2018.',
            jersey_price: 599,
            jersey_available: 100,
            jersey_image_url: 'https://us.shop.realmadrid.com/_next/image?url=https%3A%2F%2Flegends.broadleafcloud.com%2Fapi%2Fasset%2Fcontent%2FSBP26%2FRMCFMZ0899-Mens-Home-Shirt-25-26-White-mbappe-9.jpg%3FcontextRequest%3D%257B%2522forceCatalogForFetch%2522%3Afalse%2C%2522forceFilterByCatalogIncludeInheritance%2522%3Afalse%2C%2522forceFilterByCatalogExcludeInheritance%2522%3Afalse%2C%2522applicationId%2522%3A%252201H4RD9NXMKQBQ1WVKM1181VD8%2522%2C%2522tenantId%2522%3A%2522REAL_MADRID%2522%257D&w=3840&q=50',
            category: 'top-players',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/342229-1682683695.jpg?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg',
            goals: 315, assists: 150, matches: 420, trophies: 18
        },
        {
            id: 'erling-haaland',
            name: 'Erling Haaland',
            full_name: 'Erling Braut Haaland',
            club_id: 'manchester-city',
            team: 'Manchester City',
            position: 'Napastnik',
            nationality: 'Norwegia',
            age: 23,
            height: '1.95m',
            weight: '88kg',
            market_value: '180M €',
            biography: 'Norweska maszyna do strzelania bramek. Znany z siły, szybkości i wykończenia.',
            jersey_price: 549,
            jersey_available: 100,
            jersey_image_url: 'https://shop.mancity.com/dw/image/v2/BDWJ_PRD/on/demandware.static/-/Sites-master-catalog-MAN/default/dwf8790839/images/large/701237128BW001_pp_01_mcfc.png?sw=1600&sh=1600&sm=fit',
            category: 'top-players',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/418560-1709108116.png?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Flag_of_Norway.svg',
            goals: 220, assists: 50, matches: 270, trophies: 10
        },
        {
            id: 'jude-bellingham',
            name: 'Jude Bellingham',
            full_name: 'Jude Victor William Bellingham',
            club_id: 'real-madrid',
            team: 'Real Madrid',
            position: 'Pomocnik',
            nationality: 'Anglia',
            age: 20,
            height: '1.86m',
            weight: '75kg',
            market_value: '180M €',
            biography: 'Fenomenalny młody pomocnik, który podbił serca kibiców Realu Madryt w swoim debiutanckim sezonie.',
            jersey_price: 529,
            jersey_available: 100,
            jersey_image_url: 'https://us.shop.realmadrid.com/_next/image?url=https%3A%2F%2Flegends.broadleafcloud.com%2Fapi%2Fasset%2Fcontent%2FSBP26%2FRMCFMZ0899-Mens-Home-Shirt-25-26-White-bellingham-5.jpg%3FcontextRequest%3D%257B%2522forceCatalogForFetch%2522%3Afalse%252C%2522forceFilterByCatalogIncludeInheritance%2522%3Afalse%252C%2522forceFilterByCatalogExcludeInheritance%2522%3Afalse%252C%2522applicationId%2522%3A%252201H4RD9NXMKQBQ1WVKM1181VD8%2522%252C%2522tenantId%2522%3A%2522REAL_MADRID%2522%257D&w=3840&q=50',
            category: 'new-talents',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/581678-1748102891.jpg?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/en/b/be/Flag_of_England.svg',
            goals: 45, assists: 35, matches: 200, trophies: 5
        },
        {
            id: 'robert-lewandowski',
            name: 'Robert Lewandowski',
            full_name: 'Robert Lewandowski',
            club_id: 'fc-barcelona',
            team: 'FC Barcelona',
            position: 'Napastnik',
            nationality: 'Polska',
            age: 35,
            height: '1.85m',
            weight: '81kg',
            market_value: '20M €',
            biography: 'Najlepszy polski piłkarz w historii. Rekordzista Bundesligi, gwiazda Barcelony.',
            jersey_price: 399,
            jersey_available: 100,
            jersey_image_url: 'https://arenajerseys.com/wp-content/uploads/2022/08/download-13.jpg',
            category: 'top-players',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/38253-1760445524.jpg?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/en/1/12/Flag_of_Poland.svg',
            goals: 600, assists: 150, matches: 900, trophies: 28
        },
        {
            id: 'thibaut-courtois',
            name: 'Thibaut Courtois',
            full_name: 'Thibaut Nicolas Marc Courtois',
            club_id: 'real-madrid',
            team: 'Real Madrid',
            position: 'Bramkarz',
            nationality: 'Belgia',
            age: 31,
            height: '2.00m',
            weight: '96kg',
            market_value: '35M €',
            biography: 'Jeden z najlepszych bramkarzy na świecie. Mur nie do przejścia w bramce Realu Madryt.',
            jersey_price: 349,
            jersey_available: 100,
            jersey_image_url: 'https://shop.realmadrid.com/_next/image?url=https%3A%2F%2Flegends.broadleafcloud.com%2Fapi%2Fasset%2Fcontent%2FSBP26%2FRMCFMZ0916-Mens-Goalkeeper-Shirt-25-26-Blue-courtois-1.jpg%3FcontextRequest%3D%257B%2522forceCatalogForFetch%2522%3Afalse%252C%2522forceFilterByCatalogIncludeInheritance%2522%3Afalse%252C%2522forceFilterByCatalogExcludeInheritance%2522%3Afalse%252C%2522applicationId%2522%3A%252201H4RD9NXMKQBQ1WVKM1181VD8%2522%252C%2522tenantId%2522%3A%2522REAL_MADRID%2522%257D&w=3840&q=50',
            category: 'goalkeepers',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/108390-1717280733.jpg?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg',
            goals: 0, assists: 1, matches: 600, trophies: 18
        },
        {
            id: 'sergio-ramos',
            name: 'Sergio Ramos',
            full_name: 'Sergio Ramos García',
            club_id: 'monterrey',
            team: 'Monterrey',
            position: 'Obrońca',
            nationality: 'Hiszpania',
            age: 37,
            height: '1.84m',
            weight: '82kg',
            market_value: '3M €',
            biography: 'Legenda obrony, znany z waleczności i kluczowych goli w ostatnich minutach.',
            jersey_price: 299,
            jersey_available: 100,
            jersey_image_url: 'https://www.classicfootballshirts.co.uk/cdn-cgi/image/fit=pad,q=70,f=webp//pub/media/catalog/product//8/0/80416f91a15bf17558b1f201d4ad31462ec4ddf0f2d7b8093b467e9da4e1bd9e.jpeg',
            category: 'legends',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/25557-1694502812.jpg?lm=1',
            team_logo: 'https://tmssl.akamaized.net//images/wappen/head/2407.png?lm=1406966074',
            national_flag: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Flag_of_Spain.svg',
            goals: 133, assists: 40, matches: 950, trophies: 29
        },
        {
            id: 'gavi',
            name: 'Gavi',
            full_name: 'Pablo Martín Páez Gavira',
            club_id: 'fc-barcelona',
            team: 'FC Barcelona',
            position: 'Pomocnik',
            nationality: 'Hiszpania',
            age: 19,
            height: '1.73m',
            weight: '68kg',
            market_value: '90M €',
            biography: 'Niezwykle waleczny młody talent z La Masii. Serce środka pola Barcelony.',
            jersey_price: 449,
            jersey_available: 100,
            jersey_image_url: 'https://m.media-amazon.com/images/I/41+QCAw2nZL._AC_SY1000_.jpg',
            category: 'new-talents',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/646740-1682685701.jpg?lm=1',
            team_logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
            national_flag: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Flag_of_Spain.svg',
            goals: 10, assists: 15, matches: 100, trophies: 2
        },
        {
            id: 'wojciech-szczesny',
            name: 'Szczesny',
            full_name: 'Wojciech Szcześni',
            club_id: 'fc-barcelona',
            team: 'FC Barcelona',
            position: 'Bramkarz',
            nationality: 'Polska',
            age: 35,
            height: '1.95m',
            weight: '80kg',
            market_value: '1M €',
            biography: 'Polski bramkarz z Barcelony. Wielokrotny reprezentant Polski.',
            jersey_price: 299,
            jersey_available: 100,
            jersey_image_url: 'https://tgsport.pl/environment/cache/images/500_500_productGfx_18574/Szczesny-Barcelona-koszulka-pilkarska-sportowa-kibica-2.jpg',
            category: 'goalkeepers',
            image_url: 'https://img.a.transfermarkt.technology/portrait/big/44058-1744278078.jpg?lm=1',
            team_logo: 'https://tmssl.akamaized.net//images/wappen/head/131.png?lm=1406739548',
            national_flag: 'https://upload.wikimedia.org/wikipedia/en/1/12/Flag_of_Poland.svg',
            goals: 0, assists: 1, matches: 600, trophies: 18

        }
    ];


    players.forEach(p => {
        const { goals, assists, matches, trophies, ...rest } = p;
        const playerData = { ...rest, jersey_image_url: p.jersey_image_url || null };
        try {
            insertPlayer.run(playerData);
            insertStats.run({ player_id: p.id, goals, assists, matches, trophies });
        } catch (error) { console.error("Błąd przy dodawaniu piłkarza:", p.name, error); }
    });
}

// --- USERS ---
export function findUserByLogin(l) { return db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(l, l); }
export function getUserById(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
export function getUserByProvider(provider, providerId) {
    return db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId);
}

export async function createLocalUser({ email, username, password, name }) {
    const hash = await bcrypt.hash(password, 10);
    const res = db.prepare('INSERT INTO users (email, username, password_hash, name, role, provider) VALUES (?,?,?,?,?,?)').run(email, username, hash, name, 'user', 'local');
    return getUserById(res.lastInsertRowid);
}

export function createOrUpdateUserFromProvider(provider, userData) {
    const { id: providerId, email, username, displayName, name, avatar_url } = userData;

    let user = getUserByProvider(provider, providerId);

    if (user) {
        // Update istniejącego
        db.prepare(`
            UPDATE users SET 
                email = COALESCE(?, email),
                name = COALESCE(?, name),
                avatar_url = COALESCE(?, avatar_url),
                updated_at = datetime('now')
            WHERE id = ?
        `).run(email, displayName || name, avatar_url, user.id);
        return getUserById(user.id);
    }

    // Create nowego
    const usernameToUse = username || (email && email.split('@')[0]) ||
        (displayName ? displayName.replace(/\s+/g, '').toLowerCase() : `${provider}_${providerId}`);

    const info = db.prepare(`
        INSERT INTO users (email, username, name, avatar_url, provider, provider_id, role) 
        VALUES (?, ?, ?, ?, ?, ?, 'user')
    `).run(email, usernameToUse, displayName || name, avatar_url, provider, providerId);

    return getUserById(info.lastInsertRowid);
}

export function existsUserByEmail(e) { return !!db.prepare('SELECT 1 FROM users WHERE email=?').get(e); }
export function existsUserByUsername(u) { return !!db.prepare('SELECT 1 FROM users WHERE username=?').get(u); }
// 👇 NOWA FUNKCJA DO AKTUALIZACJI ADRESU (Eksportowana) 👇
export function updateUserAddress(userId, address, city, postalCode) {
    const stmt = db.prepare('UPDATE users SET address = ?, city = ?, postal_code = ? WHERE id = ?');
    return stmt.run(address, city, postalCode, userId);
}
// 👆 KONIEC NOWEJ FUNKCJI 👆

// --- DATA ---
export function getPlayerById(id) {
    const p = db.prepare('SELECT * FROM players WHERE id=?').get(id);
    if (!p) return null;
    const stats = db.prepare('SELECT * FROM player_stats WHERE player_id=?').get(id) || {};
    const achievements = db.prepare('SELECT achievement FROM player_achievements WHERE player_id=?').all(id).map(x => x.achievement);
    return { ...p, imageUrl: p.image_url, jerseyImageUrl: p.jersey_image_url, teamLogo: p.team_logo, nationalFlag: p.national_flag, marketValue: p.market_value, jerseyPrice: p.jersey_price, jerseyAvailable: p.jersey_available, fullName: p.full_name, stats, achievements };
}

export function getPlayersByCategory(cat) {
    let rows = [];
    if (cat === 'top-players') rows = db.prepare("SELECT * FROM players WHERE (CAST(REPLACE(REPLACE(market_value, 'M €', ''), '€', '') AS INTEGER) >= 100) OR category='top-players' ORDER BY market_value DESC").all();
    else if (cat === 'new-talents') rows = db.prepare("SELECT * FROM players WHERE age <= 23 ORDER BY age ASC").all();
    else if (cat === 'legends') rows = db.prepare("SELECT * FROM players WHERE age >= 34 OR category='legends' ORDER BY age DESC").all();
    else if (cat === 'goalkeepers') rows = db.prepare("SELECT * FROM players WHERE position = 'Bramkarz'").all();
    else rows = db.prepare('SELECT * FROM players WHERE category=?').all(cat);
    return [...new Map(rows.map(item => [item['id'], item])).values()].map(p => getPlayerById(p.id));
}

export function getAllClubs() { return db.prepare('SELECT * FROM clubs').all(); }
export function getClubById(id) { return db.prepare('SELECT * FROM clubs WHERE id=?').get(id); }
export function createPurchase(u, p, j) { return db.prepare('INSERT INTO purchases (user_id, player_id, jersey_price) VALUES (?,?,?)').run(u, p, j); }
export function getUserPurchases(id) {
    return db.prepare(`SELECT p.*, pl.name as player_name, pl.team, pl.image_url as player_image, pl.jersey_image_url FROM purchases p JOIN players pl ON p.player_id = pl.id WHERE user_id=? ORDER BY purchase_date DESC`).all(id);
}
export function updatePurchaseStatus(id, s) { return db.prepare('UPDATE purchases SET status=? WHERE id=?').run(s, id); }

// --- FORUM & MODERACJA ---
export function getAllCategories() { return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id OR p.category_id IN (SELECT sub.id FROM categories sub WHERE sub.parent_id = c.id)) as post_count FROM categories c`).all(); }
export function getCategoryBySlug(s) { return db.prepare('SELECT * FROM categories WHERE slug=?').get(s); }
export function getSubcategories(id) { return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) as post_count FROM categories c WHERE parent_id = ?`).all(id); }
export function createCategory(n, s, d, p) { return db.prepare('INSERT INTO categories (name, slug, description, parent_id) VALUES (?,?,?,?)').run(n, s, d, p); }
export function updateCategory(id, n, s, d) { return db.prepare('UPDATE categories SET name=?, slug=?, description=? WHERE id=?').run(n, s, d, id); }
export function deleteCategory(id) { db.prepare('DELETE FROM posts WHERE category_id=?').run(id); db.prepare('DELETE FROM categories WHERE id=?').run(id); }
export function getCategoryModerators(id) { return db.prepare(`SELECT u.id, u.username, u.name, u.email FROM moderator_categories mc JOIN users u ON mc.user_id = u.id WHERE mc.category_id = ?`).all(id); }
export function assignModeratorToCategory(u, c) { try { return db.prepare('INSERT INTO moderator_categories (user_id, category_id) VALUES (?,?)').run(u, c); } catch (e) { return { changes: 0 }; } }
export function removeModeratorFromCategory(u, c) { return db.prepare('DELETE FROM moderator_categories WHERE user_id=? AND category_id=?').run(u, c); }

export function getAllPosts(limit, offset) {
    return db.prepare(`SELECT p.*, u.username as author_username, c.name as category_name, (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id AND status='approved') as comment_count FROM posts p LEFT JOIN users u ON p.author_id = u.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'approved' ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
}
export function getPostsByCategory(catId, limit, offset) {
    return db.prepare(`SELECT p.*, u.username as author_username, c.name as category_name, (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id AND status='approved') as comment_count FROM posts p LEFT JOIN users u ON p.author_id = u.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id = ? AND p.status = 'approved' ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(catId, limit, offset);
}
export function getPostById(id) { return db.prepare(`SELECT p.*, u.username as author_username, c.name as category_name FROM posts p LEFT JOIN users u ON p.author_id = u.id LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(id); }
export function createPost(t, c, cat, aut, stat) { return db.prepare('INSERT INTO posts (title, content, category_id, author_id, status) VALUES (?,?,?,?,?)').run(t, c, cat, aut, stat); }
export function updatePost(id, t, c, cat) { return db.prepare('UPDATE posts SET title=?, content=?, category_id=? WHERE id=?').run(t, c, cat, id); }
export function approvePost(id) { return db.prepare("UPDATE posts SET status='approved' WHERE id=?").run(id); }
export function rejectPost(id) { return db.prepare("UPDATE posts SET status='rejected' WHERE id=?").run(id); }
export function deletePost(id) { return db.prepare("DELETE FROM posts WHERE id=?").run(id); }
export function getPendingPosts() { return db.prepare("SELECT p.*, c.name as category_name, u.username as author_username FROM posts p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN users u ON p.author_id=u.id WHERE p.status='pending' ORDER BY p.created_at DESC").all(); }

// --- COMMENTS (Z AKTUALIZACJĄ REPUTACJI I PENDING) ---
export function getPostComments(pid, userId) {
    const uid = userId || -1;
    return db.prepare(`
        SELECT pc.*, u.username as author_username, u.reputation as author_reputation,
        (SELECT COUNT(*) FROM comment_ratings WHERE comment_id = pc.id AND rating = 1) as likes,
        (SELECT COUNT(*) FROM comment_ratings WHERE comment_id = pc.id AND rating = -1) as dislikes,
        (SELECT rating FROM comment_ratings WHERE comment_id = pc.id AND user_id = ?) as user_vote
        FROM post_comments pc 
        LEFT JOIN users u ON pc.author_id=u.id 
        WHERE pc.post_id=? 
        AND (pc.status='approved' OR (pc.status='pending' AND pc.author_id=?))
        ORDER BY pc.created_at DESC
    `).all(uid, pid, uid);
}

export function rateComment(cid, uid, r) {
    const comment = db.prepare("SELECT author_id FROM post_comments WHERE id=?").get(cid);
    if (!comment) return;
    const authorId = comment.author_id;
    if (authorId === uid) return; // Nie oceniaj siebie

    const transaction = db.transaction(() => {
        const existing = db.prepare("SELECT rating FROM comment_ratings WHERE comment_id=? AND user_id=?").get(cid, uid);
        let repChange = 0;
        if (existing) {
            if (existing.rating === r) {
                db.prepare("DELETE FROM comment_ratings WHERE comment_id=? AND user_id=?").run(cid, uid);
                repChange = -r;
            } else {
                db.prepare("UPDATE comment_ratings SET rating=? WHERE comment_id=? AND user_id=?").run(r, cid, uid);
                repChange = r - existing.rating;
            }
        } else {
            db.prepare("INSERT INTO comment_ratings (comment_id, user_id, rating) VALUES (?,?,?)").run(cid, uid, r);
            repChange = r;
        }
        if (repChange !== 0) {
            db.prepare("UPDATE users SET reputation = reputation + ? WHERE id=?").run(repChange, authorId);
        }
    });
    transaction();
}

export function createComment(pid, c, aid) { const user = getUserById(aid); const status = (user.role === 'admin' || user.role === 'moderator') ? 'approved' : 'pending'; return db.prepare("INSERT INTO post_comments (post_id, content, author_id, status) VALUES (?,?,?,?)").run(pid, c, aid, status); }
export function getCommentById(id) { return db.prepare("SELECT * FROM post_comments WHERE id=?").get(id); }
export function updateComment(id, content) { return db.prepare("UPDATE post_comments SET content=? WHERE id=?").run(content, id); }
export function approveComment(id) { return db.prepare("UPDATE post_comments SET status='approved' WHERE id=?").run(id); }
export function rejectComment(id) { return db.prepare("UPDATE post_comments SET status='rejected' WHERE id=?").run(id); }
export function deleteComment(id) { return db.prepare("DELETE FROM post_comments WHERE id=?").run(id); }
export function getPendingComments() { return db.prepare(`SELECT pc.*, u.username as author_username, p.title as post_title, c.name as category_name FROM post_comments pc LEFT JOIN users u ON pc.author_id=u.id LEFT JOIN posts p ON pc.post_id=p.id LEFT JOIN categories c ON p.category_id=c.id WHERE pc.status='pending' ORDER BY pc.created_at DESC`).all(); }
export function getUserCommentRating() { }

// --- DYSKUSJE ---
export function createDiscussion(postId, userId, message, senderType) {
    return db.prepare(`INSERT INTO user_discussions (post_id, user_id, message, sender_type) VALUES (?, ?, ?, ?)`).run(postId, userId, message, senderType);
}
export function getDiscussionMessages(postId, userId) {
    return db.prepare(`SELECT * FROM user_discussions WHERE post_id = ? AND user_id = ? ORDER BY created_at ASC`).all(postId, userId);
}
export function getDiscussionUsers(postId) {
    return db.prepare(`SELECT DISTINCT u.id, u.username FROM user_discussions ud JOIN users u ON ud.user_id = u.id WHERE ud.post_id = ?`).all(postId);
}

// --- POWIADOMIENIA (Z PAGINACJĄ) ---
export function createNotification(userId, type, title, message, link) { if (userId === null) return; return db.prepare('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?,?,?,?,?)').run(userId, type, title, message, link); }
export function getUserNotifications(userId, limit = 10, offset = 0) {
    return db.prepare(`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(userId, limit, offset);
}
export function markNotificationAsRead(id) { return db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(id); }
export function markAllNotificationsAsRead(userId) { return db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(userId); }

// --- GALERIA ---
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
export function getCollectionItems(id) { return db.prepare("SELECT gi.*, i.filename, i.title, i.description FROM gallery_items gi JOIN gallery_images i ON gi.image_id=i.id WHERE collection_id=? ORDER BY position").all(id); }
export function removeImageFromCollection(id) { return db.prepare("DELETE FROM gallery_items WHERE id=?").run(id); }
export function reorderCollectionItems(collectionId, items) { const update = db.prepare('UPDATE gallery_items SET position = ? WHERE id = ? AND collection_id = ?'); const transaction = db.transaction((items) => { for (const item of items) { update.run(item.position, item.itemId, collectionId); } }); return transaction(items); }

// --- KOSZYK ---
export function getCartItems(userId) { return db.prepare(`SELECT ci.*, p.name, p.team, p.jersey_price, p.jersey_image_url, p.image_url as player_image FROM cart_items ci JOIN players p ON ci.player_id = p.id WHERE ci.user_id = ?`).all(userId); }
export function addToCart(userId, playerId) { return db.prepare(`INSERT INTO cart_items (user_id, player_id, quantity) VALUES (?, ?, 1) ON CONFLICT(user_id, player_id) DO UPDATE SET quantity = quantity + 1`).run(userId, playerId); }
export function removeFromCart(userId, itemId) { return db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(itemId, userId); }
export function clearCart(userId) { return db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId); }
export function checkoutCart(userId) {
    const items = getCartItems(userId); if (items.length === 0) throw new Error("Koszyk jest pusty");
    const insertPurchase = db.prepare('INSERT INTO purchases (user_id, player_id, jersey_price, status) VALUES (?, ?, ?, ?)');
    const transaction = db.transaction(() => { for (const item of items) { for (let i = 0; i < item.quantity; i++) { insertPurchase.run(userId, item.player_id, item.jersey_price, 'pending'); } } db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId); });
    transaction(); return items.length;
}

export function getAllPurchases() {
    return db.prepare(`
        SELECT p.*, u.username, u.email, pl.name as player_name, pl.team 
        FROM purchases p 
        JOIN users u ON p.user_id = u.id 
        JOIN players pl ON p.player_id = pl.id 
        ORDER BY p.purchase_date DESC
    `).all();
}