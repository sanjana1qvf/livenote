# Setup Guide

## Environment Variables

### For Local Development

1. **Copy the example environment file:**
   ```bash
   cp server/.env.example server/.env
   ```

2. **Edit `server/.env` and add your OpenAI API key:**
   ```bash
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_OPENAI_API_KEY_HERE
   PORT=5000
   NODE_ENV=development
   ```

### For Deployment

When deploying to hosting platforms, set these environment variables:

- **OPENAI_API_KEY**: Your OpenAI API key
- **NODE_ENV**: Set to `production`
- **PORT**: Usually set automatically by the hosting provider

### Getting Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and paste it in your environment variables

**Important**: Never commit your actual API key to version control!

## Local Development

```bash
# Install dependencies
npm run install-all

# Set up environment variables (see above)
cp server/.env.example server/.env
# Edit server/.env with your API key

# Start development servers
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Production Deployment

The app is configured to work with:
- Heroku
- Vercel
- Railway
- Render

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions. 