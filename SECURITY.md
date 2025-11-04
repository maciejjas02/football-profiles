# 🔒 Konfiguracja Bezpieczeństwa

## Wymagane Kroki Przed Uruchomieniem

### 1. Utwórz plik `.env`

Skopiuj plik `.env.example` do `.env`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

### 2. Wygeneruj Bezpieczne Sekrety

**NIGDY nie używaj domyślnych wartości w produkcji!**

Wygeneruj losowe sekrety (min. 32 znaki):

```bash
# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Linux/Mac
openssl rand -base64 32

# Node.js (w konsoli node)
require('crypto').randomBytes(32).toString('base64')
```

### 3. Wypełnij Plik `.env`

Edytuj plik `.env` i ustaw:

```bash
# ⚠️ KRYTYCZNE - Zmień te wartości!
SESSION_SECRET=twoj_losowy_sekret_minimum_32_znaki_12345
JWT_SECRET=twoj_inny_losowy_sekret_minimum_32_znaki_67890

# Database (dostosuj do swojej konfiguracji)
USE_POSTGRESQL=false
DB_PASSWORD=bezpieczne_haslo_do_bazy

# OAuth (opcjonalne, tylko jeśli używasz)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 4. Walidacja

Aplikacja automatycznie:
- ✅ **Sprawdza** obecność sekretów w trybie produkcyjnym
- ✅ **Ostrzega** w trybie deweloperskim o domyślnych wartościach
- ✅ **Blokuje** uruchomienie w produkcji bez bezpiecznych sekretów

## OAuth - Konfiguracja (Opcjonalna)

### Google OAuth

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt
3. Włącz "Google+ API"
4. Utwórz "OAuth 2.0 Client ID"
5. Ustaw Authorized redirect URIs:
   - `http://localhost:5173/auth/google/callback` (dev)
   - `https://twoja-domena.com/auth/google/callback` (prod)

### GitHub OAuth

1. Przejdź do [GitHub Developer Settings](https://github.com/settings/developers)
2. Kliknij "New OAuth App"
3. Ustaw Authorization callback URL:
   - `http://localhost:5173/auth/github/callback` (dev)
   - `https://twoja-domena.com/auth/github/callback` (prod)

## Checklist Przed Wdrożeniem

- [ ] Plik `.env` utworzony i wypełniony
- [ ] Sekrety wygenerowane losowo (min. 32 znaki)
- [ ] `NODE_ENV=production` ustawione
- [ ] OAuth credentials skonfigurowane (jeśli używane)
- [ ] Hasło do bazy danych jest silne
- [ ] Plik `.env` dodany do `.gitignore` (już jest!)
- [ ] **NIGDY** nie commituj pliku `.env` do repozytorium!

## Pomoc

Jeśli aplikacja nie uruchamia się, sprawdź:
1. Czy plik `.env` istnieje?
2. Czy zawiera wszystkie wymagane zmienne?
3. Czy nie używasz wartości zawierających `dev_` lub `change_me` w produkcji?
