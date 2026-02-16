# Order Status Display Improvement

## Current Issue
User sees "PENDING" status which might be confusing.

## Solution Options

### Option 1: Better Status Labels (Recommended)
Instead of showing technical status, show user-friendly labels:

| Database Status | Display to Customer |
|----------------|---------------------|
| PENDING | "⏳ Awaiting Payment" |
| COMPLETED | "✅ Confirmed" |
| CANCELLED | "❌ Cancelled" |

**Implementation:**
```typescript
// frontend/src/utils/orderStatus.ts
export function getOrderStatusDisplay(status: string) {
  const statusMap = {
    'PENDING': {
      label: 'Awaiting Payment',
      icon: '⏳',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50'
    },
    'COMPLETED': {
      label: 'Confirmed',
      icon: '✅',
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    'CANCELLED': {
      label: 'Cancelled',
      icon: '❌',
      color: 'text-red-600',
      bg: 'bg-red-50'
    }
  };

  return statusMap[status] || statusMap['PENDING'];
}
```

### Option 2: Remove PENDING Status Completely
**NOT RECOMMENDED** - This requires major architecture changes:

1. Use payment gateway with different flow (Stripe, Razorpay)
2. Implement payment intent pattern
3. Create order only after payment confirmed

**Cons:**
- Major code rewrite
- Change payment provider
- Different integration complexity
- May have other issues

### Option 3: Auto-redirect After Order Creation
Don't show order status page at all - redirect immediately to payment:

```typescript
// After order creation
const result = await reservationApi.createDineIn({...});

// Don't show order page - redirect immediately
if (result.paymentUrl) {
  window.location.href = result.paymentUrl;  // Instant redirect
}
```

**Pros:**
- User doesn't see PENDING status
- Seamless payment flow

**Cons:**
- User doesn't see order summary
- Can't review before payment

## Recommended Approach

**Combine Option 1 + 3:**
1. Show better status labels (not "PENDING")
2. Immediate redirect to payment
3. After payment, show "COMPLETED" with nice confirmation

**User Flow:**
```
Place Order
    ↓
Brief loading... (1-2 seconds)
    ↓
Auto-redirect to ToyyibPay ← User doesn't see PENDING
    ↓
Payment complete
    ↓
Confirmation page (COMPLETED) ✅
```

## Implementation Priority

**High Priority (Quick Fix):**
- ✅ Better status labels
- ✅ Auto-redirect to payment

**Low Priority (Optional):**
- ❌ Remove PENDING status (requires major changes)
