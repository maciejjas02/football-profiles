// server/server.js
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
import fs from 'fs';
import './passport.js';
import nodemailer from 'nodemailer'; // <--- DODANO

const isProd = process.env.NODE_ENV === 'production';
const usePostgreSQL = process.env.USE_POSTGRESQL === 'true';

let dbFunctions;
if (usePostgreSQL) {
  console.log('Using PostgreSQL database');
  dbFunctions = await import('./db-postgres.js');
} else {
  console.log('Using SQLite database');
  dbFunctions = await import('./db.js');
}

const {
  ensureSchema, ensureSeedAdmin, ensureSeedClubs, ensureSeedPlayers, ensureSeedCategories,
  findUserByLogin, getUserById, createOrUpdateUserFromProvider, existsUserByEmail, existsUserByUsername, createLocalUser,
  getPlayerById, getPlayersByCategory, getAllClubs, getClubById,
  createPurchase, getUserPurchases, updatePurchaseStatus, getAllPurchases,
  // --- KOSZYK ---
  getCartItems, addToCart, removeFromCart, checkoutCart,
  // --- FORUM ---
  getAllCategories, getCategoryBySlug, getSubcategories, createCategory, updateCategory, deleteCategory,
  getCategoryModerators, assignModeratorToCategory, removeModeratorFromCategory,
  getAllPosts, getPostsByCategory, getPostById, createPost, updatePost, approvePost, rejectPost, deletePost, getPendingPosts,
  getPostComments, createComment, getCommentById, updateComment, approveComment, rejectComment, deleteComment, getPendingComments,
  rateComment, getUserCommentRating, createNotification, getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead,
  createDiscussion, getDiscussionMessages, getDiscussionUsers,
  createGalleryImage, getAllGalleryImages, getGalleryImageById, deleteGalleryImage,
  createGalleryCollection, getAllGalleryCollections, getGalleryCollectionById, getActiveGalleryCollection, setActiveGalleryCollection, deleteGalleryCollection,
  addImageToCollection, getCollectionItems, removeImageFromCollection, reorderCollectionItems,
  updateUserAddress // <--- DODANO
} = dbFunctions;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

const postsUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'posts');
const galleryUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'gallery');
const galleryThumbDir = path.join(galleryUploadDir, 'thumbnails');

[postsUploadDir, galleryUploadDir, galleryThumbDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const postStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, postsUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const uploadPostImage = multer({ storage: postStorage });

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, galleryUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const uploadGalleryImage = multer({ storage: galleryStorage });

app.use(compression());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tiny.cloud", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tiny.cloud", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "*"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://cdn.tiny.cloud"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use(session({
  secret: 'secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: isProd }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, '..', 'public')));

const csrfProtection = csrf({ cookie: true });
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  return csrfProtection(req, res, next);
});

await ensureSchema();
await ensureSeedAdmin();
await ensureSeedClubs();
await ensureSeedPlayers();
ensureSeedCategories();

// --- Konfiguracja Email (Mock Ethereal do testów - użyj swoich danych z .env w prod) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'ethereal.user@ethereal.email', // Zmień na swoje
    pass: 'ethereal.pass' // Zmień na swoje
  }
});

// Funkcja pomocnicza do wysyłania (loguje w konsoli, aby uniknąć błędów SMTP)
const sendEmail = async (to, subject, html) => {
  console.log(`📧 [EMAIL SYSTEM] Do: ${to} | Temat: ${subject}`);
  // Aby aktywować prawdziwą wysyłkę, odkomentuj i skonfiguruj auth:
  /*
  try {
      await transporter.sendMail({
          from: '"Football Shop" <sklep@foot.ball>',
          to,
          subject,
          html
      });
      console.log(`📧 [EMAIL SENT] Successfully to: ${to}`);
  } catch (e) {
      console.error("❌ Błąd wysyłki maila:", e);
  }
  */
};
// --------------------------------------------------------------------------------------


const issueJwt = (user) => jwt.sign({ sub: user.id, role: user.role }, 'secret', { expiresIn: '1h' });
const setAuthCookies = (res, token) => res.cookie('jwt', token, { httpOnly: true });

function getUserByIdFromReq(req) {
  if (req.session.userId) return req.session.userId;
  const token = req.cookies.jwt;
  if (token) { try { return jwt.verify(token, 'secret').sub; } catch (e) { return null; } }
  return null;
}

function requireAuth(req, res, next) {
  const id = getUserByIdFromReq(req);
  if (!id) return res.status(401).json({ error: 'Wymagane logowanie' });
  req.user = getUserById(id);
  if (!req.user) return res.status(401).json({ error: 'Niepoprawny użytkownik' });
  next();
}

function requireModerator(req, res, next) {
  if (!req.user) return requireAuth(req, res, () => requireModerator(req, res, next));
  if (req.user.role !== 'moderator' && req.user.role !== 'admin') return res.status(403).json({ error: 'Moderator lub Admin wymagany' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireAuth(req, res, () => requireAdmin(req, res, next));
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin wymagany' });
  next();
}

// --- AUTH ---

// --- OAUTH ROUTES  ---
//google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      const user = await createOrUpdateUserFromProvider('google', req.user);

      req.session.userId = user.id;
      setAuthCookies(res, issueJwt(user));
      res.redirect('/dashboard.html');
    } catch (e) {
      console.error('Google Auth Error:', e);
      res.redirect('/?error=oauth_failed');
    }
  }
);

//github
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      const user = await createOrUpdateUserFromProvider('github', req.user);

      req.session.userId = user.id;
      setAuthCookies(res, issueJwt(user));

      res.redirect('/dashboard.html');
    } catch (e) {
      console.error('GitHub Auth Error:', e);
      res.redirect('/?error=oauth_failed');
    }
  }
);

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, name } = req.body;
    if (!email || !username || !password) return res.status(400).json({ error: 'Wymagane pola' });
    if (await existsUserByEmail(email)) return res.status(400).json({ error: 'Email zajęty' });
    if (await existsUserByUsername(username)) return res.status(400).json({ error: 'Login zajęty' });
    const newUser = await createLocalUser({ email, username, password, name });
    req.session.userId = newUser.id;
    setAuthCookies(res, issueJwt(newUser));
    res.json({ success: true, user: newUser });
  } catch (e) { res.status(500).json({ error: 'Błąd serwera' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = findUserByLogin(login);
    if (!user) return res.status(401).json({ error: 'Zły login' });
    const bcrypt = (await import('bcrypt')).default;
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Złe hasło' });
    req.session.userId = user.id;
    setAuthCookies(res, issueJwt(user));
    res.json({ user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.clearCookie('jwt'); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => {
  const id = getUserByIdFromReq(req);
  if (!id) return res.status(401).json({ error: 'Not auth' });
  const user = getUserById(id);
  res.json({ user });
});

// --- DATA ---
app.get('/api/player/:id', (req, res) => { const p = getPlayerById(req.params.id); p ? res.json(p) : res.status(404).send(); });
app.get('/api/players/category/:cat', (req, res) => res.json(getPlayersByCategory(req.params.cat)));

// PURCHASES (OLD)
app.post('/api/purchase', requireAuth, (req, res) => { createPurchase(getUserByIdFromReq(req), req.body.playerId, 299); res.json({ success: true }); });
app.get('/api/user/purchases', requireAuth, (req, res) => res.json(getUserPurchases(getUserByIdFromReq(req))));

// --- NOWY ENDPOINT: Aktualizacja adresu (MIN WYMAGANIE) ---
app.put('/api/user/address', requireAuth, (req, res) => {
  const { address, city, postalCode } = req.body;
  if (!address || !city || !postalCode) {
    return res.status(400).json({ error: 'Wypełnij wszystkie pola adresu' });
  }
  updateUserAddress(req.user.id, address, city, postalCode);
  res.json({ success: true });
});

// --- ZAKTUALIZOWANA PŁATNOŚĆ (SANDBOX + MAIL) ---
app.post('/api/purchases/:id/pay', requireAuth, async (req, res) => {
  updatePurchaseStatus(req.params.id, 'completed');

  // Wyślij Email o płatności (+0.5/1.0 Bonus support)
  const user = getUserById(req.user.id);
  await sendEmail(
    user.email,
    'Płatność zaksięgowana!',
    `<h1>Twoje zamówienie #${req.params.id} jest opłacone!</h1>
         <p>Dziękujemy za płatność. Status Twojego zamówienia został zmieniony na <strong>Opłacone</strong>. Paczka wkrótce wyruszy w drogę!</p>`
  );

  res.json({ success: true });
});


// --- CART API ---
app.get('/api/cart', requireAuth, (req, res) => { res.json(getCartItems(getUserByIdFromReq(req))); });
app.post('/api/cart', requireAuth, (req, res) => { addToCart(getUserByIdFromReq(req), req.body.playerId); res.json({ success: true, message: "Dodano do koszyka" }); });
app.delete('/api/cart/:id', requireAuth, (req, res) => { removeFromCart(getUserByIdFromReq(req), req.params.id); res.json({ success: true }); });

// --- ZAKTUALIZOWANY CHECKOUT (Z WALIDACJĄ ADRESU I MAILEM) ---
app.post('/api/cart/checkout', requireAuth, async (req, res) => {
  try {
    // 1. Sprawdź czy user ma adres (MIN WYMAGANIE)
    const user = getUserById(req.user.id);
    if (!user.address || !user.city || !user.postal_code) {
      return res.status(400).json({ error: 'Brak pełnych danych do wysyłki (adres, miasto, kod pocztowy). Uzupełnij profil.' });
    }

    // 2. Oblicz kwotę dla maila
    const cartItems = getCartItems(user.id);
    if (cartItems.length === 0) throw new Error("Koszyk jest pusty");
    const total = cartItems.reduce((sum, item) => sum + (item.jersey_price * item.quantity), 0);

    // 3. Wykonaj logikę bazy
    checkoutCart(user.id);

    // 4. Wyślij Email (+0.5 Bonus)
    await sendEmail(
      user.email,
      `Potwierdzenie zamówienia (${new Date().toLocaleDateString()})`,
      `<h1>Dziękujemy za zamówienie!</h1>
             <p>Wysyłamy na adres: <strong>${user.address}, ${user.postal_code} ${user.city}</strong></p>
             <p>Kwota do zapłaty: <strong>${total} zł</strong></p>
             <p>Status: Oczekuje na płatność. Przejdź do 'Moja Kolekcja' aby opłacić.</p>`
    );

    res.json({ success: true, message: "Zamówienie złożone! Sprawdź maila." });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- ADMIN ORDERS ---
app.get('/api/admin/orders', requireModerator, (req, res) => {
  const orders = getAllPurchases();
  res.json(orders);
});
app.put('/api/admin/orders/:id/status', requireModerator, (req, res) => {
  const { status } = req.body;
  updatePurchaseStatus(req.params.id, status);
  console.log(`[EMAIL MOCK] Do: User (ID: ${req.params.id}) - Status zmieniony na: ${status}`);
  res.json({ success: true });
});

// --- FORUM ---
app.post('/api/forum/upload', requireModerator, uploadPostImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ location: `/uploads/posts/${req.file.filename}` });
});
app.get('/api/forum/categories', (req, res) => res.json(getAllCategories()));
app.get('/api/forum/categories/:id/subcategories', async (req, res) => { res.json(await getSubcategories(req.params.id)); });
app.post('/api/forum/categories', requireAdmin, (req, res) => { createCategory(req.body.name, req.body.slug, req.body.description, req.body.parent_id || null); res.json({ success: true }); });
app.put('/api/forum/categories/:id', requireAdmin, (req, res) => { updateCategory(req.params.id, req.body.name, req.body.slug, req.body.description); res.json({ success: true }); });
app.delete('/api/forum/categories/:id', requireAdmin, (req, res) => { deleteCategory(req.params.id); res.json({ success: true }); });
app.get('/api/forum/categories/:id/moderators', requireAdmin, (req, res) => { res.json(getCategoryModerators(req.params.id)); });
app.post('/api/forum/categories/:id/moderators', requireAdmin, (req, res) => { assignModeratorToCategory(req.body.user_id, req.params.id); res.json({ success: true }); });
app.delete('/api/forum/categories/:catId/moderators/:userId', requireAdmin, (req, res) => { removeModeratorFromCategory(req.params.userId, req.params.catId); res.json({ success: true }); });

app.get('/api/forum/posts', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  if (req.query.category_id) res.json(getPostsByCategory(req.query.category_id, limit, offset));
  else res.json(getAllPosts(limit, offset));
});
app.get('/api/forum/posts/pending/list', requireAuth, requireModerator, (req, res) => res.json(getPendingPosts()));
app.get('/api/forum/posts/:id', (req, res) => { const p = getPostById(req.params.id); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); });
app.post('/api/forum/posts', requireModerator, (req, res) => {
  const id = getUserByIdFromReq(req);
  const user = getUserById(id);
  const status = user.role === 'admin' ? 'approved' : 'pending';
  const result = createPost(req.body.title, req.body.content || '', req.body.category_id, id, status);
  res.json({ success: true, id: result.lastInsertRowid });
});
app.put('/api/forum/posts/:id', requireModerator, (req, res) => { updatePost(req.params.id, req.body.title, req.body.content, req.body.category_id); res.json({ success: true }); });
app.delete('/api/forum/posts/:id', requireModerator, (req, res) => { deletePost(req.params.id); res.json({ success: true }); });
app.post('/api/forum/posts/:id/approve', requireModerator, async (req, res) => {
  const post = await getPostById(req.params.id);
  approvePost(req.params.id);
  if (post) createNotification(post.author_id, 'post_approved', 'Post zatwierdzony', `Twój post "${post.title}" został zatwierdzony.`, `/post.html?id=${post.id}`);
  res.json({ success: true });
});
app.post('/api/forum/posts/:id/reject', requireModerator, async (req, res) => {
  const post = await getPostById(req.params.id);
  rejectPost(req.params.id);
  if (post) createNotification(post.author_id, 'post_rejected', 'Post odrzucony', `Twój post "${post.title}" został odrzucony.`, `/moderator-posts.html`);
  res.json({ success: true });
});

app.get('/api/forum/posts/:id/comments', (req, res) => res.json(getPostComments(req.params.id, getUserByIdFromReq(req))));
app.post('/api/forum/posts/:id/comments', requireAuth, (req, res) => { createComment(req.params.id, req.body.content, getUserByIdFromReq(req)); res.json({ success: true }); });
app.post('/api/forum/comments/:id/rate', requireAuth, (req, res) => { rateComment(parseInt(req.params.id), req.user.id, parseInt(req.body.rating)); res.json({ success: true }); });
app.put('/api/forum/comments/:id', requireModerator, (req, res) => { updateComment(req.params.id, req.body.content); res.json({ success: true }); });
app.put('/api/forum/comments/:id/user-edit', requireAuth, async (req, res) => {
  const comment = await getCommentById(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Komentarz nie istnieje' });
  if (comment.author_id !== req.user.id) return res.status(403).json({ error: 'Brak uprawnień' });
  if (comment.status !== 'pending') return res.status(400).json({ error: 'Można edytować tylko oczekujące komentarze' });
  updateComment(req.params.id, req.body.content);
  res.json({ success: true });
});
app.get('/api/forum/comments/pending/list', requireAuth, requireModerator, (req, res) => res.json(getPendingComments()));
app.post('/api/forum/comments/:id/approve', requireModerator, async (req, res) => {
  const comment = await getCommentById(req.params.id);
  approveComment(req.params.id);
  if (comment) createNotification(comment.author_id, 'comment_approved', 'Komentarz zatwierdzony', 'Twój komentarz został zatwierdzony.', `/post.html?id=${comment.post_id}`);
  res.json({ success: true });
});
app.post('/api/forum/comments/:id/reject', requireModerator, async (req, res) => {
  const comment = await getCommentById(req.params.id);
  rejectComment(req.params.id);
  if (comment) createNotification(comment.author_id, 'comment_rejected', 'Komentarz odrzucony', 'Twój komentarz został odrzucony.', `/post.html?id=${comment.post_id}`);
  res.json({ success: true });
});

// --- DYSKUSJE ---
app.get('/api/discussion/:postId/my', requireAuth, (req, res) => { res.json(getDiscussionMessages(req.params.postId, req.user.id)); });
app.post('/api/discussion/:postId', requireAuth, (req, res) => {
  createDiscussion(req.params.postId, req.user.id, req.body.message, 'user');
  createNotification(1, 'report', 'Nowe zgłoszenie', `Użytkownik ${req.user.username} napisał w sprawie posta ${req.params.postId}`, `/post.html?id=${req.params.postId}`);
  res.json({ success: true });
});
app.get('/api/discussion/:postId/users', requireModerator, (req, res) => { res.json(getDiscussionUsers(req.params.postId)); });
app.get('/api/discussion/:postId/user/:userId', requireModerator, (req, res) => { res.json(getDiscussionMessages(req.params.postId, req.params.userId)); });
app.post('/api/discussion/:postId/reply/:userId', requireModerator, (req, res) => {
  createDiscussion(req.params.postId, req.params.userId, req.body.message, 'moderator');
  createNotification(req.params.userId, 'reply', 'Odpowiedź moderatora', 'Moderator odpowiedział na Twoje zgłoszenie.', `/post.html?id=${req.params.postId}`);
  res.json({ success: true });
});

// --- NOTIFICATIONS ---
app.get('/api/user/notifications', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  res.json(getUserNotifications(req.user.id, limit, offset));
});
app.post('/api/user/notifications/:id/read', requireAuth, (req, res) => { markNotificationAsRead(req.params.id); res.json({ success: true }); });
app.post('/api/user/notifications/read-all', requireAuth, (req, res) => { markAllNotificationsAsRead(req.user.id); res.json({ success: true }); });

// --- GALERIA ---
app.post('/api/gallery/upload', requireAdmin, uploadGalleryImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { default: sharp } = await import('sharp');
  sharp(req.file.path).resize(400).toFile(path.join(galleryThumbDir, req.file.filename));
  createGalleryImage({ filename: req.file.filename, title: req.body.title, description: req.body.description, width: 0, height: 0 });
  res.json({ success: true });
});
app.get('/api/gallery/images', (req, res) => res.json(getAllGalleryImages()));
app.delete('/api/gallery/images/:id', requireAdmin, (req, res) => { deleteGalleryImage(req.params.id); res.json({ success: true }); });
app.get('/api/gallery/collections', (req, res) => res.json(getAllGalleryCollections()));
app.post('/api/gallery/collections', requireAdmin, (req, res) => { createGalleryCollection(req.body); res.json({ success: true }); });
app.put('/api/gallery/collections/:id/activate', requireAdmin, (req, res) => { setActiveGalleryCollection(req.params.id); res.json({ success: true }); });
app.delete('/api/gallery/collections/:id', requireAdmin, (req, res) => { deleteGalleryCollection(req.params.id); res.json({ success: true }); });
app.get('/api/gallery/collections/:id/items', (req, res) => res.json(getCollectionItems(req.params.id)));
app.post('/api/gallery/collections/:id/items', requireAdmin, (req, res) => {
  const items = getCollectionItems(req.params.id);
  addImageToCollection({ collection_id: req.params.id, image_id: req.body.image_id, position: items.length });
  res.json({ success: true });
});
app.delete('/api/gallery/items/:id', requireAdmin, (req, res) => { removeImageFromCollection(req.params.id); res.json({ success: true }); });
app.put('/api/gallery/collections/:id/reorder', requireAdmin, (req, res) => { reorderCollectionItems(req.params.id, req.body.items); res.json({ success: true }); });
app.get('/api/gallery/active', (req, res) => {
  const c = getActiveGalleryCollection();
  if (!c) return res.json({ items: [] });
  res.json({ items: getCollectionItems(c.id) });
});

// STATIC & FALLBACK
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/player.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'player.html')));
app.get('/my-collection.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'my-collection.html')));
app.get('/forum.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'forum.html')));
app.get('/post.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'post.html')));
app.get('/moderator-posts.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'moderator-posts.html')));
app.get('/moderator-comments.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'moderator-comments.html')));
app.get('/admin-categories.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin-categories.html')));
app.get('/gallery.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'gallery.html')));
app.get('/admin-gallery-upload.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin-gallery-upload.html')));
app.get('/admin-gallery-manage.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin-gallery-manage.html')));
// Nowa strona zamówień
app.get('/admin-orders.html', requireModerator, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin-orders.html')));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));