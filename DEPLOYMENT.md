# Deployment Guide - Ayam Gepuk Pak Antok

## Quick Deploy to Production

### Prerequisites
- VPS access (SSH)
- PM2 installed globally
- Node.js 18+ installed
- MySQL/MariaDB running
- Nginx configured

### First Time Setup on VPS

1. **Clone the repository:**
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/BookingProject.git agpa
cd agpa
```

2. **Configure environment variables:**
```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env  # Update with production values

# Frontend
cp frontend/.env.example frontend/.env.local
nano frontend/.env.local  # Set NEXT_PUBLIC_API_URL=https://agpa.nextapmy.com/api/v1
```

3. **Install dependencies and build:**
```bash
chmod +x deploy.sh
./deploy.sh all
```

4. **Save PM2 processes:**
```bash
pm2 save
pm2 startup
```

### Regular Deployments

When you have new changes to deploy:

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Navigate to project
cd /var/www/agpa

# Pull latest changes
git pull origin main

# Deploy (choose one):
./deploy.sh all        # Deploy both backend and frontend
./deploy.sh backend    # Deploy backend only
./deploy.sh frontend   # Deploy frontend only
```

### Deployment Script Features

The `deploy.sh` script automatically:
- ✅ Installs dependencies
- ✅ Generates Prisma client
- ✅ Runs database migrations
- ✅ Builds TypeScript/Next.js
- ✅ Restarts PM2 services

### Manual Steps

#### Backend Only
```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run build
pm2 restart agpa-backend
```

#### Frontend Only
```bash
cd frontend
npm install
npm run build
pm2 restart agpa-frontend
```

### Troubleshooting

**Check logs:**
```bash
pm2 logs agpa-backend --lines 50
pm2 logs agpa-frontend --lines 50
```

**Restart services:**
```bash
pm2 restart all
```

**Check PM2 status:**
```bash
pm2 status
```

**Database migrations failed:**
```bash
cd backend
npm run db:push  # Force sync schema (dev only)
# OR
npm run db:migrate  # Run migrations properly
```

### Environment Variables

**Backend (.env):**
- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Strong random secret
- `FRONTEND_URL` - https://agpa.nextapmy.com
- `TOYYIBPAY_*` - Payment gateway credentials
- `SMTP_*` - Email configuration

**Frontend (.env.local):**
- `NEXT_PUBLIC_API_URL` - https://agpa.nextapmy.com/api/v1

### Port Configuration

- Backend: 3001 (proxied through nginx)
- Frontend: 3000 (proxied through nginx)
- HTTPS: 443 (nginx handles SSL with Let's Encrypt)

### Database Backups

```bash
# Export database
mysqldump -u root -p ayamgepuk > backup_$(date +%Y%m%d_%H%M%S).sql

# Import database
mysql -u root -p ayamgepuk < backup.sql
```

### Nginx Configuration

Located at: `/etc/nginx/sites-available/agpa.nextapmy.com`

After changes:
```bash
nginx -t                  # Test configuration
systemctl reload nginx    # Apply changes
```
