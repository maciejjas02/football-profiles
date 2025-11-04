# Football Profiles ⚽

Profesjonalna aplikacja do przeglądania profili piłkarzy i kupowania koszulek z zaawansowanymi funkcjami uwierzytelniania.

## ✨ Funkcje

- 🔐 **Uwierzytelnianie** - lokalne konta + OAuth (Google, GitHub)
- ⚽ **Profile piłkarzy** - szczegółowe informacje z prawdziwymi zdjęciami koszulek
- 🏆 **Kategorie i Ligi** - gwiazdy, młode talenty, legendy + top 5 lig europejskich
- 🛒 **System zakupów** - zakup koszulek z zapisem w bazie danych
- 📊 **Statystyki** - gole, asysty, mecze, trofea
- 🏅 **Osiągnięcia** - historia sukcesów piłkarzy
- 🎨 **Responsive Design** - dopasowany do wszystkich urządzeń
- ⚡ **Performance** - lazy loading, cache'owanie, kompresja

## 🚀 Technologie

- **Backend**: Node.js, Express, compression middleware
- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS, lazy loading
- **Baza danych**: SQLite (domyślnie) lub PostgreSQL z indeksami
- **Uwierzytelnianie**: Passport.js, JWT, bcrypt
- **Bezpieczeństwo**: CSRF protection, rate limiting, helmet, input validation
- **Performance**: Image optimization, API caching, error handling

## Instalacja

### 1. Klonowanie repozytorium
\`\`\`bash
git clone <repo-url>
cd football-profiles
\`\`\`

### 2. Instalacja zależności
\`\`\`bash
npm install
\`\`\`

### 3. Konfiguracja bazy danych

#### Opcja A: SQLite (domyślnie)
SQLite będzie automatycznie skonfigurowane. Baza danych zostanie utworzona w pliku \`server/app.sqlite\`.

#### Opcja B: PostgreSQL
1. **Instalacja PostgreSQL**
   - Windows: Pobierz z https://www.postgresql.org/download/windows/
   - macOS: \`brew install postgresql\`
   - Ubuntu: \`sudo apt-get install postgresql postgresql-contrib\`

2. **Uruchomienie PostgreSQL**
   \`\`\`bash
   # Windows (jako usługa)
   net start postgresql-x64-14
   
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   \`\`\`

3. **Utworzenie bazy danych**
   \`\`\`bash
   # Podłącz się do PostgreSQL
   psql -U postgres
   
   # Utwórz bazę danych
   CREATE DATABASE football_profiles;
   
   # Wyjdź z psql
   \\q
   \`\`\`

4. **Konfiguracja zmiennych środowiskowych**
   \`\`\`bash
   # Ustaw użycie PostgreSQL
   set USE_POSTGRESQL=true
   
   # Lub dodaj do pliku .env
   echo USE_POSTGRESQL=true >> .env
   \`\`\`

### 4. Konfiguracja środowiska

**⚠️ WAŻNE: Ten krok jest WYMAGANY!**

Skopiuj `.env.example` do `.env` i dostosuj wartości:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

**Wygeneruj bezpieczne sekrety** (min. 32 znaki) - NIE używaj domyślnych wartości!

```bash
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Linux/Mac/Git Bash
openssl rand -base64 32
```

Wypełnij plik `.env` (szczegóły w [SECURITY.md](SECURITY.md)):
```
SESSION_SECRET=wygenerowany_losowy_sekret_32_znaki
JWT_SECRET=inny_wygenerowany_losowy_sekret_32_znaki
NODE_ENV=development
```

### 5. Uruchomienie aplikacji

```bash
# Tryb deweloperski (SQLite)
npm run dev

# Tryb deweloperski (PostgreSQL)
npm run dev:postgres

# Tryb produkcyjny
NODE_ENV=production npm start
```

Aplikacja będzie dostępna pod adresem http://localhost:5173

## Domyślne konto

- **Email**: admin@example.com
- **Hasło**: admin1234

## Struktura projektu

\`\`\`
football-profiles/
├── server/
│   ├── server.js          # Główny serwer Express
│   ├── db.js             # SQLite database layer
│   ├── db-postgres.js    # PostgreSQL database layer
│   ├── passport.js       # Konfiguracja OAuth
│   └── app.sqlite        # Plik bazy SQLite
├── public/
│   ├── index.html        # Strona logowania
│   ├── dashboard.html    # Dashboard z kategoriami
│   ├── player.html       # Strona profilu piłkarza
│   ├── app.js           # JavaScript dla logowania
│   ├── dashboard.js     # JavaScript dla dashboard
│   ├── player.js        # JavaScript dla profili
│   ├── styles.css       # Style CSS
│   └── images/          # Zdjęcia piłkarzy
├── database/
│   └── setup.sql        # Skrypt SQL dla PostgreSQL
├── package.json
├── .env.example
└── README.md
\`\`\`

## API Endpoints

### Uwierzytelnianie
- \`POST /api/auth/register\` - Rejestracja
- \`POST /api/auth/login\` - Logowanie
- \`POST /api/auth/logout\` - Wylogowanie
- \`GET /api/auth/me\` - Informacje o użytkowniku

### OAuth
- \`GET /auth/google\` - Logowanie przez Google
- \`GET /auth/github\` - Logowanie przez GitHub

### Piłkarze
- \`GET /api/player/:playerId\` - Profil piłkarza
- \`GET /api/players/category/:category\` - Piłkarze z kategorii

### Zakupy
- \`POST /api/purchase\` - Zakup koszulki
- \`GET /api/user/purchases\` - Historia zakupów

## Kategorie piłkarzy

- **Gwiazdy** - piłkarze o wartości rynkowej 100M+ EUR
- **Ligi** - zawodnicy z topowych klubów (Man City, Real Madrid, Inter Miami)
- **Młode talenty** - piłkarze do 25 lat
- **Legendy** - zawodnicy 35+ lat
- **Pomocnicy** - wszyscy pomocnicy
- **Napastnicy** - wszyscy napastnicy

## Rozwój

### Dodawanie nowych piłkarzy
Edytuj funkcję \`ensureSeedPlayers()\` w odpowiednim pliku bazy danych (\`db.js\` lub \`db-postgres.js\`).

### Zmiana bazy danych
Ustaw zmienną środowiskową `USE_POSTGRESQL=true` lub `USE_POSTGRESQL=false`.

```bash
# Uruchomienie z SQLite (domyślnie)
npm run dev

# Uruchomienie z PostgreSQL
npm run dev:postgres

# Produkcja z PostgreSQL
npm run start:postgres
```

### Migracja danych z SQLite do PostgreSQL
Jeśli masz już dane w SQLite i chcesz przenieść je do PostgreSQL:

```bash
# Upewnij się, że PostgreSQL jest uruchomiony i baza danych utworzona
npm run migrate
```

### OAuth Configuration
Dodaj do \`.env\`:
\`\`\`
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
\`\`\`

## Bezpieczeństwo

- Wszystkie hasła są hashowane z bcrypt
- Ochrona CSRF na wszystkich formularzach
- Rate limiting na logowanie i rejestrację
- JWT tokens z HttpOnly cookies
- Walidacja danych wejściowych
- Helmet.js dla dodatkowego bezpieczeństwa

## Licencja

MIT