# Unpaid Orders Filter Fix

**Date**: February 16, 2026
**Status**: ✅ FIXED and DEPLOYED

---

## Problem

User reported: **"show unpaid order tapi semua hijau"** (showing unpaid orders but all green)

### What Was Wrong:

When admin ticked the checkbox **"Show unpaid orders (awaiting payment)"**:
- ❌ **Expected**: Show only PENDING orders (yellow badge ⏳)
- ❌ **Actually**: Showed COMPLETED orders (green badge ✅)

The filter logic was backwards!

---

## Root Cause

**File**: `backend/src/routes/admin.ts`
**Line**: 170-174

### Before (Incorrect Logic):
```typescript
// By default, only show orders with successful payment (exclude unpaid/abandoned orders)
if (showUnpaid !== 'true') {
  where.payment = {
    status: 'SUCCESS'
  };
}
```

**Problem**:
- When `showUnpaid = false` → Filter for payment.status = 'SUCCESS' ✅ (Correct)
- When `showUnpaid = true` → No filter applied, shows ALL orders ❌ (Wrong!)

---

## Solution

### After (Correct Logic):
```typescript
// Filter based on showUnpaid checkbox
if (showUnpaid === 'true') {
  // Show only unpaid orders (PENDING status)
  where.status = 'PENDING';
} else {
  // By default, only show orders with successful payment
  where.payment = {
    status: 'SUCCESS'
  };
}
```

**Now**:
- When `showUnpaid = false` → Show orders with payment.status = 'SUCCESS' ✅
- When `showUnpaid = true` → Show orders with status = 'PENDING' ✅

---

## Behavior After Fix

### Checkbox UNCHECKED (Default):
- Shows: Orders with **successful payment** (COMPLETED status)
- Badge: ✅ Green "Completed"
- Use case: View confirmed paid orders

### Checkbox CHECKED:
- Shows: Orders **awaiting payment** (PENDING status)
- Badge: ⏳ Yellow "Awaiting Payment"
- Use case: Track unpaid/abandoned orders

---

## Testing

1. ✅ Go to Admin Orders page
2. ✅ Untick "Show unpaid orders" → See COMPLETED orders (green)
3. ✅ Tick "Show unpaid orders" → See PENDING orders (yellow)
4. ✅ Filter works with other filters (outlet, type, status)

---

## Files Modified

- `backend/src/routes/admin.ts` (Lines 164-177)

---

## Deployment

```bash
# Upload fixed file
scp backend/src/routes/admin.ts root@72.62.243.23:/var/www/agpa/backend/src/routes/

# Build and restart backend
ssh root@72.62.243.23 'cd /var/www/agpa/backend && npm run build && pm2 restart agpa-backend'
```

**Status**: ✅ Live in production

---

## Summary

**Problem**: "Show unpaid orders" checkbox was showing paid orders instead
**Cause**: Backwards filter logic in backend
**Fix**: When checkbox ticked, filter for `status = 'PENDING'`
**Result**: Now correctly shows yellow PENDING orders when checkbox is ticked ✅

---

## Production URL

http://72.62.243.23:3000/admin/orders/
