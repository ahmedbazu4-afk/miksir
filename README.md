# Miksir Application - Complete Deployment Guide

This repository contains both the frontend and backend for the Miksir concrete mix design application.

## 📁 Project Structure

```
miksir-app/
├── frontend/           # Frontend HTML application
│   └── index.html     # Main application interface
├── backend/           # Node.js/Express backend API
│   ├── src/          # Source code
│   ├── schema.sql    # Database schema
│   ├── package.json  # Node dependencies
│   └── .env.example  # Environment variables template
├── docker-compose.yml # Docker deployment configuration
├── .env.example      # Root environment variables
└── README.md         # This file
```

## 🚀 Deployment Options

### Option 1: Local Development (Recommended for testing)

#### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+ (or use Docker)
- Modern web browser

#### Steps

1. **Clone/Extract the repository**
   ```bash
   cd miksir-app
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Set up the database**
   - Create a PostgreSQL database
   - Run the schema:
     ```bash
     psql -U your_user -d your_database -f schema.sql
     ```
   - Seed with standards (optional):
     ```bash
     node src/data/seed.js
     ```

4. **Start the backend**
   ```bash
   npm start
   # Backend will run on http://localhost:3000
   ```

5. **Serve the frontend**
   Open a new terminal:
   ```bash
   cd ../frontend
   # Option A: Using Python
   python3 -m http.server 8080
   
   # Option B: Using Node.js http-server
   npx http-server -p 8080
   
   # Option C: Using PHP
   php -S localhost:8080
   ```

6. **Access the application**
   - Open browser to `http://localhost:8080`
   - Frontend will connect to backend at `http://localhost:3000`

---

### Option 2: Docker Deployment (Recommended for production)

#### Prerequisites
- Docker
- Docker Compose

#### Steps

1. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your production credentials
   ```

2. **Build and start containers**
   ```bash
   docker-compose up -d
   ```

3. **Initialize database**
   ```bash
   docker-compose exec backend npm run db:init
   ```

4. **Access the application**
   - Frontend: `http://localhost:8080`
   - Backend API: `http://localhost:3000`
   - Database: `localhost:5432`

5. **View logs**
   ```bash
   docker-compose logs -f
   ```

6. **Stop containers**
   ```bash
   docker-compose down
   ```

---

### Option 3: Cloud Deployment (Production)

#### Recommended Stack

**Backend Options:**
- Heroku
- Railway.app
- Render.com
- AWS Elastic Beanstalk
- Google Cloud Run
- DigitalOcean App Platform

**Frontend Options:**
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Cloudflare Pages

**Database:**
- Supabase (PostgreSQL)
- AWS RDS
- Google Cloud SQL
- Heroku Postgres

#### Example: Deploying to Heroku + Netlify

**Backend (Heroku):**
```bash
cd backend
heroku create your-app-name
heroku addons:create heroku-postgresql:mini
heroku config:set NODE_ENV=production
git init
git add .
git commit -m "Initial commit"
git push heroku main
heroku run npm run db:init
```

**Frontend (Netlify):**
1. Update API endpoint in `index.html`:
   ```javascript
   const API_BASE_URL = 'https://your-app-name.herokuapp.com';
   ```
2. Deploy via Netlify CLI or drag-and-drop `frontend` folder to Netlify

---

### Option 4: VPS Deployment (Ubuntu/Debian)

#### Prerequisites
- Ubuntu 20.04+ or Debian 11+ server
- Root or sudo access
- Domain name (optional)

#### Steps

1. **Install dependencies**
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm postgresql nginx certbot python3-certbot-nginx
   ```

2. **Set up PostgreSQL**
   ```bash
   sudo -u postgres createdb miksir
   sudo -u postgres createuser miksir_user -P
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE miksir TO miksir_user;"
   ```

3. **Deploy application**
   ```bash
   sudo mkdir -p /var/www/miksir
   cd /var/www/miksir
   # Upload your files here
   
   cd backend
   npm install --production
   cp .env.example .env
   # Edit .env with your credentials
   
   psql -U miksir_user -d miksir -f schema.sql
   ```

4. **Set up PM2 for backend**
   ```bash
   sudo npm install -g pm2
   cd /var/www/miksir/backend
   pm2 start src/index.js --name miksir-backend
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/miksir
   ```
   
   Add configuration (see nginx.conf in deployment docs)
   
   ```bash
   sudo ln -s /etc/nginx/sites-available/miksir /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Set up SSL (optional)**
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

## 🔧 Configuration

### Backend Environment Variables

See `backend/.env.example` for all required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `ANTHROPIC_API_KEY` - Claude API key for AI features
- `JWT_SECRET` - Secret for JWT tokens
- `PORT` - Backend port (default: 3000)

### Frontend Configuration

Update the API endpoint in `frontend/index.html`:
```javascript
const API_BASE_URL = 'http://localhost:3000'; // Change for production
```

---

## 📝 Additional Resources

- Backend README: `backend/README.md`
- Database Schema: `backend/schema.sql`
- API Documentation: See backend README

---

## 🐛 Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify .env configuration
- Check logs: `npm start` or `docker-compose logs backend`

### Frontend can't connect to backend
- Verify API_BASE_URL in index.html
- Check CORS settings in backend
- Ensure backend is running and accessible

### Database connection errors
- Verify DATABASE_URL format
- Check PostgreSQL credentials
- Ensure database exists and schema is loaded

---

## 📄 License

See individual component licenses in respective directories.

---

## 🤝 Support

For issues and questions, please refer to the documentation in each component directory.
