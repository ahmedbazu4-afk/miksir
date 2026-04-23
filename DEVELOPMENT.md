# Development Guide

## Project Structure

```
miksir-app/
├── frontend/              # Frontend application
│   └── index.html        # Single-page application
│
├── backend/              # Backend API server
│   ├── src/
│   │   ├── index.js           # Main entry point
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Utilities
│   │   └── data/              # Data and seeds
│   ├── schema.sql             # Database schema
│   ├── package.json           # Dependencies
│   └── .env.example           # Environment template
│
├── docker-compose.yml    # Docker orchestration
├── nginx.conf           # Nginx configuration
├── start.sh            # Quick start script
└── README.md           # Main documentation
```

## Development Workflow

### First Time Setup

1. **Clone the repository**
   ```bash
   cd miksir-app
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Configure environment**
   - Edit `.env` with your credentials
   - Edit `backend/.env` with backend-specific config

4. **Set up database**
   ```bash
   # Create database
   createdb miksir
   
   # Run schema
   npm run db:init
   
   # Seed data (optional)
   npm run db:seed
   ```

### Daily Development

#### Using Docker (Recommended)

```bash
# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Restart services
npm run docker:restart

# Stop services
npm run docker:down
```

#### Manual Development

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
python3 -m http.server 8080
# OR
npx http-server -p 8080
```

### Making Changes

#### Frontend Changes
- Edit `frontend/index.html`
- Refresh browser to see changes
- No build step required

#### Backend Changes
- Edit files in `backend/src/`
- If using `npm run dev`, changes auto-reload
- If using `npm start`, restart server manually

#### Database Changes
- Edit `backend/schema.sql`
- Drop and recreate database:
  ```bash
  dropdb miksir
  createdb miksir
  npm run db:init
  ```

## API Development

### Adding New Routes

1. Create route file in `backend/src/routes/`
2. Implement route handlers
3. Register in `backend/src/index.js`

Example:
```javascript
// backend/src/routes/newfeature.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  // Your logic here
});

module.exports = router;
```

```javascript
// backend/src/index.js
const newfeatureRoutes = require('./routes/newfeature');
app.use('/api/newfeature', newfeatureRoutes);
```

### Testing API Endpoints

Using curl:
```bash
# GET request
curl http://localhost:3000/api/designs

# POST request
curl -X POST http://localhost:3000/api/designs \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Mix","standard":"ts500"}'
```

Using Postman or Insomnia:
- Import the API endpoints
- Set base URL to `http://localhost:3000`

## Environment Variables

### Required Variables

**Root `.env`:**
- `POSTGRES_PASSWORD` - Database password
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anonymous key
- `ANTHROPIC_API_KEY` - Claude API key
- `JWT_SECRET` - JWT signing secret

**Backend `.env`:**
- Same as above, plus:
- `DATABASE_URL` - Full PostgreSQL connection string
- `PORT` - Backend port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### Getting API Keys

**Supabase:**
1. Go to https://supabase.com
2. Create a project
3. Go to Settings → API
4. Copy URL and anon key

**Anthropic:**
1. Go to https://console.anthropic.com
2. Create API key
3. Copy key

## Database Management

### Viewing Data
```bash
psql -d miksir -c "SELECT * FROM users;"
psql -d miksir -c "SELECT * FROM designs;"
```

### Resetting Database
```bash
dropdb miksir && createdb miksir
npm run db:init
npm run db:seed
```

### Backup Database
```bash
pg_dump miksir > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
psql miksir < backup_20240101.sql
```

## Debugging

### Backend Debugging

**Enable debug logging:**
```javascript
// In backend code
console.log('Debug:', variable);
```

**Check logs:**
```bash
# Docker
docker-compose logs -f backend

# Local
# Check terminal where npm start is running
```

### Frontend Debugging

**Browser Console:**
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for API calls

**Common Issues:**
- CORS errors → Check backend CORS settings
- API not responding → Verify backend is running
- 404 errors → Check API_BASE_URL in frontend

## Code Style

### JavaScript
- Use ES6+ features
- Async/await for promises
- Proper error handling
- Meaningful variable names

### Database
- Use parameterized queries (prevent SQL injection)
- Index important columns
- Use transactions for multi-step operations

## Performance

### Backend
- Use connection pooling (already configured)
- Cache frequent queries
- Optimize database queries
- Use async operations

### Frontend
- Minimize API calls
- Cache responses when appropriate
- Lazy load images/data
- Debounce user input

## Security Checklist

- [ ] Never commit `.env` files
- [ ] Use prepared statements for SQL
- [ ] Validate all user input
- [ ] Sanitize output
- [ ] Use HTTPS in production
- [ ] Set secure headers
- [ ] Rate limit API endpoints
- [ ] Keep dependencies updated

## Common Commands

```bash
# Install dependencies
npm run backend:install

# Start Docker
npm run docker:up

# Start local dev
npm run dev

# View Docker logs
npm run docker:logs

# Rebuild Docker images
npm run docker:build

# Initialize database
npm run db:init

# Seed database
npm run db:seed

# Stop Docker
npm run docker:down
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

### Database Connection Failed
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Check DATABASE_URL format

### Docker Issues
```bash
# Remove all containers
docker-compose down -v

# Rebuild from scratch
docker-compose up -d --build --force-recreate
```

### NPM Issues
```bash
# Clear cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf backend/node_modules
cd backend && npm install
```

## Resources

- [Express.js Docs](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Docker Docs](https://docs.docker.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com/)

## Getting Help

1. Check logs for error messages
2. Search issues in project documentation
3. Review API documentation
4. Check database connections
5. Verify environment variables
