import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

passport.serializeUser((user, done) => {
  done(null, { id: user.id, provider: user.provider });
});

passport.deserializeUser((obj, done) => done(null, obj));

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'missing',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing',
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  profile.provider = 'google';
  return done(null, profile);
}));

// GitHub OAuth
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || 'missing',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || 'missing',
  callbackURL: '/auth/github/callback'
}, (accessToken, refreshToken, profile, done) => {
  profile.provider = 'github';
  return done(null, profile);
}));

export default passport;