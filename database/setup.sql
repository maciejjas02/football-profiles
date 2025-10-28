-- Skrypt tworzenia bazy danych PostgreSQL dla Football Profiles

-- Utwórz bazę danych (uruchom to jako superuser)
CREATE DATABASE football_profiles;

-- Podłącz się do bazy danych
\c football_profiles;

-- Utwórz użytkownika aplikacji (opcjonalne)
-- CREATE USER football_user WITH PASSWORD 'secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE football_profiles TO football_user;

-- Tabele będą utworzone automatycznie przez aplikację przy pierwszym uruchomieniu