# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ramadhan Reservation System for Ayam Gepuk Pak Antok - a restaurant chain with 6 outlets in Malaysia (Masjid Tanah, Lagenda, Larkin, Merlimau, Jasin, Bukit Beruang). Supports three fulfillment types: dine-in (pax-based booking with time slots), takeaway with time slots, and delivery (admin-toggleable per outlet).

**System Capacity**: 647 total pax across all outlets. Menu has 17 items across 3 categories (Set Menu, Drinks, Ala Carte).

## Development Commands

### Backend (Express.js + Prisma + MySQL)
```bash
cd backend
npm run dev                 # Start dev server with hot reload (port 3001)
npm run build               # Compile TypeScript
npm start                   # Run production build (from dist/)
npm run db:generate         # Generate Prisma client after schema changes
npm run db:migrate          # Run database migrations
npm run db:push             # Push schema to database (dev only)
npm run db:seed             # Seed database with initial data (WARNING: clears ALL data)
npm run db:studio           # Open Prisma Studio GUI
npm run update:sets-simple  # Update Set menu items with customization options
```

### Frontend (Next.js 16 + React 19 + Tailwind 4)
```bash
cd frontend
npm run dev    # Start dev server (port 3000)
npm run build  # Production build (must run from frontend/ directory)
npm run lint   # Run ESLint
```

No testing framework is configured in either project.

## Architecture

### Monorepo Structure
- `backend/` - Express.js REST API with Prisma ORM
- `frontend/` - Next.js App Router application
- `Memories/` - Project documentation (PRD, technical specs, design docs, deployment guide)

### Backend

**Entry point:** `backend/src/server.ts` - Express app with this middleware stack (order matters):
1. Helmet (security headers, cross-origin resource policy for images)
2. Compression (gzip)
3. CORS (origin from `FRONTEND_URL` env var)
4. Body parsing (JSON + URL-encoded, 10MB limit)
5. Global rate limiter (200 req/min per IP)
6. Static file serving (`/uploads` → `public/uploads/`, 1-day cache)

Auth routes get a stricter rate limiter: 10 attempts per 15 minutes.

**Route-based architecture:** Business logic lives directly in route handler files (`backend/src/routes/`). Do not create separate controller or service layers.

**API Routes (all prefixed with `/api/v1`):**
- `/outlets` - Outlet CRUD + tables/slots per outlet
- `/reservations` - Booking creation (POST dine-in, takeaway, delivery) + order lookup
- `/payments` - ToyyibPay integration with comprehensive webhook handling:
  - `POST /callback` - ToyyibPay webhook endpoint (requires public BACKEND_URL)
  - `GET /status/:billCode` - Check payment status
  - `POST /verify/:orderNo` - Verify and sync payment from ToyyibPay (webhook recovery)
  - `POST /complete/:orderNo` - Manual completion for local testing
- `/admin` - Dashboard stats, sales reports, order management, outlet config, table CRUD (all protected by `requireAdmin` middleware)
- `/auth` - Customer register/login + admin login (bcrypt, rate-limited) + email/phone availability checks
- `/menu` - Menu CRUD with category filtering, featured items (max 3)
- `/categories` - Category CRUD (Set Menu, Ala Carte, Drinks) with display ordering
- `/upload` - Multer image upload (5MB limit, images only → `public/uploads/`)
- `/reviews` - Celebrity testimonials (read-only)
- `/promotions` - Promotion management

**Key backend files:**
- `backend/src/middlewares/auth.ts` - JWT auth: `generateAdminToken`, `generateCustomerToken`, `requireAdmin`, `requireMaster`, `optionalCustomerAuth`
- `backend/src/config/prisma.ts` - PrismaClient singleton
- `backend/src/utils/toyyibpay.ts` - Payment bill creation; auto-falls back to mock sandbox mode when credentials are placeholder values
- `backend/src/utils/email.ts` - Nodemailer confirmation emails + 1-hour reminder scheduling
- `backend/src/utils/cleanupOrders.ts` - Auto-cleanup of abandoned orders on server startup
- `backend/prisma/seed.ts` - Seeds 6 outlets with Google Maps URLs, 12 tables per outlet, time slots (dine-in: 10am-5pm, takeaway: 2pm-11pm), master admin, 3 categories, 17 menu items, reviews, and system settings including social media links
- `backend/src/routes/categories.ts` - Category CRUD with display ordering and slug generation

**Input validation:** Backend uses `zod` for request body validation.

**Health check:** `GET /health` returns `{ status, database, timestamp }` — verifies DB connectivity.

**Admin auth:** JWT-based. Admin login at `POST /api/v1/auth/admin/login` validates against database with bcrypt. Tokens stored as `adminToken` in localStorage. Two roles: MASTER (all outlets) vs OUTLET (scoped to one location). All `/admin` routes protected with `router.use(requireAdmin)`.

**Customer auth:** JWT-based. Register/login at `/api/v1/auth/register` and `/api/v1/auth/login`. Password requires: 8+ chars, uppercase, lowercase, number, special character. Tokens stored as `customerToken` in localStorage (7-day expiry). Phone has `@unique` constraint for duplicate detection.

**Graceful shutdown:** SIGTERM/SIGINT handlers close server and disconnect Prisma, with 10-second force timeout.

### Frontend

**Next.js config:** Static export mode (`output: 'export'`), React Compiler enabled (`reactCompiler: true`), Turbopack for dev, remote images from `localhost:3001` and production domains with `dangerouslyAllowSVG` and `unoptimized` set to true, `trailingSlash: true`.

**Path alias:** `@/*` maps to `./src/*`

**Pages (App Router):**
- `src/app/` - Homepage
- `src/app/menu/` - Public menu browser
- `src/app/outlets/` - Outlet listings
- `src/app/about/`, `src/app/gallery/` - Static content pages
- `src/app/login/`, `src/app/register/` - Customer auth pages
- `src/app/book/{dine-in,takeaway,delivery}/` - Booking flows
- `src/app/admin/` - Admin dashboard (orders, outlets, menu, settings)
- `src/app/admin/login/` - Separate admin login page
- `src/app/admin/categories/` - Category management (create/edit/reorder categories)
- `src/app/checkout/` - Universal cart checkout for all fulfillment types
- `src/app/confirmation/[orderNo]/` and `src/app/receipt/[orderNo]/` - Post-payment pages

**API clients:**
- `src/services/api.ts` - Main client with `fetchApi<T>()` wrapper, exports `outletApi`, `reservationApi`, `paymentApi`, `reviewApi`. Uses `getAuthHeaders()` that checks both `adminToken` and `customerToken`. Also exports `getImageUrl()` for resolving backend image paths.
- `src/services/menuApi.ts` - Separate menu API client.

Base URL from `NEXT_PUBLIC_API_URL` env var (default `http://localhost:3001/api/v1`).

**State management:** Context API with localStorage persistence, no external state library. All contexts in `src/context/` (singular):
- `AuthContext` - User auth state, login/register/logout
- `CartContext` - Cart items, quantity management, auto-calculates subtotal/SST/total
- `CartAnimationContext` - Flying add-to-cart animation with ref-based targeting

**Provider order** (in `layout.tsx`): AuthProvider → CartAnimationProvider → CartProvider → ConditionalLayout (hides nav on admin routes)

**Global layout components** (always rendered): `CartAnimationOverlay`, `WhatsAppButton`, `CookieConsent`

**Component patterns:**
- Heavy use of `'use client'` directives for interactive components
- Dynamic imports for SSR-incompatible libraries: `dynamic(() => import('lottie-react'), { ssr: false })`
- Admin pages use `getAdminHeaders()` helper for auth headers
- Native `alert()` for error feedback (no toast library)
- `recharts` for admin dashboard charts, `three` for 3D elements
- **MenuItemImage component**: Use for all menu item images (includes fallback to `/default-image.png` on error)
- **Cart and Order Summary**: Display text-only without images (design preference)
- **Admin Dashboard Auto-Refresh**: Dashboard automatically refreshes every 30 seconds with toggle control and manual refresh button. Live "Updated Xs ago" indicator updates every second. Sales reports require manual refresh to prevent disruption during analysis.

**Menu Customization System:**
- `CustomizationModal` component handles customization selection for menu items
- Menu items with `hasCustomization: true` trigger modal before adding to cart
- Customization options stored in `customizationOptions` field (JSON):
  - `ayamType`: Chicken type selection (Crispy/Original)
  - `sambalLevel`: Spice level (3 levels: Kurang Pedas/Sederhana/Pedas)
  - `drink`: Beverage selection with free options and paid upgrades (+RM 5)
- Modal validates required selections before confirming
- Cart items store customizations in `customizations` field
- Integrated in both home page and menu page
- **Database field mapping**: Database stores options with `id` field, frontend expects `value` field — `menuApi.ts` transforms this automatically via `transformOptions()` and `transformGroup()` helpers

### Dine-in Booking (Pax-Based)
Dine-in booking is pax-based — customers select number of guests + time slot, admin arranges tables internally.
- **Outlet capacity**: Each outlet has `maxCapacity` (max pax per time slot). Admin can set this per outlet.
- **Booking flow**: Customer picks outlet → date → pax count → time slot → customer info → payment
- **Capacity check**: Serializable transaction sums `paxCount` of active DINE_IN orders per slot/date, ensures `currentPax + newPax <= maxCapacity`
- **Delivery toggle**: Each outlet has `deliveryEnabled` (default false). Admin can toggle it. Delivery page only shows outlets with delivery enabled.
- Table model is kept for admin internal use but customers no longer select tables directly.

### Database (Prisma)
Schema at `backend/prisma/schema.prisma`. Core models: Outlet, Table, TimeSlot, Order, Payment, Admin, Customer, Category, MenuItem, Setting, Review, Promotion.

Key enums: `TableStatus` (AVAILABLE/BOOKED/OCCUPIED/MAINTENANCE), `OrderStatus` (PENDING/PAID/CONFIRMED/COMPLETED/CANCELLED), `FulfillmentType` (DINE_IN/TAKEAWAY/DELIVERY), `PaymentStatus`, `AdminRole` (MASTER/OUTLET).

**Important:**
- `Order` stores customer info (name/email/phone) as denormalized fields — there is no foreign key to `Customer`. The `Customer` model exists only for auth/faster checkout, not linked relationally to orders.
- `Category` model stores menu categories with `displayOrder` for custom sorting, `slug` for URL-friendly names (e.g., "set-menu"), and `isActive` flag. Each category has many menu items (one-to-many relationship).
- `MenuItem` has a required `categoryId` foreign key to `Category` (onDelete: Restrict to prevent accidental deletion of categories with items).
- `MenuItem` has `hasCustomization` boolean and `customizationOptions` JSON field for menu item customization (chicken type, spice level, drinks).
- `Outlet` model includes `googleMapsUrl` field for navigation links.
- `Setting` model stores system-wide configs including social media URLs (Instagram, TikTok).

## Business Logic Constraints

- **Same-day only**: Bookings restricted to current date (date normalized with `setHours(0,0,0,0)`)
- **SST calculation**: 6% service tax on all orders (both backend computation and frontend CartContext)
- **Server-side price calculation**: Reservation routes compute prices from database — never trust client-submitted prices
- **Serializable transactions**: Dine-in pax capacity check and takeaway slot booking use serializable isolation to prevent race conditions
- **Order window**: Outlets have configurable open/close times
- **Pax capacity**: Dine-in uses per-outlet `maxCapacity` per time slot; customer specifies pax count (1-50)
- **Time slots**: Takeaway/delivery orders have per-slot limits (`maxOrders`)
- **Payment flow**: All reservations require ToyyibPay payment before confirmation. Upon successful payment (status_id=1), order status automatically changes to COMPLETED (not CONFIRMED)
- **Manual payment testing**: For local development where ToyyibPay webhooks can't reach localhost, use `POST /api/v1/payments/complete/:orderNo` to manually complete payments
- **Email reminders**: Automated confirmation + 1-hour reminder before booking
- **Seed resets data**: Running `db:seed` clears all existing data before re-seeding; blocked in NODE_ENV=production

## Design System

- **Primary color**: #8f1e1f (maroon), light: #a82829, dark: #6d1718
- **Accent colors**: #FFB627 (gold), #FF6B35 (orange), #FFF5E6 (cream)
- **Typography**: Bebas Neue (display font via `next/font/google`), Outfit (body font via `next/font/google`)
- **Design principle**: NO GRADIENTS - use solid colors only for professional appearance
- **CSS approach**: Tailwind 4 via PostCSS plugin (`@tailwindcss/postcss`), custom utility classes in `globals.css`
- **Key CSS classes**: `.btn-primary`, `.btn-secondary`, `.input-field`, `.menu-card`, `.food-card`, `.table-card`, `.slot-chip`, `.font-display`, `.gradient-text` (solid gold, not gradient despite name)
- **Custom animations**: `fadeIn`, `pulse-glow`, `slideInUp`, `scaleIn`, `shimmer`, `spiceFloat`, `steamRise`, `float`

## Environment Setup

Backend `.env` (see `backend/.env.example`):
- `DATABASE_URL` - MySQL connection string (required)
- `JWT_SECRET` - Strong random secret for token signing (warns if using default)
- `JWT_EXPIRES_IN` - Admin token expiry (default `24h`; customer tokens are always `7d`)
- `TOYYIBPAY_SECRET_KEY`, `TOYYIBPAY_CATEGORY_CODE`, `TOYYIBPAY_URL` - Payment gateway (sandbox: dev.toyyibpay.com)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` - Gmail SMTP for booking emails
- `FRONTEND_URL` - For CORS and payment return URLs (default http://localhost:3000)
- **`BACKEND_URL`** - **CRITICAL**: Public URL for ToyyibPay webhook callbacks (e.g., http://72.62.243.23:3001). Must be publicly accessible. Missing this causes payment webhooks to fail.

Frontend `.env.local`:
- `NEXT_PUBLIC_API_URL` - Backend API base URL (default http://localhost:3001/api/v1)

## Gotchas

- `jwt.sign()` with newer `@types/jsonwebtoken` needs `as jwt.SignOptions` cast
- `next build` must run from `frontend/` directory specifically
- Fonts are Bebas Neue and Outfit via `next/font/google` — do not add font imports via `<link>` tags or CSS `@import`
- **NO GRADIENTS allowed** - client preference is solid colors only for professional look
- User speaks Malay (Bahasa Melayu) but documentation should remain in English
- Frontend is configured for static export (`output: 'export'`) - dynamic features requiring server runtime must use client-side data fetching
- Server auto-cleans abandoned orders on startup via `cleanupOrders.ts`
- **Payment webhook limitation**: ToyyibPay webhooks cannot reach localhost during development. For local testing, use the manual completion endpoint or test on production/staging with public URL
- **Order status flow**: PENDING → (payment success) → COMPLETED (skips CONFIRMED). Orders go directly to COMPLETED after successful payment to simplify the workflow
- **BACKEND_URL is mandatory in production**: Without it, ToyyibPay webhooks default to localhost and fail silently. See `PAYMENT_WEBHOOK_FIX.md` for troubleshooting stuck payments.
- **Category deletion**: Categories cannot be deleted if they have associated menu items (Restrict constraint). Move items to another category first, or delete them before removing a category.

## Payment Webhook Troubleshooting

If orders are stuck in PENDING status despite successful payment:

1. **Verify BACKEND_URL is set**: `ssh root@72.62.243.23 'grep BACKEND_URL /var/www/agpa/backend/.env'`
2. **Check webhook logs**: `pm2 logs agpa-backend | grep "ToyyibPay webhook"`
3. **Use verification endpoint**: `curl -X POST http://72.62.243.23:3001/api/v1/payments/verify/{orderNo}`
4. **Run recovery script**: `cd backend && npx ts-node scripts/verify-stuck-payments.ts`
5. **Check for stuck orders**: Query DB for `status='PENDING' AND callbackData IS NULL`

See `PAYMENT_WEBHOOK_FIX.md` for detailed troubleshooting guide.

## Deployment

**VPS Details** (stored in `vps_account.md`):
- Host: 72.62.243.23
- User: root
- Password: Hostinger@2026
- Project path: `/var/www/agpa`
- PM2 processes: `agpa-backend` (port 3001), `agpa-frontend` (port 3000)

**Deployment Steps**:
1. Upload files via SCP: `sshpass -p 'Hostinger@2026' scp <local-file> root@72.62.243.23:/var/www/agpa/<remote-path>`
2. SSH into VPS: `sshpass -p 'Hostinger@2026' ssh root@72.62.243.23`
3. Navigate to project: `cd /var/www/agpa`
4. Build and restart:
   - Backend: `cd backend && npm run build && pm2 restart agpa-backend`
   - Frontend: `cd frontend && npm run build && pm2 restart agpa-frontend`
5. Verify: `pm2 logs <process-name> --lines 20`
6. Check PM2 status: `pm2 status`

**Common deployment pattern** (used in recent work):
```bash
# Upload file
sshpass -p 'Hostinger@2026' scp frontend/src/components/CartDropdown.tsx root@72.62.243.23:/var/www/agpa/frontend/src/components/

# Build and restart in one command
sshpass -p 'Hostinger@2026' ssh root@72.62.243.23 'cd /var/www/agpa/frontend && npm run build && pm2 restart agpa-frontend'

# Verify
sshpass -p 'Hostinger@2026' ssh root@72.62.243.23 'pm2 logs agpa-frontend --lines 5 --nostream'
```

**Production URLs**:
- Frontend: Hosted on VPS (port 3000)
- Backend API: http://72.62.243.23:3001/api/v1
- Health check: http://72.62.243.23:3001/health

**Important notes**:
- VPS is NOT a git repository - files must be copied manually via SCP
- Always build after uploading changes
- Both backend and frontend use PM2 for process management
- Frontend uses `serve` (not `next start`) due to static export mode
