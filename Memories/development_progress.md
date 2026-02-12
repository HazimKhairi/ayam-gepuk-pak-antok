# Ramadhan Reservation System - Development Memories

This document captures the development progress and key decisions for the Ayam Gepuk Pak Antok Ramadhan Reservation System.

## Project Overview

- **Client**: Ayam Gepuk Pak Antok
- **Purpose**: Reservation system for Ramadhan 2026 (5 outlets)
- **Fulfillment Types**: Dine-in, Takeaway, Delivery

## Tech Stack

| Layer    | Technology                                          |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend  | Express.js + TypeScript                             |
| Database | MySQL + Prisma ORM                                  |
| Payment  | ToyyibPay (Sandbox)                                 |
| Email    | Gmail SMTP (Nodemailer)                             |

## Project Structure

```
BookingProject/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Database models
│   │   └── seed.ts           # Mock data seeder
│   ├── src/
│   │   ├── config/prisma.ts
│   │   ├── routes/           # outlets, reservations, payments, admin, auth
│   │   ├── utils/            # toyyibpay.ts, email.ts
│   │   └── server.ts
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/              # Pages (App Router)
│   │   ├── context/          # CartContext, AuthContext
│   │   ├── services/api.ts   # API client
│   │   └── components/
│   └── package.json
└── Memories/
    └── development_progress.md
```

## Database Schema (Prisma)

- **Outlet** - 5 locations with settings
- **Table** - Restaurant tables per outlet
- **TimeSlot** - Takeaway time slots
- **Order** - Central reservation records
- **Payment** - ToyyibPay transactions
- **Admin** - Master/Outlet admin users
- **Customer** - Registered customers (NEW)
- **Setting** - System configuration

## API Endpoints

| Method | Endpoint                      | Description                  |
| ------ | ----------------------------- | ---------------------------- |
| GET    | /api/v1/outlets               | List active outlets          |
| GET    | /api/v1/outlets/:id/tables    | Get tables with availability |
| GET    | /api/v1/outlets/:id/slots     | Get time slots               |
| POST   | /api/v1/reservations/dine-in  | Create dine-in booking       |
| POST   | /api/v1/reservations/takeaway | Create takeaway order        |
| POST   | /api/v1/reservations/delivery | Create delivery order        |
| POST   | /api/v1/payments/callback     | ToyyibPay webhook            |
| GET    | /api/v1/admin/dashboard       | Admin dashboard stats        |
| GET    | /api/v1/admin/sales           | Sales reports                |
| POST   | /api/v1/auth/register         | Customer registration (NEW)  |
| POST   | /api/v1/auth/login            | Customer login (NEW)         |

## Key Pages

- `/` - Landing page with hero, featured menu, outlets
- `/menu` - Menu page with cart sidebar
- `/outlets` - Outlet locations list
- `/login` - Customer login
- `/register` - Customer registration
- `/checkout` - Cart checkout with table/takeaway selection
- `/receipt/[orderNo]` - Order receipt page
- `/book/dine-in` - Interactive table selection
- `/book/takeaway` - Time slot picker
- `/book/delivery` - Delivery address form
- `/confirmation/[orderNo]` - Success page
- `/admin` - Dashboard with stats
- `/admin/login` - Admin authentication
- `/admin/orders` - Orders management with filtering
- `/admin/outlets` - Outlet configuration
- `/admin/settings` - System settings

## Configuration Required

### Backend (.env)

```env
DATABASE_URL="mysql://root:@localhost:3306/ramadhan_reservation"
PORT=3001
FRONTEND_URL=http://localhost:3000
TOYYIBPAY_SECRET_KEY=your_key
TOYYIBPAY_CATEGORY_CODE=your_code
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_password
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Running the Project

### 1. Database Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

### 2. Start Backend

```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

## Design System (Updated 2026-02-04)

| Property      | Value               |
| ------------- | ------------------- |
| Primary Color | #8f1e1f (Maroon)    |
| Primary Light | #a82829             |
| Primary Dark  | #6d1718             |
| Background    | #F8F9FA             |
| Border Radius | 8px                 |
| Typography    | Inter font          |
| Button Style  | Solid (no gradient) |
| Emojis        | Not used            |
| Parallax      | Homepage hero       |

### CSS Variables

```css
:root {
  --primary: #8f1e1f;
  --primary-light: #a82829;
  --primary-dark: #6d1718;
  --background: #f8f9fa;
  --foreground: #212529;
}
```

## State Management

- **CartContext** - Cart items with localStorage persistence, SST calculation
- **AuthContext** - User login/register/logout with localStorage

## Key Features

- Same-day booking only
- Real-time table/slot availability
- 6% SST calculation
- ToyyibPay sandbox integration
- Email confirmation + 1-hour reminder
- Admin dashboard with sales analytics
- Customer authentication (register/login)
- Parallax scrolling on homepage

## Recent Changes (2026-02-04)

### Design System Update

- Changed primary color from amber (#FFC107) to maroon (#8f1e1f)
- Applied 8px border radius to all elements
- Removed gradient colors from buttons
- Removed all emojis from buttons and UI
- Added parallax effect on homepage hero (gradient pattern, no redundant images)
- Removed redundant images on same page

### Icon Updates

- Updated all SVG icons in `Icons.tsx` to use maroon (#8f1e1f) color scheme
- Added new utility icons: ArrowRightIcon, CheckIcon, StarIcon, MenuIcon, CloseIcon
- Icon fill color: #fef2f2 (light red)
- Icon stroke color: #8f1e1f (maroon) and #6d1718 (dark maroon)

### New Pages

- `/menu` - Full menu with cart sidebar
- `/outlets` - Outlet locations
- `/login` - Customer login
- `/register` - Customer registration
- `/checkout` - Combined cart checkout
- `/receipt/[orderNo]` - Order receipt

### Backend Updates

- Added Customer model for authentication
- Created auth routes (/api/v1/auth/login, /api/v1/auth/register)
- Installed bcryptjs for password hashing

## Next Steps

- [ ] Add MenuItem model for dynamic menu from database
- [ ] Implement JWT for session management
- [ ] Email receipt integration
- [ ] Full end-to-end payment test (requires ToyyibPay setup)
- [ ] Deploy to production

---

Last Updated: 2026-02-04
