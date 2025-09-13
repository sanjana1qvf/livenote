# Google OAuth Setup Instructions

To enable Google Sign-In for your AI Notetaker platform, follow these steps:

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project" or select existing project
3. Give it a name like "AI Notetaker Platform"

## 2. Enable Google+ API

1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google+ API" 
3. Click on it and press "Enable"

## 3. Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure OAuth consent screen first:
   - Choose "External" user type
   - Fill in app name: "AI Notetaker Platform"
   - Add your email as developer contact
   - Add authorized domains (for production)

## 4. Configure OAuth Client

1. Application type: "Web application"
2. Name: "AI Notetaker Web Client"
3. Authorized JavaScript origins:
   - `http://localhost:5000` (for development)
   - `https://your-render-url.onrender.com` (for production)
4. Authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback` (for development)
   - `https://your-render-url.onrender.com/auth/google/callback` (for production)

## 5. Get Your Credentials

1. After creating, you'll see your:
   - Client ID (looks like: `123456789-abcdef.apps.googleusercontent.com`)
   - Client Secret (looks like: `GOCSPX-abcdef123456`)

## 6. Update Environment Variables

### For Local Development:
Update your `.env` file in the project root:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=your_random_session_secret_here
```

### For Production (Render):
Add these environment variables in your Render dashboard:

1. Go to your Render service
2. Click "Environment" tab
3. Add:
   - `GOOGLE_CLIENT_ID` = your client ID
   - `GOOGLE_CLIENT_SECRET` = your client secret  
   - `SESSION_SECRET` = a random string (generate one)

## 7. Update Production URLs

In `server/index-with-auth.js` and `server/auth.js`, replace:
- `https://your-app.onrender.com` with your actual Render URL

## 8. Test the Setup

1. Start your development server: `npm run dev`
2. Go to `http://localhost:3000`
3. You should see the Google Sign-In button
4. Click it to test the OAuth flow

## Security Notes

- Never commit your `.env` file to Git
- Use strong, random session secrets
- Only add trusted domains to authorized origins
- Review OAuth consent screen settings for production

## Troubleshooting

- **"Unauthorized JavaScript origin"**: Check your origins in Google Console
- **"Redirect URI mismatch"**: Check your callback URLs match exactly
- **"Invalid client"**: Verify your client ID and secret are correct
- **CORS errors**: Make sure origins are properly configured

Once setup is complete, students can sign in with their Google accounts and their lectures will be private and secure!
