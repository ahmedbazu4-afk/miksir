# VPS Deployment Guide for Miksir Application

This guide will help you deploy the Miksir application on a VPS (Ubuntu/Debian).

## Prerequisites

- Ubuntu 20.04+ or Debian 11+ VPS
- Root or sudo access
- At least 1GB RAM
- 10GB disk space
- Domain name (optional, but recommended)

## Step-by-Step Deployment

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git ufw

# Configure firewall
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 2. Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE miksir;
CREATE USER miksir_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE miksir TO miksir_user;
ALTER DATABASE miksir OWNER TO miksir_user;
\q
EOF
```

### 4. Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/miksir
sudo chown $USER:$USER /var/www/miksir

# Upload or clone your application
cd /var/www/miksir
# Upload the miksir-app folder here, or use git/scp/rsync

# Set up backend
cd /var/www/miksir/backend
npm install --production

# Create .env file
cp .env.example .env
nano .env  # Edit with your credentials
```

#### Backend .env Configuration

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://miksir_user:your_secure_password_here@localhost:5432/miksir
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
JWT_SECRET=generate_a_random_secret_at_least_32_characters_long
CORS_ORIGIN=https://yourdomain.com
```

### 6. Initialize Database

```bash
# Run schema
cd /var/www/miksir/backend
PGPASSWORD=your_secure_password_here psql -U miksir_user -d miksir -h localhost -f schema.sql

# Seed standards (optional)
node src/data/seed.js
```

### 7. Set Up PM2 for Backend

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start backend
cd /var/www/miksir/backend
pm2 start src/index.js --name miksir-backend

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Run the command it outputs

# View logs
pm2 logs miksir-backend
```

### 8. Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/miksir
```

Add the following configuration:

```nginx
# HTTP Server (redirects to HTTPS if SSL is configured)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Uncomment these lines after SSL setup
    # return 301 https://$server_name$request_uri;
    
    # Comment out this location block after SSL setup
    location / {
        root /var/www/miksir/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTPS Server (uncomment after SSL setup)
# server {
#     listen 443 ssl http2;
#     server_name yourdomain.com www.yourdomain.com;
#     
#     ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     
#     root /var/www/miksir/frontend;
#     index index.html;
#     
#     # Gzip compression
#     gzip on;
#     gzip_vary on;
#     gzip_min_length 1024;
#     gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
#     
#     # Security headers
#     add_header X-Frame-Options "SAMEORIGIN" always;
#     add_header X-XSS-Protection "1; mode=block" always;
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#     
#     # Frontend
#     location / {
#         try_files $uri $uri/ /index.html;
#     }
#     
#     # Cache static assets
#     location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
#         expires 1y;
#         add_header Cache-Control "public, immutable";
#     }
#     
#     # API proxy
#     location /api/ {
#         proxy_pass http://localhost:3000/;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#     }
# }
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/miksir /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 9. Update Frontend API Endpoint

```bash
# Edit frontend to use /api/ endpoint
nano /var/www/miksir/frontend/index.html

# Find this line:
# const API_BASE_URL = 'http://localhost:3000';

# Change to:
# const API_BASE_URL = '/api';
# Or for absolute URL:
# const API_BASE_URL = 'https://yourdomain.com/api';
```

### 10. Set Up SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts
# Certbot will automatically configure Nginx for SSL

# Test automatic renewal
sudo certbot renew --dry-run
```

After SSL setup, uncomment the HTTPS server block in your Nginx configuration and comment out the HTTP location block.

### 11. Set Up Automatic Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-miksir.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/miksir"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=your_secure_password_here pg_dump -U miksir_user -h localhost miksir > $BACKUP_DIR/db_$DATE.sql

# Backup application files (optional)
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/miksir

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +7 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-miksir.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
0 2 * * * /usr/local/bin/backup-miksir.sh
```

### 12. Monitoring and Logs

```bash
# View backend logs
pm2 logs miksir-backend

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# PM2 monitoring
pm2 monit
```

### 13. Updating the Application

```bash
# Stop backend
pm2 stop miksir-backend

# Update code (git pull or upload new files)
cd /var/www/miksir

# Update backend dependencies
cd backend
npm install --production

# Restart backend
pm2 restart miksir-backend

# Reload Nginx (if frontend changed)
sudo systemctl reload nginx
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Configured firewall (ufw)
- [ ] Set up SSL/HTTPS
- [ ] Regular backups configured
- [ ] Database only accessible locally
- [ ] Strong JWT_SECRET in .env
- [ ] CORS properly configured
- [ ] Keep system updated: `sudo apt update && sudo apt upgrade`
- [ ] Monitor logs regularly
- [ ] Set up fail2ban (optional): `sudo apt install fail2ban`

## Troubleshooting

### Backend won't start
```bash
pm2 logs miksir-backend
# Check for errors in the logs
```

### Database connection errors
```bash
# Test database connection
psql -U miksir_user -d miksir -h localhost
# Verify DATABASE_URL in .env
```

### Nginx errors
```bash
sudo nginx -t  # Test configuration
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues
```bash
sudo certbot renew --dry-run
sudo systemctl reload nginx
```

## Performance Tuning

### PostgreSQL
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf

# Recommended settings for 1GB RAM:
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
```

### PM2 Cluster Mode
```bash
pm2 delete miksir-backend
pm2 start src/index.js -i max --name miksir-backend
pm2 save
```

## Support

For issues specific to your VPS provider, consult their documentation.
For application issues, check the logs and refer to the main README.
