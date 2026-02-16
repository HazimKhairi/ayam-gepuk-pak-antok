# Payment Webhook - Quick Reference Card

## Critical Environment Variable
```env
BACKEND_URL=http://72.62.243.23:3001
```
**Location**: `/var/www/agpa/backend/.env`
**Purpose**: Allows ToyyibPay to send payment confirmations

## Webhook Endpoints

### Automatic (ToyyibPay calls this)
```
POST http://72.62.243.23:3001/api/v1/payments/callback
```
Automatically updates order status when payment succeeds.

### Manual Recovery
```bash
# Fix a stuck order
curl -X POST http://72.62.243.23:3001/api/v1/payments/verify/AGP20260216XXXXX

# Check payment status
curl http://72.62.243.23:3001/api/v1/payments/status/5bznd1qr
```

### Batch Recovery
```bash
cd /var/www/agpa/backend
npx ts-node scripts/verify-stuck-payments.ts
```

## Monitor Webhooks
```bash
# Watch webhook logs in real-time
pm2 logs agpa-backend --lines 100 | grep "webhook"

# Check for recent webhooks
pm2 logs agpa-backend --lines 50 --nostream | grep "🔔 ToyyibPay"
```

## Find Stuck Orders
```sql
-- SSH to VPS first
mysql -u root -p'hTRLAkJbYLGgP6gf' ayamgepuk

-- Run this query
SELECT o.orderNo, o.status, o.customerName, o.total, p.billCode
FROM orders o
LEFT JOIN payments p ON p.orderId = o.id
WHERE o.status = 'PENDING'
  AND p.callbackData IS NULL
ORDER BY o.createdAt DESC;
```

## Troubleshooting Checklist

### Payment not updating?
- [ ] Check BACKEND_URL is set: `grep BACKEND_URL /var/www/agpa/backend/.env`
- [ ] Check webhook logs: `pm2 logs agpa-backend | grep webhook`
- [ ] Use verify endpoint: `POST /verify/:orderNo`
- [ ] Check ToyyibPay payment status in their dashboard

### Webhook not reaching server?
- [ ] Test endpoint accessibility: `curl http://72.62.243.23:3001/health`
- [ ] Check firewall allows port 3001: `netstat -tuln | grep 3001`
- [ ] Verify backend is running: `pm2 status`

### Order stuck after successful payment?
```bash
# Quick fix
curl -X POST http://72.62.243.23:3001/api/v1/payments/verify/ORDER_NO

# Should return
{"success":true,"message":"Payment verified and order completed"}
```

## Normal Webhook Flow
1. Customer pays via ToyyibPay
2. ToyyibPay sends POST to `{BACKEND_URL}/api/v1/payments/callback`
3. Backend logs: `🔔 ToyyibPay webhook received`
4. Payment status updated: PENDING → SUCCESS
5. Order status updated: PENDING → COMPLETED
6. Backend logs: `✅ Order completed: AGP20260216XXXXX`
7. Confirmation email sent

## Log Patterns to Watch

### Success
```
🔔 ToyyibPay webhook received: {...}
📦 Found payment for order: AGP20260216XXXXX
💳 Payment status: SUCCESS (status_id: 1)
✅ Order completed: AGP20260216XXXXX
```

### Failure (need to investigate)
```
❌ Payment not found for billCode: xxxx
❌ Webhook processing error: ...
```

## Production URLs
- Backend API: http://72.62.243.23:3001/api/v1
- Webhook: http://72.62.243.23:3001/api/v1/payments/callback
- Health: http://72.62.243.23:3001/health
- Frontend: https://agpa.nextapmy.com

## Emergency Contacts
- ToyyibPay Support: https://toyyibpay.com/support
- VPS Details: See `vps_account.md`

---
**Last Updated**: Feb 16, 2026
**Status**: All systems operational ✅
