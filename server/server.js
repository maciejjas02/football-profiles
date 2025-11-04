import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs/promises';
import './passport.js';

// Walidacja wymaganych zmiennych środowiskowych w produkcji
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const requiredEnvVars = ['SESSION_SECRET', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].includes('dev_') || process.env[varName].includes('change_me'));
  
  if (missingVars.length > 0) {
    console.error('❌ BŁĄD: Brakujące lub niebezpieczne zmienne środowiskowe w trybie produkcyjnym:');
    console.error(`   ${missingVars.join(', ')}`);
    console.error('   Utwórz plik .env na podstawie .env.example i ustaw bezpieczne wartości!');
    process.exit(1);
  }
}

// Ostrzeżenie w trybie deweloperskim
if (!isProd && (!process.env.SESSION_SECRET || !process.env.JWT_SECRET)) {
  console.warn('⚠️  UWAGA: Używasz domyślnych sekretów. To jest OK tylko w trybie deweloperskim!');
  console.warn('   Dla produkcji stwórz plik .env na podstawie .env.example');
}

// Wybór bazy danych na podstawie zmiennej środowiskowej
const usePostgreSQL = process.env.USE_POSTGRESQL === 'true';

// Import odpowiednich funkcji bazy danych
let dbFunctions;
if (usePostgreSQL) {
  console.log('Using PostgreSQL database');
  dbFunctions = await import('./db-postgres.js');
} else {
  console.log('Using SQLite database');
  dbFunctions = await import('./db.js');
}

const {
  ensureSchema,
  ensureSeedAdmin,
  ensureSeedCategories,
  ensureSeedClubs,
  ensureSeedPlayers,
  findUserByLogin,
  getUserById,
  createOrUpdateUserFromProvider,
  existsUserByEmail,
  existsUserByUsername,
  createLocalUser,
  getPlayerById,
  getPlayersByCategory,
  getAllClubs,
  getClubById,
  createClub,
  createPurchase,
  getUserPurchases,
  // Gallery functions
  createGalleryImage,
  getAllGalleryImages,
  getGalleryImageById,
  deleteGalleryImage,
  createGalleryCollection,
  getAllGalleryCollections,
  getGalleryCollectionById,
  getActiveGalleryCollection,
  setActiveGalleryCollection,
  deleteGalleryCollection,
  addImageToCollection,
  getCollectionItems,
  removeImageFromCollection,
  reorderCollectionItems,
  // Forum functions
  getAllCategories,
  getCategoryBySlug,
  getCategoryById,
  getSubcategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryModerators,
  assignModeratorToCategory,
  removeModeratorFromCategory,
  getModeratorCategories,
  getAllPosts,
  getPostsByCategory,
  getPostById,
  createPost,
  updatePost,
  approvePost,
  rejectPost,
  deletePost,
  getPendingPosts,
  getPostComments,
  createComment,
  getCommentById,
  updateComment,
  approveComment,
  rejectComment,
  deleteComment,
  getPendingComments,
  rateComment,
  getUserCommentRating,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createDiscussion,
  getDiscussionMessages
} = dbFunctions;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

/* ---------- Middleware ---------- */
// Compression middleware
app.use(compression());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://upload.wikimedia.org", "https://commons.wikimedia.org", "https://tmssl.akamaized.net", "https://via.placeholder.com", "https://store.sscnapoli.it", "https://logos-world.net", "https://img.chelseafc.com", "https://store.chelseafc.com","https://img.a.transfermarkt.technology" ,"https://img.chelseafc.com","https://www.transfermarkt.pl","https://tmssl.akamaized.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
    },
  },
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Session configuration
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

// Static files with caching
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: isProd ? '1d' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache static assets longer in production
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', isProd ? 'public, max-age=86400' : 'no-cache');
    }
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.svg')) {
      res.setHeader('Cache-Control', isProd ? 'public, max-age=604800' : 'no-cache');
    }
  }
}));

// CSRF (cookie-based) — na wszystkich ścieżkach poza /auth/* i /player/* i GET /api/player/* i /api/gallery/*
const csrfProtection = csrf({ cookie: true });
app.use((req, res, next) => {
  if (req.path.startsWith('/auth/') || 
      req.path.startsWith('/player/') || 
      req.path.startsWith('/api/gallery/') ||
      (req.method === 'GET' && req.path.startsWith('/api/player/'))) {
    return next();
  }
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
console.log(`Initializing ${usePostgreSQL ? 'PostgreSQL' : 'SQLite'} database...`);
await ensureSchema();
await ensureSeedAdmin();
await ensureSeedClubs();
await ensureSeedPlayers();
ensureSeedCategories(); // Sync - doesn't need await

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

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

function requireModerator(req, res, next) {
  const user = getUserById(req.session.userId);
  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Moderator or Admin only' });
  }
  next();
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

// API dla danych piłkarzy
app.get('/api/player/:playerId', (req, res) => {
  const playerId = req.params.playerId;
  
  try {
    const player = getPlayerById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Piłkarz nie znaleziony' });
    }
    
    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API dla piłkarzy według kategorii
app.get('/api/players/category/:category', (req, res) => {
  const category = req.params.category;
  
  try {
    const players = getPlayersByCategory(category);
    res.json(players);
  } catch (error) {
    console.error('Error fetching players by category:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API dla wszystkich klubów
app.get('/api/clubs', (req, res) => {
  try {
    const clubs = getAllClubs();
    res.json(clubs);
  } catch (error) {
    console.error('Error fetching clubs:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API dla konkretnego klubu
app.get('/api/clubs/:id', (req, res) => {
  const clubId = req.params.id;
  
  try {
    const club = getClubById(clubId);
    if (!club) {
      return res.status(404).json({ error: 'Klub nie został znaleziony' });
    }
    res.json(club);
  } catch (error) {
    console.error('Error fetching club:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// API dla zakupu koszulki
app.post('/api/purchase', async (req, res) => {
  try {
    const { playerId } = req.body;
    
    // Sprawdź czy użytkownik jest zalogowany
    let userId = null;
    if (req.session.userId) {
      userId = req.session.userId;
    } else {
      const token = req.cookies.jwt;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
        userId = decoded.sub;
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Musisz być zalogowany' });
    }
    
    // Sprawdź czy piłkarz istnieje
    const player = getPlayerById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Piłkarz nie znaleziony' });
    }
    
    // Zapisz zakup
    const purchaseId = createPurchase(userId, playerId, player.jerseyPrice);
    
    res.json({ 
      success: true, 
      purchaseId,
      message: `Zakupiono koszulkę ${player.name}!`
    });
    
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'Błąd podczas zakupu' });
  }
});

// API dla historii zakupów użytkownika
app.get('/api/user/purchases', async (req, res) => {
  try {
    // Sprawdź czy użytkownik jest zalogowany
    let userId = null;
    if (req.session.userId) {
      userId = req.session.userId;
    } else {
      const token = req.cookies.jwt;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
        userId = decoded.sub;
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Musisz być zalogowany' });
    }
    
    const purchases = getUserPurchases(userId);
    res.json(purchases);
    
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

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
app.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account'  // Wymusza wybór konta przy każdym logowaniu
}));
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

/* ---------- GALLERY API ---------- */

// Multer config - upload do temp folder
const upload = multer({
  dest: 'temp_uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Helper: generate unique filename
function generateFilename(originalName) {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${timestamp}-${random}${ext}`;
}

// 1. Upload image (+0.5 bonus: auto-scaling z sharp)
app.post('/api/gallery/upload', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    console.log('📸 Gallery upload request:', { 
      hasFile: !!req.file, 
      body: req.body, 
      user: req.session.userId 
    });

    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const { title, description } = req.body;
    if (!title) {
      console.error('❌ No title provided');
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Title is required' });
    }

    const filename = generateFilename(req.file.originalname);
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'gallery');
    const thumbPath = path.join(uploadPath, 'thumbnails');

    console.log('📁 Upload paths:', { uploadPath, thumbPath });

    // Auto-scaling z sharp (+0.5 bonus)
    const image = sharp(req.file.path);
    const metadata = await image.metadata();

    // Save original (max 1920px width)
    await image
      .resize(1920, null, { withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(path.join(uploadPath, filename));

    // Save thumbnail (400px width)
    await sharp(req.file.path)
      .resize(400, null)
      .jpeg({ quality: 80 })
      .toFile(path.join(thumbPath, filename));

    // Remove temp file
    await fs.unlink(req.file.path);

    // Save to DB
    const imageId = createGalleryImage({
      filename,
      title,
      description: description || '',
      width: metadata.width,
      height: metadata.height
    });

    console.log('✅ Gallery image uploaded:', imageId, filename);
    res.json({ success: true, imageId, filename });
  } catch (error) {
    console.error('❌ Gallery upload error:', error);
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// 2. Get all images
app.get('/api/gallery/images', (req, res) => {
  try {
    const images = getAllGalleryImages();
    res.json(images);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// 3. Delete image
app.delete('/api/gallery/images/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const image = getGalleryImageById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete files
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', 'gallery');
    await fs.unlink(path.join(uploadPath, image.filename)).catch(() => {});
    await fs.unlink(path.join(uploadPath, 'thumbnails', image.filename)).catch(() => {});

    // Delete from DB
    deleteGalleryImage(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// 4. Create collection (+0.5 bonus: multiple sliders)
app.post('/api/gallery/collections', requireAuth, requireAdmin, (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const collectionId = createGalleryCollection({ name, description: description || '' });
    res.json({ success: true, collectionId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// 5. Get all collections
app.get('/api/gallery/collections', (req, res) => {
  try {
    const collections = getAllGalleryCollections();
    res.json(collections);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// 6. Get active collection (for user view)
app.get('/api/gallery/active', (req, res) => {
  try {
    const collection = getActiveGalleryCollection();
    if (!collection) {
      return res.json({ items: [] });
    }
    const items = getCollectionItems(collection.id);
    res.json({ collection, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch active gallery' });
  }
});

// 7. Set active collection
app.put('/api/gallery/collections/:id/activate', requireAuth, requireAdmin, (req, res) => {
  try {
    setActiveGalleryCollection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to activate collection' });
  }
});

// 8. Delete collection
app.delete('/api/gallery/collections/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    deleteGalleryCollection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// 9. Add image to collection
app.post('/api/gallery/collections/:id/items', requireAuth, requireAdmin, (req, res) => {
  try {
    const { image_id } = req.body;
    if (!image_id) {
      return res.status(400).json({ error: 'image_id is required' });
    }

    // Get current max position
    const items = getCollectionItems(req.params.id);
    const maxPosition = items.length > 0 ? Math.max(...items.map(i => i.position)) : -1;

    const itemId = addImageToCollection({
      collection_id: req.params.id,
      image_id,
      position: maxPosition + 1
    });

    res.json({ success: true, itemId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add image to collection' });
  }
});

// 10. Get collection items
app.get('/api/gallery/collections/:id/items', (req, res) => {
  try {
    const items = getCollectionItems(req.params.id);
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch collection items' });
  }
});

// 11. Remove image from collection
app.delete('/api/gallery/items/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    removeImageFromCollection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// 12. Reorder items (+0.5 bonus: drag&drop)
app.put('/api/gallery/collections/:id/reorder', requireAuth, requireAdmin, (req, res) => {
  try {
    const { items } = req.body; // Array of { id, position }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    reorderCollectionItems(req.params.id, items);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

/* ---------- Forum/Comments API ---------- */

// Categories - Public
app.get('/api/forum/categories', (req, res) => {
  try {
    const categories = getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/forum/categories/:slug', (req, res) => {
  try {
    const category = getCategoryBySlug(req.params.slug);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const subcategories = getSubcategories(category.id);
    res.json({ ...category, subcategories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Categories - Admin only
app.post('/api/forum/categories', requireAuth, requireAdmin, (req, res) => {
  try {
    const { name, slug, description, parent_id } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }
    const result = createCategory(name, slug, description, parent_id);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.put('/api/forum/categories/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const { name, slug, description } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }
    updateCategory(req.params.id, name, slug, description);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/forum/categories/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Moderator assignments - Admin only
app.post('/api/forum/categories/:id/moderators', requireAuth, requireAdmin, (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    assignModeratorToCategory(user_id, req.params.id);
    
    // Notify moderator
    createNotification(
      user_id,
      'moderator_assignment',
      'Nowe przypisanie',
      `Zostałeś przypisany jako moderator do kategorii`
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to assign moderator' });
  }
});

app.delete('/api/forum/categories/:id/moderators/:user_id', requireAuth, requireAdmin, (req, res) => {
  try {
    removeModeratorFromCategory(req.params.user_id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove moderator' });
  }
});

app.get('/api/forum/categories/:id/moderators', requireAuth, requireAdmin, (req, res) => {
  try {
    const moderators = getCategoryModerators(req.params.id);
    res.json(moderators);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch moderators' });
  }
});

// Posts - Public (approved only)
app.get('/api/forum/posts', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const category_id = req.query.category_id;
    
    let posts;
    if (category_id) {
      posts = getPostsByCategory(category_id, limit, offset);
    } else {
      posts = getAllPosts(limit, offset);
    }
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.get('/api/forum/posts/:id', (req, res) => {
  try {
    const post = getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Only show approved posts to non-moderators
    const user = req.session?.userId ? getUserById(req.session.userId) : null;
    const isModerator = user && (user.role === 'moderator' || user.role === 'admin');
    const isAuthor = user && user.id === post.author_id;
    
    if (post.status !== 'approved' && !isModerator && !isAuthor) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create post - Moderator only
app.post('/api/forum/posts', requireAuth, requireModerator, (req, res) => {
  try {
    const { title, content, category_id } = req.body;
    if (!title || !content || !category_id) {
      return res.status(400).json({ error: 'title, content, and category_id are required' });
    }
    
    const user = getUserById(req.session.userId);
    const status = user.role === 'admin' ? 'approved' : 'pending';
    
    const result = createPost(title, content, category_id, req.session.userId, status);
    res.json({ success: true, id: result.lastInsertRowid, status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.put('/api/forum/posts/:id', requireAuth, requireModerator, (req, res) => {
  try {
    const post = getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Only author or admin can edit
    const user = getUserById(req.session.userId);
    if (post.author_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { title, content, category_id } = req.body;
    if (!title || !content || !category_id) {
      return res.status(400).json({ error: 'title, content, and category_id are required' });
    }
    
    updatePost(req.params.id, title, content, category_id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

app.delete('/api/forum/posts/:id', requireAuth, requireModerator, (req, res) => {
  try {
    const post = getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Only author or admin can delete
    const user = getUserById(req.session.userId);
    if (post.author_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    deletePost(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Approve/reject posts - Moderator only
app.post('/api/forum/posts/:id/approve', requireAuth, requireModerator, (req, res) => {
  try {
    const post = getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    approvePost(req.params.id);
    
    // Notify author
    createNotification(
      post.author_id,
      'post_approved',
      'Post zatwierdzony',
      `Twój post "${post.title}" został zatwierdzony`
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve post' });
  }
});

app.post('/api/forum/posts/:id/reject', requireAuth, requireModerator, (req, res) => {
  try {
    const post = getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    rejectPost(req.params.id);
    
    // Notify author
    createNotification(
      post.author_id,
      'post_rejected',
      'Post odrzucony',
      `Twój post "${post.title}" został odrzucony`
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject post' });
  }
});

// Get pending posts - Moderator only
app.get('/api/forum/posts/pending/list', requireAuth, requireModerator, (req, res) => {
  try {
    const user = getUserById(req.session.userId);
    const moderator_id = user.role === 'moderator' ? user.id : null;
    const posts = getPendingPosts(moderator_id);
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pending posts' });
  }
});

// Comments - Public (approved only)
app.get('/api/forum/posts/:id/comments', (req, res) => {
  try {
    const comments = getPostComments(req.params.id);
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create comment - Auth required
app.post('/api/forum/posts/:id/comments', requireAuth, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }
    
    const result = createComment(req.params.id, content, req.session.userId);
    res.json({ success: true, id: result.lastInsertRowid, status: 'pending' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

app.put('/api/forum/comments/:id', requireAuth, (req, res) => {
  try {
    const comment = getCommentById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Only author can edit
    if (comment.author_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }
    
    updateComment(req.params.id, content);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

app.delete('/api/forum/comments/:id', requireAuth, (req, res) => {
  try {
    const comment = getCommentById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Author or moderator can delete
    const user = getUserById(req.session.userId);
    if (comment.author_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    deleteComment(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Approve/reject comments - Moderator only
app.post('/api/forum/comments/:id/approve', requireAuth, requireModerator, (req, res) => {
  try {
    const comment = getCommentById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    approveComment(req.params.id);
    
    // Notify author
    createNotification(
      comment.author_id,
      'comment_approved',
      'Komentarz zatwierdzony',
      'Twój komentarz został zatwierdzony'
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve comment' });
  }
});

app.post('/api/forum/comments/:id/reject', requireAuth, requireModerator, (req, res) => {
  try {
    const comment = getCommentById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    rejectComment(req.params.id);
    
    // Notify author
    createNotification(
      comment.author_id,
      'comment_rejected',
      'Komentarz odrzucony',
      'Twój komentarz został odrzucony'
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject comment' });
  }
});

// Get pending comments - Moderator only
app.get('/api/forum/comments/pending/list', requireAuth, requireModerator, (req, res) => {
  try {
    const user = getUserById(req.session.userId);
    const moderator_id = user.role === 'moderator' ? user.id : null;
    const comments = getPendingComments(moderator_id);
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pending comments' });
  }
});

// Rate comment - Auth required
app.post('/api/forum/comments/:id/rate', requireAuth, (req, res) => {
  try {
    const { rating } = req.body;
    if (rating !== 1 && rating !== -1) {
      return res.status(400).json({ error: 'rating must be 1 or -1' });
    }
    
    rateComment(req.params.id, req.session.userId, rating);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rate comment' });
  }
});

// Notifications - Auth required
app.get('/api/forum/notifications', requireAuth, (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const notifications = getUserNotifications(req.session.userId, unreadOnly);
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/forum/notifications/:id/read', requireAuth, (req, res) => {
  try {
    markNotificationAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.post('/api/forum/notifications/read-all', requireAuth, (req, res) => {
  try {
    markAllNotificationsAsRead(req.session.userId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// User discussions - Auth required
app.post('/api/forum/posts/:id/discuss', requireAuth, (req, res) => {
  try {
    const { message, moderator_id } = req.body;
    if (!message || !moderator_id) {
      return res.status(400).json({ error: 'message and moderator_id are required' });
    }
    
    const result = createDiscussion(req.params.id, req.session.userId, moderator_id, message, true);
    
    // Notify moderator
    createNotification(
      moderator_id,
      'discussion_message',
      'Nowa wiadomość',
      'Użytkownik wysłał wiadomość w dyskusji'
    );
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create discussion message' });
  }
});

app.get('/api/forum/posts/:id/discuss', requireAuth, (req, res) => {
  try {
    const messages = getDiscussionMessages(req.params.id, req.session.userId);
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch discussion messages' });
  }
});

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

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Route dla profili piłkarzy
app.get('/player/:playerId', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'player.html'));
});

// Gallery routes
app.get('/gallery.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'gallery.html'));
});

app.get('/admin-gallery-upload.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-gallery-upload.html'));
});

app.get('/admin-gallery-manage.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-gallery-manage.html'));
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
