// Load environment variables
require('dotenv').config({ path: '../.env' });

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

console.log('Auth module - Environment check:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === 'production' 
    ? "https://ai-notetaker-platform.onrender.com/auth/google/callback"
    : "http://localhost:5000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const db = require('./firebase'); // Use Firebase/SQLite interface
    
    // Check if user already exists
    const existingUser = await db.findUserByGoogleId(profile.id);
    
    if (existingUser) {
      // User exists, return user
      console.log('Existing user found:', existingUser.name);
      return done(null, existingUser);
    } else {
      // Create new user
      const newUser = {
        google_id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        picture: profile.photos[0].value
      };
      
      const createdUser = await db.createUser(newUser);
      console.log('New user created:', createdUser.name);
      return done(null, createdUser);
    }
  } catch (error) {
    console.error('Auth error:', error);
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.google_id);
});

// Deserialize user from session
passport.deserializeUser(async (googleId, done) => {
  try {
    const db = require('./firebase'); // Use Firebase/SQLite interface
    const user = await db.findUserByGoogleId(googleId);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
};

module.exports = { passport, requireAuth };
