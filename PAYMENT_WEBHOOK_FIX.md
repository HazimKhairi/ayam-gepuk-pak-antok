# Payment Webhook Fix - Critical Bug Resolution

## Issue Summary
**Problem**: Orders showed "Awaiting Payment" in admin dashboard despite successful payment confirmation from ToyyibPay.

**Root Cause**: Missing `BACKEND_URL` environment variable in production, causing ToyyibPay webhooks to target `http://localhost:3001/api/v1/payments/callback` instead of the public server URL. This made webhooks unreachable.

**Impact**: All payments from Feb 16, 2026 onwards may have been affected. Orders remained in PENDING status even after successful payment.

## Evidence
- Order `AGP20260216IVYFMP` showed PENDING status despite ToyyibPay "Payment Approved" email
- Database query confirmed: `paymentStatus = PENDING`, `callbackData = NULL`
- ToyyibPay transaction API showed successful payment (status_id = "1")
- No webhook callbacks were received in backend logs

## Fix Implementation

### 1. Added BACKEND_URL Environment Variable
**Location**: `backend/.env`

```env
# Backend URL (CRITICAL: Required for ToyyibPay webhook callbacks)
# Must be publicly accessible
BACKEND_URL=http://72.62.243.23:3001
```

**Why This Matters**: ToyyibPay needs a public URL to POST payment status updates. Without this, the callback endpoint defaults to localhost, which is unreachable from external services.

### 2. Enhanced Webhook Logging
**File**: `backend/src/routes/payments.ts`

Added comprehensive logging to track webhook processing:
- Incoming webhook data
- Payment lookup results
- Status transitions
- Email/reminder errors

This helps debug future webhook issues quickly.

### 3. Added Payment Verification Endpoint
**New Endpoint**: `POST /api/v1/payments/verify/:orderNo`

**Purpose**: Manually verify and sync payment status from ToyyibPay when webhooks fail.

**How It Works**:
1. Queries ToyyibPay API for bill transactions
2. Checks for successful payment (billpaymentStatus = "1")
3. Updates local payment and order status
4. Triggers confirmation emails

**Use Case**: Recovery mechanism for webhook failures or network issues.

### 4. Manual Fix for Affected Order
**Order**: AGP20260216IVYFMP (Bill Code: 5bznd1qr)

```sql
UPDATE payments
SET status = 'SUCCESS',
    transactionId = 'TP2602163065910440',
    paidAt = '2026-02-16 16:03:36',
    callbackData = '{"manual_fix": true}'
WHERE billCode = '5bznd1qr';

UPDATE orders
SET status = 'COMPLETED'
WHERE orderNo = 'AGP20260216IVYFMP';
```

## Verification Steps

### Check If Order Is Fixed
```bash
curl http://72.62.243.23:3001/api/v1/payments/status/5bznd1qr
```

**Expected Response**:
```json
{
  "status": "SUCCESS",
  "order": {
    "orderNo": "AGP20260216IVYFMP",
    "status": "COMPLETED",
    ...
  }
}
```

### Verify BACKEND_URL Is Set
```bash
ssh root@72.62.243.23 'cat /var/www/agpa/backend/.env | grep BACKEND_URL'
```

**Expected Output**:
```
BACKEND_URL=http://72.62.243.23:3001
```

### Test Webhook Endpoint Accessibility
```bash
curl -X POST http://72.62.243.23:3001/api/v1/payments/callback \
  -H "Content-Type: application/json" \
  -d '{"billcode":"test","status_id":"1"}'
```

Should return 404 (payment not found) but proves endpoint is reachable.

## Prevention Measures

### 1. Updated Documentation
- `backend/.env.example` now includes BACKEND_URL with detailed comments
- CLAUDE.md updated with webhook troubleshooting steps

### 2. Future Monitoring
Monitor these logs for webhook issues:
```bash
pm2 logs agpa-backend | grep "ToyyibPay webhook"
```

Look for:
- `🔔 ToyyibPay webhook received` - Webhook arrived
- `❌ Payment not found` - Invalid billCode
- `✅ Order completed` - Successful processing

### 3. Webhook Testing Checklist
When deploying to new environments:

- [ ] Set `BACKEND_URL` to public IP/domain
- [ ] Test webhook endpoint is publicly accessible
- [ ] Verify ToyyibPay production credentials are set
- [ ] Check firewall allows incoming connections to port 3001
- [ ] Monitor logs after first real payment

## Recovery Procedure

If webhook failures occur again:

### Step 1: Identify Affected Orders
```sql
SELECT o.orderNo, o.status, p.status as paymentStatus, p.billCode
FROM orders o
LEFT JOIN payments p ON p.orderId = o.id
WHERE o.status = 'PENDING'
  AND p.callbackData IS NULL
  AND o.createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

### Step 2: Verify Payments with ToyyibPay
Use the new verification endpoint:
```bash
curl -X POST http://72.62.243.23:3001/api/v1/payments/verify/ORDER_NO_HERE
```

### Step 3: Bulk Recovery (if needed)
For each order:
1. Get billCode from database
2. Call verification endpoint
3. Confirm order status updated

## Code Changes

### Files Modified
1. `backend/src/routes/payments.ts` - Enhanced webhook handler + verification endpoint
2. `backend/.env` - Added BACKEND_URL
3. `backend/.env.example` - Documentation for BACKEND_URL
4. `backend/src/utils/toyyibpay.ts` - Already using BACKEND_URL (no changes needed)

### New Features
- Comprehensive webhook logging
- Payment verification endpoint (`POST /verify/:orderNo`)
- Better error messages

## Testing Results

### Test 1: Fixed Order Status
```bash
$ curl http://72.62.243.23:3001/api/v1/payments/status/5bznd1qr
{
  "status": "SUCCESS",
  "order": {
    "orderNo": "AGP20260216IVYFMP",
    "status": "COMPLETED",
    "customerName": "Kimie",
    "total": "1.32"
  }
}
```
✅ PASSED

### Test 2: BACKEND_URL Set
```bash
$ ssh root@72.62.243.23 'cat /var/www/agpa/backend/.env | grep BACKEND_URL'
BACKEND_URL=http://72.62.243.23:3001
```
✅ PASSED

### Test 3: Backend Running
```bash
$ pm2 status
┌────┬──────────────────┬─────────┬──────┬───────────┐
│ id │ name             │ mode    │ pid  │ status    │
├────┼──────────────────┼─────────┼──────┼───────────┤
│ 4  │ agpa-backend     │ cluster │ ...  │ online    │
```
✅ PASSED

## Deployment Checklist

When deploying this fix:

- [x] Add BACKEND_URL to production .env
- [x] Deploy updated payments.ts with logging
- [x] Deploy updated .env.example
- [x] Manually fix affected order AGP20260216IVYFMP
- [x] Restart backend (pm2 restart agpa-backend)
- [x] Verify order status via API
- [x] Monitor logs for webhook reception

## Known Limitations

1. **Local Development**: Webhooks cannot reach localhost. Use manual completion endpoint for testing.
2. **Firewall**: VPS firewall must allow incoming connections on port 3001 for webhooks to work.
3. **HTTPS**: Currently using HTTP. Consider upgrading to HTTPS for production security.

## Next Steps

### Recommended Improvements
1. **Add HTTPS**: Use nginx reverse proxy with SSL certificate
2. **Webhook Retry**: Implement retry mechanism if webhook processing fails
3. **Status Polling**: Background job to poll ToyyibPay for PENDING orders older than 10 minutes
4. **Alert System**: Notify admin when payment webhook fails
5. **Audit Log**: Track all payment status changes with timestamps

### Monitoring
Set up alerts for:
- Orders stuck in PENDING for >15 minutes
- Payments with NULL callbackData
- Webhook processing errors

## Conclusion

The webhook issue has been resolved by adding the missing `BACKEND_URL` environment variable. The affected order (AGP20260216IVYFMP) has been manually fixed and is now showing COMPLETED status. Enhanced logging and the new verification endpoint will help prevent and recover from similar issues in the future.

**Critical Action**: Check for other orders that may be stuck in PENDING status due to this issue and use the verification endpoint to fix them.
