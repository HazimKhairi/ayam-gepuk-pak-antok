# Production Deployment Guide
## Ayam Gepuk Pak Antok - Ramadhan Reservation System

---

## What Was Improved (Security & Performance Audit)

### Security Improvements

| # | Improvement | Before | After |
|---|-----------|--------|-------|
| 1 | **Admin Authentication** | Hardcoded username/password in frontend code | JWT token-based authentication verified against database |
| 2 | **Admin Route Protection** | All admin API endpoints publicly accessible | Every admin endpoint requires valid JWT token |
| 3 | **Password Storage** | Plain text comparison | bcrypt hashing with 12 rounds |
| 4 | **Rate Limiting** | None - vulnerable to brute force | 200 requests/min global, 10 login attempts per 15 min |
| 5 | **Security Headers** | None | Helmet.js (XSS protection, clickjacking prevention, content sniffing prevention) |
| 6 | **Price Validation** | Prices sent from browser (can be manipulated) | Server calculates prices from database (tamper-proof) |
| 7 | **Email XSS** | Customer names rendered raw in emails | HTML characters escaped to prevent injection |
| 8 | **Body Size Limit** | Unlimited | 10MB max request size |
| 9 | **Seed Protection** | Could accidentally wipe production data | Blocked from running in production environment |
| 10 | **Frontend Security Headers** | None | X-Frame-Options, X-Content-Type-Options, Referrer-Policy |

### Reliability Improvements

| # | Improvement | Before | After |
|---|-----------|--------|-------|
| 1 | **Table Booking Race Condition** | Two people could book same table simultaneously | Serializable database transaction (atomic locking) |
| 2 | **Takeaway Slot Race Condition** | Slots could be over-booked | Serializable database transaction (atomic locking) |
| 3 | **Payment Webhook** | Could process same payment twice | Duplicate processing prevention |
| 4 | **Database Connections** | Some files created new connections | All files use single shared connection |
| 5 | **Error Boundaries** | App crashes show blank white screen | Friendly error page with "Try Again" button |
| 6 | **Graceful Shutdown** | Server killed abruptly | Proper cleanup of connections on shutdown |

### Performance Improvements

| # | Improvement | Before | After |
|---|-----------|--------|-------|
| 1 | **Response Compression** | Uncompressed responses | Gzip compression (40-70% smaller responses) |
| 2 | **Database Indexes** | No indexes on frequent queries | Indexes on Order (date, status, outlet, email) and Payment (status, billCode) |
| 3 | **Image Optimization** | All images served as-is | Next.js automatic image optimization |
| 4 | **Static File Caching** | No cache headers | 1-day cache for uploaded images |

### User Experience Improvements

| # | Improvement | Before | After |
|---|-----------|--------|-------|
| 1 | **Error Messages** | Browser popup alerts (ugly) | Inline error messages in the form |
| 2 | **SEO Metadata** | Basic title only | Full Open Graph, keywords, proper meta tags |
| 3 | **Favicon** | None | Favicon with restaurant logo (all sizes) |
| 4 | **Mobile Responsiveness** | Desktop-only admin pages | All admin pages fully responsive |

---

## Deployment Checklist

### 1. Server Requirements

- **Node.js**: v18 or higher
- **MySQL**: v8.0 or higher
- **RAM**: Minimum 2GB (recommended 4GB for 1000 users/day)
- **Storage**: 10GB+ (for uploaded images)
- **SSL Certificate**: Required (HTTPS)

### 2. Environment Variables (Backend)

Create a `.env` file in the `backend/` folder with these values:

```env
# Database - Use your production MySQL credentials
DATABASE_URL="mysql://username:password@localhost:3306/ramadhan_reservation"

# Server
PORT=3001
NODE_ENV=production

# IMPORTANT: Generate a strong random secret for JWT
# You can generate one at: https://randomkeygen.com/ (use 256-bit WEP Key)
JWT_SECRET=YOUR_STRONG_RANDOM_SECRET_HERE
JWT_EXPIRES_IN=24h

# ToyyibPay Production
TOYYIBPAY_SECRET_KEY=your_production_secret_key
TOYYIBPAY_CATEGORY_CODE=your_production_category_code
TOYYIBPAY_URL=https://toyyibpay.com

# Gmail SMTP (for booking confirmations & reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_business_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM="Ayam Gepuk Pak Antok <your_business_email@gmail.com>"

# Frontend URL (your actual domain)
FRONTEND_URL=https://your-domain.com
```

### 3. Environment Variables (Frontend)

Create a `.env.local` file in the `frontend/` folder:

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
```

### 4. Build & Deploy Steps

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Build backend
cd ../backend
npm run build

# 3. Push database schema
npx prisma db push

# 4. Seed initial data (outlets, tables, menu, admin account)
# WARNING: This clears all existing data! Only run once on fresh database.
npm run db:seed

# 5. Build frontend
cd ../frontend
npm run build

# 6. Start backend (use PM2 for production)
cd ../backend
pm2 start dist/server.js --name "booking-api"

# 7. Start frontend (use PM2 for production)
cd ../frontend
pm2 start npm --name "booking-web" -- start
```

### 5. PM2 Process Manager (Recommended)

Install PM2 globally for keeping the app running:

```bash
npm install -g pm2

# Start both services
pm2 start dist/server.js --name "booking-api"
pm2 start npm --name "booking-web" -- start

# Set PM2 to auto-restart on server reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs

# Restart after updates
pm2 restart all
```

### 6. Nginx Reverse Proxy (Recommended)

Example Nginx config to serve both frontend and backend on one domain:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend health check
    location /health {
        proxy_pass http://localhost:3001/health;
    }

    # Uploaded images
    location /uploads/ {
        proxy_pass http://localhost:3001/uploads/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Admin Login Credentials

After seeding the database, use these credentials to log in:

| Field | Value |
|-------|-------|
| Email | `admin@ayamgepuk.com` |
| Password | `Admin@123` |

**IMPORTANT**: Change the admin password after first login in production!

---

## Post-Deployment Verification

After deploying, verify everything works:

1. Open `https://your-domain.com` - Homepage should load
2. Open `https://your-domain.com/admin/login` - Login with credentials above
3. Check admin dashboard shows data
4. Try creating a test booking (dine-in, takeaway, delivery)
5. Verify payment flow works with ToyyibPay
6. Check `https://your-domain.com/health` returns `{"status":"ok"}`

---

## Monitoring & Maintenance

### Daily Checks
- `pm2 status` - Both services should show "online"
- `pm2 logs --lines 50` - Check for errors

### Backups
- Set up daily MySQL backups:
  ```bash
  mysqldump -u root -p ramadhan_reservation > backup_$(date +%Y%m%d).sql
  ```

### Updating the App
```bash
# Pull latest code
git pull

# Rebuild backend
cd backend && npm install && npm run build
npx prisma db push  # Apply any schema changes

# Rebuild frontend
cd ../frontend && npm install && npm run build

# Restart services
pm2 restart all
```

---

## Scaling Notes (1000+ Users/Day)

The current setup supports approximately 1000 users/day on a single server. For higher traffic:

- **Database**: The added indexes ensure fast queries for order lookups and payment processing
- **Rate Limiting**: Protects against abuse (200 requests/min per IP)
- **Compression**: Reduces bandwidth usage by 40-70%
- **Transaction Safety**: Serializable transactions prevent double-booking even under heavy load
- **If needed**: Move MySQL to a dedicated database server, add Redis for session caching

---

## Support Contacts

For technical issues with the system:
- Check PM2 logs: `pm2 logs`
- Check database: `npx prisma studio` (opens visual database browser)
- Health endpoint: `GET /health`
