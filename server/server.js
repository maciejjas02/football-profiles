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
  createPurchase, getUserPurchases, updatePurchaseStatus,
  getAllCategories, getCategoryBySlug, getSubcategories, createCategory, updateCategory, deleteCategory,
  getCategoryModerators, assignModeratorToCategory, removeModeratorFromCategory,
  getAllPosts, getPostsByCategory, getPostById, createPost, updatePost, approvePost, rejectPost, deletePost, getPendingPosts,
  getPostComments, createComment, getCommentById, updateComment, approveComment, rejectComment, deleteComment, getPendingComments,
  rateComment, getUserCommentRating, createNotification, getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead,
  createDiscussion, getDiscussionMessages,
  createGalleryImage, getAllGalleryImages, getGalleryImageById, deleteGalleryImage,
  createGalleryCollection, getAllGalleryCollections, getGalleryCollectionById, getActiveGalleryCollection, setActiveGalleryCollection, deleteGalleryCollection,
  addImageToCollection, getCollectionItems, removeImageFromCollection, reorderCollectionItems
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
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://cdn.tiny.cloud"],
    },
  },
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

const issueJwt = (user) => jwt.sign({ sub: user.id, role: user.role }, 'secret', { expiresIn: '1h' });
const setAuthCookies = (res, token) => res.cookie('jwt', token, { httpOnly: true });

function getUserByIdFromReq(req) {
  if (req.session.userId) return req.session.userId;
  const token = req.cookies.jwt;
  if (token) { try { return jwt.verify(token, 'secret').sub; } catch (e) { return null; } }
  return null;
}

// ULEPSZONE: Autoryzacja z ładowaniem obiektu użytkownika do req.user
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

// AUTH
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

// DATA
app.get('/api/player/:id', (req, res) => { const p = getPlayerById(req.params.id); p ? res.json(p) : res.status(404).send(); });
app.get('/api/players/category/:cat', (req, res) => res.json(getPlayersByCategory(req.params.cat)));

// PURCHASES
app.post('/api/purchase', requireAuth, (req, res) => { createPurchase(getUserByIdFromReq(req), req.body.playerId, 299); res.json({ success: true }); });
app.get('/api/user/purchases', requireAuth, (req, res) => res.json(getUserPurchases(getUserByIdFromReq(req))));
app.post('/api/purchases/:id/pay', requireAuth, (req, res) => { updatePurchaseStatus(req.params.id, 'completed'); res.json({success:true}); });

// FORUM
app.post('/api/forum/upload', requireModerator, uploadPostImage.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ location: `/uploads/posts/${req.file.filename}` });
});
app.get('/api/forum/categories', (req, res) => res.json(getAllCategories()));
app.post('/api/forum/categories', requireAdmin, (req, res) => { createCategory(req.body.name, req.body.slug, req.body.description, null); res.json({success:true}); });
app.put('/api/forum/categories/:id', requireAdmin, (req, res) => { updateCategory(req.params.id, req.body.name, req.body.slug, req.body.description); res.json({success:true}); });
app.delete('/api/forum/categories/:id', requireAdmin, (req, res) => { deleteCategory(req.params.id); res.json({success:true}); });

// Zarządzanie moderatorami kategorii
app.get('/api/forum/categories/:id/moderators', requireAdmin, (req, res) => {
    res.json(getCategoryModerators(req.params.id));
});
app.post('/api/forum/categories/:id/moderators', requireAdmin, (req, res) => {
    assignModeratorToCategory(req.body.user_id, req.params.id);
    res.json({ success: true });
});
app.delete('/api/forum/categories/:catId/moderators/:userId', requireAdmin, (req, res) => {
    removeModeratorFromCategory(req.params.userId, req.params.catId);
    res.json({ success: true });
});

app.get('/api/forum/posts', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    if(req.query.category_id) res.json(getPostsByCategory(req.query.category_id, limit, offset));
    else res.json(getAllPosts(limit, offset));
});
app.get('/api/forum/posts/pending/list', requireAuth, requireModerator, (req, res) => res.json(getPendingPosts()));
app.get('/api/forum/posts/:id', (req, res) => { 
    const p = getPostById(req.params.id); 
    p ? res.json(p) : res.status(404).json({error: 'Not found'}); 
});
app.post('/api/forum/posts', requireModerator, (req, res) => {
  const id = getUserByIdFromReq(req);
  const user = getUserById(id);
  const status = user.role === 'admin' ? 'approved' : 'pending';
  const result = createPost(req.body.title, req.body.content || '', req.body.category_id, id, status);
  res.json({ success: true, id: result.lastInsertRowid });
});
app.put('/api/forum/posts/:id', requireModerator, (req, res) => {
  try {
    updatePost(
      req.params.id, 
      req.body.title, 
      req.body.content, 
      req.body.category_id
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/forum/posts/:id', requireModerator, (req, res) => {
  try {
    deletePost(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Powiadomienia po zatwierdzeniu/odrzuceniu postów
app.post('/api/forum/posts/:id/approve', requireModerator, async (req, res) => { 
    const post = await getPostById(req.params.id);
    approvePost(req.params.id);
    if(post) createNotification(post.author_id, 'post_approved', 'Post zatwierdzony', `Twój post "${post.title}" został zatwierdzony.`, `/post.html?id=${post.id}`);
    res.json({success:true}); 
});
app.post('/api/forum/posts/:id/reject', requireModerator, async (req, res) => { 
    const post = await getPostById(req.params.id);
    rejectPost(req.params.id);
    if(post) createNotification(post.author_id, 'post_rejected', 'Post odrzucony', `Twój post "${post.title}" został odrzucony.`, `/moderator-posts.html`);
    res.json({success:true}); 
});

app.get('/api/forum/posts/:id/comments', (req, res) => res.json(getPostComments(req.params.id, getUserByIdFromReq(req))));
app.post('/api/forum/posts/:id/comments', requireAuth, (req, res) => { createComment(req.params.id, req.body.content, getUserByIdFromReq(req)); res.json({success:true}); });
app.post('/api/forum/comments/:id/rate', requireAuth, (req, res) => {
    try {
        const commentId = parseInt(req.params.id, 10);
        const userId = req.user.id; // Użycie req.user z requireAuth
        const rating = parseInt(req.body.rating, 10);

        if (isNaN(commentId) || isNaN(rating)) {
            return res.status(400).json({ error: "Nieprawidłowe dane (NaN)" });
        }

        rateComment(commentId, userId, rating);
        res.json({ success: true });
    } catch (e) {
        console.error("Błąd oceniania:", e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint do edycji komentarza (dla moderatora)
app.put('/api/forum/comments/:id', requireModerator, (req, res) => { 
    updateComment(req.params.id, req.body.content); 
    res.json({ success: true }); 
});

app.get('/api/forum/comments/pending/list', requireAuth, requireModerator, (req, res) => res.json(getPendingComments()));

// Powiadomienia po zatwierdzeniu/odrzuceniu komentarzy
app.post('/api/forum/comments/:id/approve', requireModerator, async (req, res) => { 
    const comment = await getCommentById(req.params.id);
    approveComment(req.params.id); 
    if(comment) createNotification(comment.author_id, 'comment_approved', 'Komentarz zatwierdzony', 'Twój komentarz został zatwierdzony.', `/post.html?id=${comment.post_id}`);
    res.json({success:true}); 
});
app.post('/api/forum/comments/:id/reject', requireModerator, async (req, res) => { 
    const comment = await getCommentById(req.params.id);
    rejectComment(req.params.id); 
    if(comment) createNotification(comment.author_id, 'comment_rejected', 'Komentarz odrzucony', 'Twój komentarz został odrzucony.', `/post.html?id=${comment.post_id}`);
    res.json({success:true}); 
});

// API Powiadomień
app.get('/api/user/notifications', requireAuth, (req, res) => res.json(getUserNotifications(req.user.id)));
app.post('/api/user/notifications/:id/read', requireAuth, (req, res) => { markNotificationAsRead(req.params.id); res.json({success:true}); });
app.post('/api/user/notifications/read-all', requireAuth, (req, res) => { markAllNotificationsAsRead(req.user.id); res.json({success:true}); });


// GALLERY API
app.post('/api/gallery/upload', requireAdmin, uploadGalleryImage.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({error:'No file'});
    
    // Użycie dynamicznego importu Sharp
    const { default: sharp } = await import('sharp');
    
    sharp(req.file.path).resize(400).toFile(path.join(galleryThumbDir, req.file.filename));
    
    // Zmieniono, aby używać obiektu danych
    createGalleryImage({filename: req.file.filename, title: req.body.title, description: req.body.description, width:0, height:0});
    
    res.json({success:true});
});
app.get('/api/gallery/images', (req, res) => res.json(getAllGalleryImages()));
app.delete('/api/gallery/images/:id', requireAdmin, (req, res) => { deleteGalleryImage(req.params.id); res.json({success:true}); });
app.get('/api/gallery/collections', (req, res) => res.json(getAllGalleryCollections()));
app.post('/api/gallery/collections', requireAdmin, (req, res) => { createGalleryCollection(req.body); res.json({success:true}); });
app.put('/api/gallery/collections/:id/activate', requireAdmin, (req, res) => { setActiveGalleryCollection(req.params.id); res.json({success:true}); });
app.delete('/api/gallery/collections/:id', requireAdmin, (req, res) => { deleteGalleryCollection(req.params.id); res.json({success:true}); });
app.get('/api/gallery/collections/:id/items', (req, res) => res.json(getCollectionItems(req.params.id)));
app.post('/api/gallery/collections/:id/items', requireAdmin, (req, res) => { 
    const items = getCollectionItems(req.params.id);
    addImageToCollection({ collection_id: req.params.id, image_id: req.body.image_id, position: items.length });
    res.json({success:true});
});
app.delete('/api/gallery/items/:id', requireAdmin, (req, res) => { removeImageFromCollection(req.params.id); res.json({success:true}); });
app.put('/api/gallery/collections/:id/reorder', requireAdmin, (req, res) => { reorderCollectionItems(req.params.id, req.body.items); res.json({success:true}); });
app.get('/api/gallery/active', (req, res) => {
    const c = getActiveGalleryCollection();
    if(!c) return res.json({items:[]});
    res.json({items: getCollectionItems(c.id)});
});

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

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));