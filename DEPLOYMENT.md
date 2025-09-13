# Deployment Guide

This guide will help you deploy the AI Notetaker Platform to various hosting services.

## 🚀 Quick Deploy Options

### Option 1: Heroku (Recommended for beginners)

#### Step 1: Prepare Repository
1. Push your code to GitHub
2. Make sure your OpenAI API key is ready

#### Step 2: Deploy to Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Or manually:
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set OPENAI_API_KEY=your_openai_api_key_here
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Option 2: Vercel (Great for frontend + serverless)

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Deploy
```bash
vercel --prod
```

#### Step 3: Set Environment Variables
- Go to Vercel Dashboard
- Add `OPENAI_API_KEY` in environment variables

### Option 3: Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/yourusername/ai-notetaker-platform)

### Option 4: Render

1. Connect your GitHub repository
2. Set build command: `npm run deploy:build`
3. Set start command: `npm start`
4. Add environment variable: `OPENAI_API_KEY`

## 🔧 Environment Variables

Required environment variables for production:

```bash
NODE_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
PORT=5000  # Usually set automatically by hosting provider
```

## 📦 Build Process

The deployment process runs:
1. `npm run deploy:build` - Installs all dependencies and builds React app
2. `npm start` - Starts the production server

## 🔍 Troubleshooting

### Common Issues:

1. **Build Fails**: Make sure all dependencies are in package.json
2. **API Key Issues**: Verify OPENAI_API_KEY is set correctly
3. **Database Issues**: SQLite database is created automatically
4. **File Upload Issues**: Check file size limits (25MB max)

### Logs:
```bash
# Heroku logs
heroku logs --tail

# Vercel logs
vercel logs

# Railway logs
railway logs
```

## 📱 Mobile Optimization

The app is fully optimized for mobile devices and will work great on:
- Mobile phones (iOS/Android)
- Tablets
- Desktop computers

## 🔒 Security Notes

- Never commit API keys to GitHub
- Use environment variables for all secrets
- The app uses HTTPS in production
- File uploads are validated and size-limited

## 💰 Cost Considerations

- **Hosting**: Most services offer free tiers
- **OpenAI API**: Pay per usage (transcription + text generation)
- **Storage**: SQLite database grows with usage

## 🎯 Performance Tips

- Audio files are automatically cleaned up after processing
- Database is optimized for quick queries
- React build is optimized for production
- Gzip compression is enabled

Happy deploying! 🚀 