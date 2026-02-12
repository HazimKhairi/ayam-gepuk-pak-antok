# Homepage & Menu Redesign - Development Memories

This document captures the implementation details for the Ayam Gepuk Pak Antok homepage redesign and menu ordering system.

## Date: 2026-02-04

## Changes Implemented

### Frontend Pages Created/Modified

| Page     | Path                 | Description                                             |
| -------- | -------------------- | ------------------------------------------------------- |
| Homepage | `/`                  | Redesigned with dark hero, logo, featured menu, outlets |
| Menu     | `/menu`              | Product grid with cart sidebar                          |
| Outlets  | `/outlets`           | Outlet cards with order buttons                         |
| Login    | `/login`             | Customer authentication                                 |
| Register | `/register`          | Customer registration                                   |
| Checkout | `/checkout`          | Table/takeaway selection + payment                      |
| Receipt  | `/receipt/[orderNo]` | Order receipt with print                                |

### New Components & Context

- `CartContext.tsx` - Cart state with localStorage persistence
- `AuthContext.tsx` - Auth state with login/register/logout
- `HeaderClient.tsx` - Header with cart badge and auth buttons
- Added icons: CartIcon, UserIcon, PlusIcon, MinusIcon, LocationIcon

### Assets Added

- `/public/logo.png` - Brand logo
- `/public/menu/set-a.png` - Ayam Original Set A
- `/public/menu/set-b.png` - Ayam Original Set B
- `/public/menu/set-c.png` - Ayam Crispy Set C

### Backend Updates

- Added `Customer` model to Prisma schema
- Created `/api/v1/auth/login` and `/api/v1/auth/register` endpoints
- Installed bcryptjs for password hashing

## User Flow

```
Homepage → Menu → Add to Cart → Checkout
                                  ↓
                    Not logged in? → Login/Register
                                  ↓
                    Select Table or Takeaway
                                  ↓
                    Fill Customer Info → Pay
                                  ↓
                    Confirmation → Receipt (email sent)
```

## Menu Items (Hardcoded for MVP)

| Item  | Price   | Description                                       |
| ----- | ------- | ------------------------------------------------- |
| Set A | RM12.90 | Nasi, Ayam Original, Sambal, Timun, Kobis & Salad |
| Set B | RM13.90 | + Tempe & Tauhu                                   |
| Set C | RM14.90 | + Ayam Crispy, Kobis Goreng, Pedal & Hati         |

## Setup Commands

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Next Steps

- [ ] Add MenuItem model to database for dynamic menu
- [ ] Implement full order items in checkout
- [ ] Add JWT tokens for proper session management
- [ ] Deploy to production
