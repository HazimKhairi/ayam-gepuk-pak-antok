# HAZIMDEV Development Log - Ayam Gepuk Pak Antok Booking System

## 2026-02-12 - Client Information Update & System Expansion

### Completed
1. **Expanded Outlet System from 4 to 6 Outlets**
   - Added 3 new outlets: Larkin (Johor), Merlimau, and Jasin
   - Updated all outlet information with correct addresses, phone numbers, capacities, and Google Maps links
   - Outlet capacities:
     - Masjid Tanah: 128 pax
     - Bukit Beruang: 91 pax
     - Larkin: 112 pax
     - Lagenda: 116 pax
     - Merlimau: 100 pax
     - Jasin: 100 pax

2. **Updated Business Hours**
   - Dine-in booking window: 10:00 AM - 5:00 PM
   - Takeaway hours: 2:00 PM - 11:00 PM (initial 2 weeks of Ramadan)
   - Note: Can be extended to 2:00 PM - 12:00 AM for subsequent weeks (admin configurable via time slots)

3. **Updated Menu Prices from Senarai Menu AGPA.pdf**
   - Set A (Crispy/Original): RM12.90
   - Set B (Crispy/Original): RM13.90
   - Set C (Crispy/Original): RM14.90 (NEW)
   - Set Lele Pak Antok: RM13.90 (NEW)
   - Set Bihun Soto: RM10.00 (NEW)
   - Set Coco Meal: RM10.90
   - Strawberry Mojito: RM7.90 (NEW)
   - Apple Mojito: RM7.90 (NEW)
   - Blue Lemon Ice: RM3.00 (NEW)
   - Blackcurrent Ice: RM3.00 (NEW)
   - Ice Lemon Tea: RM3.00 (NEW)
   - Ayam Original: RM8.00 (NEW)
   - Ayam Crispy: RM8.00 (NEW)
   - Sup Bebola: RM5.90 (NEW)
   - Pedal/Hati (3pcs): RM3.00 (NEW)
   - Kobis Goreng: RM3.00 (NEW)
   - Bergedil (4pcs): RM5.00 (NEW)

4. **Added Social Media Integration**
   - Instagram: https://www.instagram.com/ayamgepukpakantok.hq/?hl=en
   - TikTok: https://www.tiktok.com/@ayamgepukpakantok
   - Stored in Settings table for easy access across the system

5. **Database Schema Updates**
   - Added `googleMapsUrl` field (VARCHAR 500) to Outlet model for storing Google Maps navigation links
   - Updated Outlet closeTime default from 15:00 to 17:00 (5:00 PM)
   - Updated schema comment from "5 restaurant locations" to "6 restaurant locations"

6. **Verified SST Implementation**
   - Confirmed SST rate is set to 6% in system settings
   - SST calculation already implemented in backend Order model and frontend CartContext

### Technical Decisions
- **Google Maps URL Storage**: Added optional `googleMapsUrl` field to Outlet model rather than constructing URLs dynamically. This provides flexibility for different URL formats and allows easy updates without code changes.
- **Time Slot Flexibility**: Generated 19 time slots from 14:00 to 23:00 in 30-minute intervals. Admin can easily extend to 00:00 by adding one more slot via admin panel if needed.
- **Menu Expansion**: Increased from 4 to 17 menu items covering Set Menu (6 items), Drinks (5 items), and Ala Carte (6 items). All prices match the client-provided PDF exactly.
- **Social Media Settings**: Stored URLs in Settings table with keys `instagram_url` and `tiktok_url` for easy retrieval and updates without code deployment.
- **Backward Compatibility**: All changes maintain compatibility with existing pax-based dine-in booking system, takeaway slot logic, and payment flow.

### Files Modified
1. `/Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend/prisma/schema.prisma`
   - Added `googleMapsUrl` field to Outlet model
   - Updated default `closeTime` to 17:00
   - Updated model comment

2. `/Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend/prisma/seed.ts`
   - Expanded outlets from 4 to 6 with complete information
   - Updated all menu items with new prices and added 13 new items
   - Added time slots for takeaway hours (14:00-23:00)
   - Added social media links to settings
   - Updated business hours (openTime: 10:00, closeTime: 17:00)

### Next Steps
1. **Database Migration**: Run `npm run db:generate` and `npm run db:migrate` to apply schema changes
2. **Re-seed Database**: Run `npm run db:seed` to populate with updated outlet and menu data (WARNING: This will clear all existing data)
3. **Frontend Updates**: Update frontend components to display Google Maps links and social media icons
4. **Admin Panel**: Ensure admin can manage the extended time slots (up to 00:00) if needed after the first 2 weeks
5. **Testing**: Test dine-in booking with new 10am-5pm window and takeaway booking with 2pm-11pm slots
6. **Documentation**: Update user documentation with new outlet locations and menu items

### Important Notes
- Original seed file backed up at `backend/prisma/seed.ts.backup`
- SST 6% already correctly implemented, no changes needed
- Phone numbers updated for all outlets as per client specification
- All Google Maps URLs tested and functional
- Menu categories: "Set Menu", "Drinks", "Ala Carte"
- Featured items: Set A, Set B, Set C, Set Coco Meal (4 items, within max 3 can be adjusted)

### Database Seed Command
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend
npm run db:generate
npm run db:migrate
npm run db:seed
```
