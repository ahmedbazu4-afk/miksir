# Troubleshooting Guide

Common issues and their solutions for the Miksir application.

## Quick Diagnostics

Run the health check script:
```bash
./health-check.sh
```

## Backend Issues

### Backend Won't Start

**Symptom:** `npm start` fails or exits immediately

**Solutions:**

1. **Check Node.js version**
   ```bash
   node --version  # Should be 18+
   ```

2. **Install dependencies**
   ```bash
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check .env file**
   ```bash
   # Verify .env exists and has all required variables
   cat backend/.env
   ```

4. **Check port availability**
   ```bash
   # See if port 3000 is already in use
   lsof -i :3000
   # Kill the process if needed
   kill -9 <PID>
   ```

5. **Check logs for specific errors**
   ```bash
   cd backend
   npm start 2>&1 | tee error.log
   ```

### Database Connection Failed

**Symptom:** `Error: connect ECONNREFUSED` or `password authentication failed`

**Solutions:**

1. **Verify PostgreSQL is running**
   ```bash
   # Check if PostgreSQL is running
   pg_isready
   
   # If not running, start it
   sudo systemctl start postgresql  # Linux
   brew services start postgresql   # macOS
   ```

2. **Check DATABASE_URL format**
   ```bash
   # Should be:
   # postgresql://username:password@host:port/database
   
   # Example:
   # postgresql://miksir_user:mypassword@localhost:5432/miksir
   ```

3. **Test database connection manually**
   ```bash
   psql -d miksir -U miksir_user -h localhost
   ```

4. **Verify database exists**
   ```bash
   psql -l | grep miksir
   
   # If not exists, create it:
   createdb miksir
   ```

5. **Check user permissions**
   ```bash
   psql -d miksir
   \du  # List users and their permissions
   ```

6. **Reset database**
   ```bash
   dropdb miksir
   createdb miksir
   psql -d miksir -f backend/schema.sql
   ```

### API Returns 500 Errors

**Symptom:** API calls return Internal Server Error

**Solutions:**

1. **Check backend logs**
   ```bash
   # Look for stack traces in the terminal where backend is running
   ```

2. **Enable debug mode**
   ```javascript
   // In backend/src/index.js, add:
   app.use((err, req, res, next) => {
     console.error('Error:', err);
     res.status(500).json({ error: err.message, stack: err.stack });
   });
   ```

3. **Verify all environment variables**
   ```bash
   cd backend
   node -e "require('dotenv').config(); console.log(process.env)"
   ```

4. **Check Supabase connection**
   ```bash
   # Verify SUPABASE_URL and SUPABASE_KEY are correct
   # Test in browser: https://your-project.supabase.co
   ```

### CORS Errors

**Symptom:** `Access-Control-Allow-Origin` error in browser console

**Solutions:**

1. **Check CORS configuration in backend**
   ```javascript
   // In backend/src/index.js
   app.use(cors({
     origin: process.env.CORS_ORIGIN || 'http://localhost:8080'
   }));
   ```

2. **Verify CORS_ORIGIN in .env**
   ```bash
   # Should match frontend URL exactly
   CORS_ORIGIN=http://localhost:8080
   ```

3. **For development, allow all origins temporarily**
   ```javascript
   app.use(cors({ origin: '*' }));  // Development only!
   ```

## Frontend Issues

### Frontend Can't Connect to Backend

**Symptom:** API calls fail with network errors

**Solutions:**

1. **Check API_BASE_URL in frontend/index.html**
   ```javascript
   // Find this line and verify it's correct:
   const API_BASE_URL = 'http://localhost:3000';
   ```

2. **Verify backend is running**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Check browser console for errors**
   - Open DevTools (F12)
   - Look in Console and Network tabs

4. **Disable browser extensions**
   - Ad blockers or security extensions might block requests
   - Try in incognito/private mode

### Page Not Loading

**Symptom:** Blank page or 404 error

**Solutions:**

1. **Verify frontend server is running**
   ```bash
   # Check if port 8080 is listening
   lsof -i :8080
   ```

2. **Check file path**
   ```bash
   # Make sure index.html exists
   ls -la frontend/index.html
   ```

3. **Try different server**
   ```bash
   # Python
   cd frontend && python3 -m http.server 8080
   
   # Node.js
   cd frontend && npx http-server -p 8080
   
   # PHP
   cd frontend && php -S localhost:8080
   ```

### JavaScript Errors

**Symptom:** Errors in browser console

**Solutions:**

1. **Clear browser cache**
   - Ctrl+Shift+R (hard refresh)
   - Or clear cache in browser settings

2. **Check for syntax errors**
   - Look at line number in error message
   - Check recent changes to index.html

3. **Verify API responses**
   - Check Network tab in DevTools
   - Look at response format

## Docker Issues

### Docker Containers Won't Start

**Symptom:** `docker-compose up` fails

**Solutions:**

1. **Check Docker is running**
   ```bash
   docker --version
   docker ps
   ```

2. **Check for port conflicts**
   ```bash
   # See what's using the ports
   lsof -i :3000
   lsof -i :8080
   lsof -i :5432
   ```

3. **Remove old containers and volumes**
   ```bash
   docker-compose down -v
   docker system prune -a
   ```

4. **Rebuild from scratch**
   ```bash
   docker-compose up -d --build --force-recreate
   ```

5. **Check logs**
   ```bash
   docker-compose logs -f
   ```

### Database Container Fails

**Symptom:** DB container exits or won't start

**Solutions:**

1. **Check volume permissions**
   ```bash
   docker-compose down -v  # Remove volumes
   docker-compose up -d
   ```

2. **Verify environment variables**
   ```bash
   # Check .env file has correct PostgreSQL config
   cat .env
   ```

3. **Check database logs**
   ```bash
   docker-compose logs db
   ```

## Environment Variable Issues

### Variables Not Loading

**Symptom:** App can't find environment variables

**Solutions:**

1. **Verify .env file location**
   ```bash
   # Root .env for Docker
   ls -la .env
   
   # Backend .env for local dev
   ls -la backend/.env
   ```

2. **Check file format**
   ```bash
   # No spaces around =
   # Correct:   KEY=value
   # Incorrect: KEY = value
   ```

3. **Restart application after changing .env**
   ```bash
   # Docker
   docker-compose restart
   
   # Local
   # Stop (Ctrl+C) and start again
   ```

## Common Error Messages

### "Module not found"

```bash
cd backend
npm install
```

### "Permission denied"

```bash
# Make scripts executable
chmod +x start.sh health-check.sh

# Fix file ownership (Linux)
sudo chown -R $USER:$USER .
```

### "Port already in use"

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### "Cannot find module 'dotenv'"

```bash
cd backend
npm install dotenv
```

### "FATAL: password authentication failed"

```bash
# Reset PostgreSQL password
sudo -u postgres psql
ALTER USER miksir_user WITH PASSWORD 'newpassword';
\q

# Update .env with new password
```

## Performance Issues

### Slow API Responses

**Solutions:**

1. **Check database indexes**
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_designs_user ON designs(user_id);
   CREATE INDEX idx_chats_design ON chats(design_id);
   ```

2. **Enable query logging**
   ```javascript
   // See what queries are slow
   ```

3. **Check network latency**
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/designs
   ```

### High Memory Usage

**Solutions:**

1. **Check for memory leaks**
   ```bash
   # Monitor Node.js process
   node --inspect src/index.js
   ```

2. **Limit concurrent connections**
   ```javascript
   // In backend database config
   max: 10  // Reduce pool size
   ```

3. **Restart services regularly**
   ```bash
   # Set up PM2 with auto-restart
   pm2 start src/index.js --max-memory-restart 500M
   ```

## Production Issues

### SSL Certificate Errors

**Solutions:**

1. **Renew certificate**
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

2. **Check certificate expiry**
   ```bash
   sudo certbot certificates
   ```

### 502 Bad Gateway

**Symptom:** Nginx shows 502 error

**Solutions:**

1. **Check backend is running**
   ```bash
   pm2 status
   pm2 restart miksir-backend
   ```

2. **Check Nginx configuration**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Check backend logs**
   ```bash
   pm2 logs miksir-backend
   ```

## Getting More Help

### Collect Diagnostic Information

```bash
# System info
uname -a
node --version
npm --version
docker --version
psql --version

# Application status
docker-compose ps
pm2 status

# Recent logs
docker-compose logs --tail=100
pm2 logs --lines 100

# Environment check
cd backend && node -e "require('dotenv').config(); console.log('Loaded')"
```

### Enable Verbose Logging

**Backend:**
```javascript
// Add to backend/src/index.js
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
```

**Docker:**
```bash
docker-compose logs -f --tail=100
```

### Test Individual Components

**Database:**
```bash
psql -d miksir -c "SELECT NOW();"
```

**Backend:**
```bash
curl -v http://localhost:3000/health
```

**Frontend:**
```bash
curl -I http://localhost:8080
```

## Still Having Issues?

1. Check all logs carefully for error messages
2. Verify all environment variables are set correctly
3. Ensure all services are running
4. Try restarting everything from scratch
5. Review the DEVELOPMENT.md guide
6. Check if it works with Docker (eliminates environment issues)
