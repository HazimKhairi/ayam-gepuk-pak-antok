# Payment Double Verification System

**Date**: February 16, 2026
**Status**: ✅ IMPLEMENTED

---

## Problem Before

**Single Point of Failure**: Webhook sahaja

```
User bayar → ToyyibPay → Webhook → Backend ✅
                           ↓ (fail)
                           ❌ Order stuck PENDING!
```

**Kenapa webhook fail?**
- Network issues
- Server restart time webhook arrives
- Firewall blocking
- ToyyibPay retry mechanism failed

---

## Solution: Double Verification 🎯

**Two Ways to Detect Success**:

### Method 1: Webhook (Background) - PRIMARY
```
ToyyibPay → POST /api/v1/payments/callback → Update order
```
- Runs in background
- User tak nampak
- Fast & reliable (when it works)

### Method 2: Return URL (Frontend) - BACKUP ✅
```
User redirect → /confirmation/{orderNo} → POST /api/v1/payments/verify/{orderNo} → Update order
```
- Runs when user lands on success page
- User-triggered verification
- **Backup if webhook fails!** ✅

---

## How It Works

### Flow Diagram

```
┌─────────────┐
│ User Bayar  │
│ di ToyyibPay│
└──────┬──────┘
       │
       ├────────────────────────┬──────────────────────────┐
       │                        │                          │
       ▼                        ▼                          ▼
┌─────────────┐        ┌─────────────┐          ┌─────────────┐
│  Webhook    │        │   Return    │          │   Redirect  │
│  (Backend)  │        │  ToyyibPay  │          │   to        │
│             │        │             │          │  /confirm   │
└──────┬──────┘        └─────────────┘          └──────┬──────┘
       │                                                │
       │ (Sometimes fail ❌)                            │
       │                                                │
       ▼                                                ▼
┌──────────────────────────────────────────────────────────────┐
│              Frontend Verification (BACKUP) ✅               │
│                                                              │
│  useEffect on /confirmation/{orderNo}:                      │
│  1. Call POST /api/v1/payments/verify/{orderNo}            │
│  2. Backend checks ToyyibPay directly                       │
│  3. If payment SUCCESS but order PENDING → Update!          │
│  4. Send confirmation email                                 │
│  5. Show success message                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Backend Endpoint (Already Exists!)

**File**: `backend/src/routes/payments.ts` (Line 126-232)

```typescript
// POST /api/v1/payments/verify/:orderNo
router.post('/verify/:orderNo', async (req, res) => {
  // 1. Find order by orderNo
  const order = await prisma.order.findUnique({
    where: { orderNo: req.params.orderNo },
    include: { payment: true, outlet: true, table: true, timeSlot: true },
  });

  // 2. Skip if already completed
  if (order.payment.status === 'SUCCESS') {
    return res.json({ success: true, alreadyCompleted: true });
  }

  // 3. Check ToyyibPay directly
  const result = await getBillTransactions(order.payment.billCode);

  // 4. Find successful transaction
  const successfulTxn = result.transactions.find(
    (txn) => txn.billpaymentStatus === '1'
  );

  if (successfulTxn) {
    // 5. Update payment status
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: 'SUCCESS',
        transactionId: successfulTxn.billpaymentInvoiceNo,
        paidAt: new Date(),
      },
    });

    // 6. Update order to COMPLETED
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED' },
    });

    // 7. Send confirmation email
    sendConfirmationEmail(order).catch(() => {});

    return res.json({ success: true, wasVerified: true });
  }
});
```

**Key Features**:
- ✅ Idempotent (safe to call multiple times)
- ✅ Checks ToyyibPay directly via `getBillTransactions()`
- ✅ Updates payment + order status if successful
- ✅ Sends confirmation email
- ✅ Returns clear status

---

### 2. Frontend Implementation (NEW!)

**File**: `frontend/src/app/confirmation/[orderNo]/ConfirmationContent.tsx`

**Changes Made**:

#### Added Verification on Mount
```typescript
useEffect(() => {
  const verifyAndFetchOrder = async () => {
    try {
      // Step 1: Verify payment (BACKUP mechanism)
      setVerifying(true);
      const verifyResponse = await fetch(
        `${API_URL}/payments/verify/${orderNo}`,
        { method: 'POST' }
      );

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        if (verifyData.success || verifyData.alreadyCompleted) {
          setVerificationStatus('success');
        }
      }

      setVerifying(false);

      // Step 2: Fetch order details (now updated)
      const data = await reservationApi.getByOrderNo(orderNo);
      setOrder(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (orderNo) {
    verifyAndFetchOrder();
  }
}, [orderNo]);
```

#### Loading State
```tsx
if (loading) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
      {verifying && (
        <p className="text-lg font-semibold text-gray-700">
          🔍 Verifying your payment...
        </p>
      )}
    </div>
  );
}
```

#### Success Notification
```tsx
{verificationStatus === 'success' && (
  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
    <p className="text-sm text-green-700">
      ✓ Payment verified successfully
    </p>
  </div>
)}
```

---

## User Experience

### Scenario 1: Webhook Works ✅ (Normal)

1. User bayar at ToyyibPay
2. Webhook arrives at backend → Order updated to COMPLETED
3. User redirects to `/confirmation/{orderNo}`
4. Frontend calls verify endpoint
5. Backend sees payment already SUCCESS → Returns `alreadyCompleted: true`
6. User sees success page immediately ✅

**Result**: Seamless, no delay!

---

### Scenario 2: Webhook Fails ❌ (Backup Kicks In)

1. User bayar at ToyyibPay
2. Webhook fails to arrive (network issue) ❌
3. Order stuck at PENDING status
4. User redirects to `/confirmation/{orderNo}`
5. Frontend calls verify endpoint
6. Backend checks ToyyibPay directly
7. Backend finds successful payment
8. Backend updates order to COMPLETED ✅
9. Backend sends confirmation email ✅
10. User sees success page with "Payment verified successfully" ✅

**Result**: Backup mechanism saved the order! 🎉

---

### Scenario 3: Both Fail (Extremely Rare)

If BOTH webhook AND return URL fail:
- User didn't get redirected (closed browser?)
- Network completely down

**Manual Recovery**:
```bash
# Admin can use verify endpoint manually
curl -X POST http://72.62.243.23:3001/api/v1/payments/verify/{orderNo}
```

Or run recovery script:
```bash
cd backend
npx ts-node scripts/verify-stuck-payments.ts
```

---

## Benefits

### 1. **Reliability** ✅
- Webhook fail? No problem!
- Two chances to detect success
- Less stuck orders

### 2. **User Confidence** ✅
- "Verifying payment" message shows system is working
- Clear feedback when verification succeeds
- User knows payment is confirmed

### 3. **Automatic Recovery** ✅
- No manual intervention needed
- System self-heals
- Confirmation emails still sent

### 4. **Better UX** ✅
- User lands on confirmation page = instant verification
- Real-time status updates
- Transparent process

---

## Testing

### Test Case 1: Normal Flow (Webhook Works)

**Steps**:
1. Make a booking
2. Complete payment at ToyyibPay
3. Get redirected to confirmation page

**Expected**:
- ✅ Order status: COMPLETED (from webhook)
- ✅ Verification message: "Payment verified successfully"
- ✅ Confirmation email received
- ✅ No duplicate emails

---

### Test Case 2: Webhook Failure (Backup Works)

**Steps**:
1. Disable webhook temporarily (firewall block)
2. Make a booking
3. Complete payment at ToyyibPay
4. Get redirected to confirmation page

**Expected**:
- ✅ Shows "Verifying payment" message
- ✅ Backend checks ToyyibPay directly
- ✅ Order updated to COMPLETED
- ✅ Confirmation email sent
- ✅ Success message displayed

**How to Test**:
```bash
# Temporarily block webhook (for testing only!)
# Option 1: Add firewall rule to block ToyyibPay IP
# Option 2: Stop backend server during webhook send

# Then complete payment and verify order gets updated via return URL
```

---

### Test Case 3: Idempotency (Multiple Calls)

**Steps**:
1. Complete payment
2. Refresh confirmation page multiple times

**Expected**:
- ✅ No duplicate order updates
- ✅ No duplicate emails
- ✅ Returns "already completed" status
- ✅ Fast response (cached check)

---

## Monitoring

### Backend Logs

**Webhook Success**:
```
🔔 ToyyibPay webhook received: {...}
📦 Found payment for order: AGP-1234567890
💳 Payment status: SUCCESS (status_id: 1)
✅ Order completed: AGP-1234567890
```

**Verification Called**:
```
🔍 Verifying payment for order AGP-1234567890 with billCode TB12345
✅ Found successful payment for AGP-1234567890: INV-12345
```

**Already Completed**:
```
⚠️ Payment already processed: AGP-1234567890
```

### Frontend Logs

```javascript
console.log('🔍 Verifying payment for order:', orderNo);
console.log('✅ Payment verification result:', verifyData);
```

---

## Deployment

**Modified Files**:
- ✅ `backend/src/routes/payments.ts` (already has verify endpoint)
- ✅ `frontend/src/app/confirmation/[orderNo]/ConfirmationContent.tsx` (NEW changes)

**Deployment Steps**:

### 1. Frontend Changes
```bash
# Upload modified component
scp frontend/src/app/confirmation/[orderNo]/ConfirmationContent.tsx root@72.62.243.23:/var/www/agpa/frontend/src/app/confirmation/[orderNo]/

# Build and restart frontend
ssh root@72.62.243.23 'cd /var/www/agpa/frontend && npm run build && pm2 restart agpa-frontend'
```

### 2. Verify Deployment
```bash
# Check frontend logs
ssh root@72.62.243.23 'pm2 logs agpa-frontend --lines 20 --nostream'

# Test verification endpoint
curl -X POST http://72.62.243.23:3001/api/v1/payments/verify/AGP-1234567890
```

---

## Configuration

**Environment Variables** (already set):
- `TOYYIBPAY_URL` - ToyyibPay API endpoint
- `TOYYIBPAY_SECRET_KEY` - For API authentication
- `FRONTEND_URL` - Return URL base
- `BACKEND_URL` - Callback URL base (must be public!)

**Return URL Format**:
```
${FRONTEND_URL}/confirmation/${order.orderNo}
```

Example: `http://72.62.243.23:3000/confirmation/AGP-1234567890`

---

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Webhook fails** | ❌ Order stuck PENDING | ✅ Backup verification fixes it |
| **Detection methods** | 1 (webhook only) | 2 (webhook + return URL) |
| **User feedback** | ❌ No verification visible | ✅ "Verifying payment" message |
| **Recovery** | ⚠️ Manual intervention | ✅ Automatic |
| **Stuck orders** | ⚠️ Common issue | ✅ Rare (only if both fail) |
| **Confidence** | ⚠️ Medium | ✅ High |

---

## Best Practices

### 1. **Always Call Verify on Confirmation Page** ✅
- Even if webhook worked
- Idempotent operation (safe)
- Provides user feedback

### 2. **Log Everything** 📝
- Log verification attempts
- Log ToyyibPay responses
- Easy debugging

### 3. **Handle Errors Gracefully** 🛡️
```typescript
try {
  await verifyPayment();
} catch (error) {
  // Continue anyway - user should see their order
  console.warn('Verification failed, continuing:', error);
}
```

### 4. **Show Status to User** 👤
- "Verifying payment..." → User knows system is working
- "Payment verified" → Confidence boost
- Silent errors → User not confused

---

## Future Improvements

### 1. Retry Logic (Optional)
```typescript
const verifyWithRetry = async (orderNo: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await verifyPayment(orderNo);
      if (result.success) return result;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2000 * (i + 1)); // Exponential backoff
    }
  }
};
```

### 2. Webhook Status Dashboard
- Show webhook success rate
- Alert if webhook fails > 5%
- Monitor verification usage

### 3. SMS Notification (Optional)
- Send SMS when payment verified via backup
- Extra confirmation for peace of mind

---

## Conclusion

**Double Verification System** = **Reliable Payment Detection** ✅

**Two mechanisms** ensure payment is never missed:
1. **Webhook** (primary) - Fast, automatic
2. **Return URL** (backup) - User-triggered failsafe

**Result**:
- Fewer stuck orders ✅
- Better user experience ✅
- Automatic recovery ✅
- Higher reliability ✅

**Production URL**:
http://72.62.243.23:3000/confirmation/{orderNo}

---

## Related Documentation
- `PAYMENT_WEBHOOK_FIX.md` - Webhook troubleshooting guide
- `PAYMENT_TRACKING_GUIDE.md` - Payment status tracking
- `DASHBOARD_CONSISTENCY_FIX.md` - Payment status as source of truth
