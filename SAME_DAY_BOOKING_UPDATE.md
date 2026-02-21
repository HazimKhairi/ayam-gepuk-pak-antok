# Same-Day Booking Update (Feb 21, 2026)

## Overview
Updated booking system to allow same-day dine-in and takeaway bookings with improved user experience.

## Changes Made

### 1. Dine-in Booking
**Behavior:** Allow same-day booking with automatic filtering of past time slots

**Backend Changes:**
- `backend/src/routes/reservations.ts`:
  - Changed `minDaysAhead` from `1` to `0` (line 130)
  - Now allows booking for today

- `backend/src/routes/outlets.ts`:
  - Added logic to filter past time slots when booking for today (lines 200-220)
  - For same-day bookings, time slots that have already passed are automatically disabled and removed from the response
  - Future dates show all available time slots

**Frontend Changes:**
- `frontend/src/app/book/dine-in/page.tsx`:
  - Changed initial date from `tomorrow` to `today`
  - Removed `minDate={tomorrow}` restriction from DatePicker
  - DatePicker now starts from today's date

**User Experience:**
- Customers can now book dine-in for today
- If current time is 3pm, only slots from 4pm onwards are shown
- For tomorrow or future dates, all available slots are displayed
- Past slots are automatically hidden for same-day bookings

---

### 2. Takeaway Booking
**Behavior:** Simplified UI without explicit time slot selection; backend still tracks capacity

**Backend Changes:**
- `backend/src/routes/reservations.ts`:
  - Changed `minDaysAhead` from `1` to `0` (line 262)
  - Backend still assigns orders to time slots for capacity tracking
  - `maxOrders` limit per slot still enforced

**Frontend Changes:**
- `frontend/src/app/book/takeaway/page.tsx`:
  - Completely redesigned UI
  - Removed `DateTimePicker` component
  - Added simple `DatePicker` + time button grid
  - Shows outlet operating hours prominently
  - Added cart summary display
  - Customer selects pickup time from available slots
  - Backend auto-assigns to appropriate time slot for capacity tracking

**User Experience:**
- No more complex slot selection interface
- Shows operating hours: e.g., "Operating Hours: 14:00 - 23:00"
- Simple time button grid (e.g., 14:00, 15:00, 16:00...)
- Cart summary visible on the form
- Same-day pickup now allowed
- Backend maintains order limits per slot behind the scenes

---

### 3. Delivery Booking
**Behavior:** No changes - keeps current behavior

**Status:**
- Still requires `minDaysAhead=1` (must book at least 1 day in advance)
- No changes to delivery flow

---

## Technical Implementation

### Time Slot Filtering Logic (Dine-in)
```typescript
// Backend: outlets.ts
const now = new Date();
const isToday = bookingDate.getTime() === today.getTime();

if (isToday && !isDisabled) {
  const [slotHour, slotMinute] = slot.time.split(':').map(Number);
  const slotDateTime = new Date(now);
  slotDateTime.setHours(slotHour, slotMinute, 0, 0);

  // Disable if slot time has already passed
  if (slotDateTime <= now) {
    isDisabled = true;
  }
}
```

### Auto-Assignment Logic (Takeaway)
```typescript
// Frontend: takeaway/page.tsx
// Find the slot matching selected pickup time
const selectedSlot = availableSlots.find(slot => slot.time === pickupTime);

// Backend receives timeSlotId and assigns order to that slot
// maxOrders limit is still enforced in transaction
```

---

## Summary of Booking Rules

| Type     | Same-Day Allowed? | Time Slot UI     | Capacity Tracking |
|----------|-------------------|------------------|-------------------|
| Dine-in  | ✅ Yes            | Full slot picker | Pax-based         |
| Takeaway | ✅ Yes            | Simple time grid | Slot-based (hidden) |
| Delivery | ❌ No (tomorrow+) | No slots         | N/A               |

---

## Files Modified

### Backend (4 files)
1. `backend/src/routes/reservations.ts` - Changed minDaysAhead for dine-in and takeaway
2. `backend/src/routes/outlets.ts` - Added past slot filtering for same-day dine-in

### Frontend (2 files)
1. `frontend/src/app/book/dine-in/page.tsx` - Removed tomorrow restriction
2. `frontend/src/app/book/takeaway/page.tsx` - Complete UI redesign with simple time picker

---

## Testing Checklist

### Dine-in
- [ ] Can book for today (before outlet closes)
- [ ] Past time slots are hidden when booking for today
- [ ] All slots visible when booking for tomorrow/future
- [ ] Capacity limits still enforced correctly
- [ ] Error handling for fully booked slots

### Takeaway
- [ ] Can book for today
- [ ] Operating hours displayed correctly
- [ ] Time buttons show availability status
- [ ] Cart items included in order submission
- [ ] Backend correctly assigns to time slot
- [ ] `maxOrders` limit still enforced per slot
- [ ] Unavailable times are disabled/grayed out

### Delivery
- [ ] Still requires booking tomorrow or later
- [ ] No changes to existing behavior

---

## Deployment Notes

### VPS Deployment Steps
1. **Backend:**
   ```bash
   cd backend
   npm run build
   pm2 restart agpa-backend
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm run build
   # Upload out/ directory to VPS
   rsync -avz --delete out/ root@72.62.243.23:/var/www/agpa/frontend/out/
   ```

3. **Verify:**
   ```bash
   pm2 logs agpa-backend --lines 20
   ```

---

## Future Enhancements
- Consider adding real-time slot availability updates via WebSocket
- Add estimated preparation time display for takeaway orders
- Implement slot availability notifications when slots become available
