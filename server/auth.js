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
    const { db } = require('./database');
    
    // Check if user already exists
    db.get('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, user) => {
      if (err) {
        return done(err, null);
      }
      
      if (user) {
        // User exists, return user
        return done(null, user);
      } else {
        // Create new user
        const newUser = {
          google_id: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          picture: profile.photos[0].value
        };
        
        db.run(
          'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)',
          [newUser.google_id, newUser.email, newUser.name, newUser.picture],
          function(err) {
            if (err) {
              return done(err, null);
            }
            newUser.id = this.lastID;
            return done(null, newUser);
          }
        );
      }
    });
  } catch (error) {
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.google_id);
});

// Deserialize user from session
passport.deserializeUser((googleId, done) => {
  const { db } = require('./database');
  db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, user) => {
    done(err, user);
  });
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

module.exports = { passport, requireAuth };
