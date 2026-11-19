import jwt from 'jsonwebtoken';
import { getUserById } from '../db.js';

export function createAuthMiddleware(jwtSecret) {
  function getUserByIdFromReq(req) {
    if (req.session?.userId) return req.session.userId;
    const token = req.cookies?.jwt;
    if (token) {
      try {
        return jwt.verify(token, jwtSecret).sub;
      } catch {
        return null;
      }
    }
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
    if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Moderator lub Admin wymagany' });
    }
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.user) return requireAuth(req, res, () => requireAdmin(req, res, next));
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin wymagany' });
    next();
  }

  function attachCurrentUser(req, res, next) {
    const id = getUserByIdFromReq(req);
    req.user = id ? getUserById(id) : null;
    res.locals.user = req.user;
    next();
  }

  return { getUserByIdFromReq, requireAuth, requireModerator, requireAdmin, attachCurrentUser };
}
