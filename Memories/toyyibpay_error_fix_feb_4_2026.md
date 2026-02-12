# ToyyibPay Integration Error Fix - Feb 4, 2026

## Problem Encountered

User encountered multiple errors when trying to create dine-in reservations:

1. **Chrome Extension Errors**: `chrome-extension://invalid/` - harmless browser extension warnings
2. **API 500 Error**: `/api/v1/reservations/dine-in` endpoint failing
3. **ToyyibPay Error**: `[KEY-DID-NOT-EXIST-OR-USER-IS-NOT-ACTIVE]`

## Root Cause

The backend `.env` file had placeholder values instead of real credentials:

```env
TOYYIBPAY_SECRET_KEY=your_secret_key_here
TOYYIBPAY_CATEGORY_CODE=your_category_code_here
```

The ToyyibPay utility was treating these placeholder strings as valid credentials and attempting to call the real API, which resulted in authentication errors.

## Solution Implemented

### 1. Enhanced Credential Validation

Updated [`toyyibpay.ts`](file:///Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend/src/utils/toyyibpay.ts) to detect placeholder values:

```typescript
const isPlaceholder = (value: string) => {
  return (
    !value ||
    value.includes("your_") ||
    value.includes("_here") ||
    value === "your_secret_key_here" ||
    value === "your_category_code_here"
  );
};

if (isPlaceholder(SECRET_KEY) || isPlaceholder(CATEGORY_CODE)) {
  console.log(
    "⚠️ ToyyibPay credentials not set or using placeholders, using sandbox mock mode",
  );
  // Return mock payment URL for testing
}
```

### 2. Updated Secret Key

Updated backend [`.env`](file:///Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend/.env):

```env
TOYYIBPAY_SECRET_KEY=q1w8iiwu-wkeo-4b52-2udx-yhfe35t5vl9i
```

## Status

- ✅ Secret Key configured
- ⚠️ **Category Code still needed** - waiting for user to provide from ToyyibPay dashboard
- ✅ Mock mode fallback working for testing

## Next Steps

1. User needs to get Category Code from ToyyibPay dashboard:
   - Login to https://toyyibpay.com or https://dev.toyyibpay.com
   - Navigate to "Create Category" or "Package Settings"
   - Copy the Category Code (format: `cat_xxxxxxxxxxxxx`)

2. Update `.env` with Category Code:

   ```env
   TOYYIBPAY_CATEGORY_CODE=<actual_category_code>
   ```

3. Restart backend server for changes to take effect

## Files Modified

- [`backend/src/utils/toyyibpay.ts`](file:///Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend/src/utils/toyyibpay.ts) - Enhanced credential validation
- [`backend/.env`](file:///Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/backend/.env) - Updated secret key

## Testing Notes

Until Category Code is provided, the system will use **mock mode**:

- Mock payment URLs generated
- No real payment processing
- Suitable for development/testing
- Console shows: `⚠️ ToyyibPay credentials not set or using placeholders, using sandbox mock mode`
