# Heroku Deployment Guide

Deploy the Miksir application to Heroku in minutes.

## Prerequisites

- Heroku account (free tier works)
- Heroku CLI installed: https://devcenter.heroku.com/articles/heroku-cli

## Backend Deployment

### 1. Prepare Backend

```bash
cd backend

# Create Procfile
echo "web: node src/index.js" > Procfile

# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"
```

### 2. Create Heroku App

```bash
# Login to Heroku
heroku login

# Create app (replace 'your-app-name' with unique name)
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini
```

### 3. Configure Environment Variables

```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_KEY=your-supabase-anon-key
heroku config:set ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
heroku config:set JWT_SECRET=your-random-secret-at-least-32-chars
heroku config:set CORS_ORIGIN=https://your-frontend-domain.netlify.app

# Verify configuration
heroku config
```

### 4. Deploy

```bash
# Deploy to Heroku
git push heroku main

# Or if on a different branch:
git push heroku your-branch:main
```

### 5. Initialize Database

```bash
# Get database credentials
heroku pg:credentials:url

# Connect and run schema
heroku pg:psql < schema.sql

# Or manually:
heroku pg:psql
# Then paste the contents of schema.sql
```

### 6. Seed Database (Optional)

```bash
# Run seed script
heroku run node src/data/seed.js
```

### 7. Test Backend

```bash
# Open in browser
heroku open

# Or test API directly
curl https://your-app-name.herokuapp.com/api/health

# View logs
heroku logs --tail
```

## Frontend Deployment (Netlify)

### Option 1: Drag and Drop

1. Go to https://app.netlify.com/
2. Sign up/login
3. Drag the `frontend` folder to Netlify
4. Update API endpoint in the deployed file

### Option 2: Netlify CLI

```bash
cd frontend

# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy

# For production
netlify deploy --prod
```

### Option 3: Git Integration

1. Push your code to GitHub
2. Connect Netlify to your repository
3. Set build settings:
   - Base directory: `frontend`
   - Build command: (leave empty)
   - Publish directory: `frontend`

## Update Frontend API Endpoint

After backend is deployed, update the API endpoint in your frontend:

```javascript
// In frontend/index.html
const API_BASE_URL = 'https://your-app-name.herokuapp.com';
```

Redeploy frontend after making this change.

## Frontend Deployment (Vercel)

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# For production
vercel --prod
```

## Frontend Deployment (GitHub Pages)

```bash
# From project root
git add frontend/
git commit -m "Add frontend"
git push origin main

# Enable GitHub Pages
# Go to repository Settings → Pages
# Select branch and /frontend folder
```

Update API endpoint to your Heroku backend URL.

## Environment-Specific Configuration

### Production Checklist

- [ ] Strong JWT_SECRET set
- [ ] Correct CORS_ORIGIN configured
- [ ] Supabase production project used
- [ ] Anthropic API key for production
- [ ] Database backups enabled
- [ ] SSL/HTTPS enforced
- [ ] Error logging configured

## Heroku Add-ons (Optional)

### Monitoring
```bash
heroku addons:create papertrail:choklad
```

### Logging
```bash
heroku addons:create logentries:le_tryit
```

### Database Backups
```bash
heroku pg:backups:schedule --at '02:00 America/Los_Angeles'
```

### Performance Monitoring
```bash
heroku addons:create newrelic:wayne
```

## Scaling

### Increase Dynos
```bash
# View current dynos
heroku ps

# Scale up
heroku ps:scale web=2

# Scale down
heroku ps:scale web=1
```

### Upgrade Database
```bash
# View current plan
heroku addons

# Upgrade
heroku addons:upgrade heroku-postgresql:standard-0
```

## Maintenance

### View Logs
```bash
heroku logs --tail
heroku logs --source app
```

### Restart App
```bash
heroku restart
```

### Database Maintenance
```bash
# Backup
heroku pg:backups:capture

# Download backup
heroku pg:backups:download

# Restore
heroku pg:backups:restore <backup_id>
```

### Update Code
```bash
git add .
git commit -m "Update description"
git push heroku main
```

## Troubleshooting

### Application Error (H10)
- Check logs: `heroku logs --tail`
- Verify Procfile exists
- Check that dependencies are in package.json

### Database Connection Error
```bash
# Check DATABASE_URL is set
heroku config:get DATABASE_URL

# Reset database (WARNING: destroys data)
heroku pg:reset DATABASE
heroku pg:psql < schema.sql
```

### CORS Errors
- Verify CORS_ORIGIN matches frontend URL
- Include https:// in the URL
- Update backend config

### Build Failed
- Check package.json for errors
- Verify Node version compatibility
- Check logs for specific error

## Costs

### Free Tier Limits
- 550-1000 dyno hours/month
- Sleeps after 30 min inactivity
- 10,000 rows in PostgreSQL
- Perfect for development/testing

### Paid Plans
- Hobby: $7/month (no sleep)
- Standard: $25/month (better performance)
- See: https://www.heroku.com/pricing

## Alternative: Railway.app

Similar to Heroku but with different pricing:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# Add PostgreSQL
railway add

# Set environment variables
railway variables set KEY=value
```

## Alternative: Render.com

1. Connect GitHub repository
2. Create Web Service for backend
3. Add PostgreSQL database
4. Configure environment variables
5. Deploy automatically on git push

## CI/CD Pipeline (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Heroku

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "your-app-name"
          heroku_email: "your-email@example.com"
          appdir: "backend"
```

## Resources

- [Heroku Dev Center](https://devcenter.heroku.com/)
- [Heroku PostgreSQL](https://devcenter.heroku.com/articles/heroku-postgresql)
- [Netlify Docs](https://docs.netlify.com/)
- [Vercel Docs](https://vercel.com/docs)
