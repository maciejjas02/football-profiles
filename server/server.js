import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import './passport.js';
import {
  ensureSchema,
  ensureSeedAdmin,
  findUserByLogin,
  getUserById,
  createOrUpdateUserFromProvider,
  existsUserByEmail,
  existsUserByUsername,
  createLocalUser
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;
const isProd = process.env.NODE_ENV === 'production';

/* ---------- Middleware ---------- */
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd
  }
}));

// Passport (OAuth)
app.use(passport.initialize());
app.use(passport.session());

// Pliki statyczne
app.use(express.static(path.join(__dirname, '..', 'public')));

// CSRF (cookie-based) — na wszystkich ścieżkach poza /auth/*
const csrfProtection = csrf({ cookie: true });
app.use((req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return csrfProtection(req, res, next);
});

/* ---------- Rate limits ---------- */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

/* ---------- DB setup ---------- */
ensureSchema();
await ensureSeedAdmin();

/* ---------- Helpers ---------- */
function issueJwt(user) {
  const payload = { sub: user.id, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_jwt_secret_change_me', { expiresIn: '1h' });
  return token;
}
function setAuthCookies(res, token) {
  res.cookie('jwt', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 60 * 60 * 1000
  });
}
function displayName(u) {
  const fromEmail = (u?.email || '').split('@')[0] || null;
  let base = u?.username || u?.name || fromEmail || 'Użytkownik';

  base = String(base).trim();

  if (u?.provider === 'google' && u?.email) {
    return u.email.split('@')[0];
  }

  return base;
}

function sanitizeUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    avatar_url: u.avatar_url,
    role: u.role,
    provider: u.provider,
    display_name: displayName(u) 
  };
}


/* ---------- Misc ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/auth/csrf-token', (req, res) => res.json({ csrfToken: req.csrfToken() }));

app.get('/api/auth/me', async (req, res) => {
  try {
    if (req.session.userId) {
      const user = getUserById(req.session.userId);
      if (user) return res.json({ user: sanitizeUser(user), via: 'session' });
    }
    const token = req.cookies.jwt;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
      const user = getUserById(decoded.sub);
      if (user) return res.json({ user: sanitizeUser(user), via: 'jwt' });
    }
    return res.status(401).json({ error: 'Not authenticated' });
  } catch {
    return res.status(401).json({ error: 'Not authenticated' });
  }
});

/* ---------- Auth: register / login / logout ---------- */
app.post('/api/auth/register', registerLimiter, async (req, res) => {
  try {
    const { email, username, password, name } = req.body || {};

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Wymagane: email, nazwa użytkownika i hasło.' });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return res.status(400).json({ error: 'Nieprawidłowy email.' });
    if (username.length < 3) return res.status(400).json({ error: 'Nazwa użytkownika za krótka (min 3).' });
    if (password.length < 6) return res.status(400).json({ error: 'Hasło za krótkie (min 6).' });

    if (existsUserByEmail(email)) return res.status(409).json({ error: 'Taki email już istnieje.' });
    if (existsUserByUsername(username)) return res.status(409).json({ error: 'Taka nazwa użytkownika już istnieje.' });

    const user = await createLocalUser({ email, username, password, name: name || null });

    req.session.userId = user.id;
    const token = issueJwt(user);
    setAuthCookies(res, token);

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Błąd serwera podczas rejestracji' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) {
      return res.status(400).json({ error: 'Wymagane pola: login i hasło.' });
    }
    const user = await findUserByLogin(login);
    if (!user) return res.status(401).json({ error: 'Nieprawidłowy login lub hasło.' });

    const bcrypt = (await import('bcrypt')).default;
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidłowy login lub hasło.' });

    req.session.userId = user.id;
    const token = issueJwt(user);
    setAuthCookies(res, token);

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('jwt');
    res.json({ ok: true });
  });
});

/* ---------- OAuth: Google ---------- */
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?oauth=failed' }),
  async (req, res) => {
    try {
      const user = await createOrUpdateUserFromProvider('google', req.user);
      req.session.userId = user.id;
      const token = issueJwt(user);
      setAuthCookies(res, token);
      res.redirect('/?oauth=ok');
    } catch (e) {
      console.error(e);
      res.redirect('/?oauth=failed');
    }
  }
);

/* ---------- OAuth: GitHub ---------- */
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/?oauth=failed' }),
  async (req, res) => {
    try {
      const user = await createOrUpdateUserFromProvider('github', req.user);
      req.session.userId = user.id;
      const token = issueJwt(user);
      setAuthCookies(res, token);
      res.redirect('/?oauth=ok');
    } catch (e) {
      console.error(e);
      res.redirect('/?oauth=failed');
    }
  }
);

/* ---------- Root ---------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/* ---------- Error handler (JSON dla CSRF) ---------- */
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'CSRF token missing/invalid' });
  }
  return next(err);
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
