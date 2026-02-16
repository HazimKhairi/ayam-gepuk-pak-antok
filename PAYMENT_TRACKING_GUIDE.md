# 💰 Payment Tracking Guide - ToyyibPay Integration

## 🔄 **Payment Flow Overview**

```
Customer Place Order
      ↓
Create Payment Record (PENDING)
      ↓
Redirect to ToyyibPay
      ↓
Customer Pay via ToyyibPay
      ↓
ToyyibPay Sends Webhook ← AUTOMATIC
      ↓
Backend Updates Payment (SUCCESS)
      ↓
Order Status → COMPLETED
      ↓
Send Confirmation Email
      ↓
Schedule Reminder (1 hour before)
```

---

## 📍 **4 Ways to Track Payment Status**

### **1. 🔔 ToyyibPay Webhook (Automatic)**

**Endpoint:** `POST /api/v1/payments/callback`

ToyyibPay automatically sends callback bila payment complete:

```javascript
// Callback data received
{
  billcode: "abc123xyz",
  order_id: "ORD-20260215-001",
  status_id: "1",  // 1=SUCCESS, 3=FAILED, 2=PENDING
  transaction_id: "TXN-123456",
  amount: "50.00",
  msg: "Payment successful"
}
```

**What Happens Automatically:**
- ✅ Payment status updated (SUCCESS/FAILED)
- ✅ Order status changed to COMPLETED
- ✅ Confirmation email sent to customer
- ✅ Reminder scheduled 1 hour before booking
- ✅ If FAILED → Order cancelled, slot released

**Code Location:** `backend/src/routes/payments.ts` (line 9-84)

---

### **2. 🔍 Check Payment Status via API**

**Endpoint:** `GET /api/v1/payments/status/:billCode`

**Example:**
```bash
curl http://72.62.243.23:3001/api/v1/payments/status/abc123xyz
```

**Response:**
```json
{
  "status": "SUCCESS",
  "order": {
    "id": "uuid",
    "orderNo": "ORD-20260215-001",
    "status": "COMPLETED",
    "customerName": "Ahmad",
    "customerEmail": "ahmad@example.com",
    "customerPhone": "0123456789",
    "totalAmount": "50.00",
    "bookingDate": "2026-03-15T00:00:00.000Z",
    "outlet": {
      "name": "Ayam Gepuk Pak Antok - Lagenda"
    },
    "timeSlot": {
      "time": "18:00"
    }
  }
}
```

**Code Location:** `backend/src/routes/payments.ts` (line 87-106)

---

### **3. 📊 Admin Dashboard**

**URL:** https://agpa.nextapmy.com/admin/orders

**Filter Options:**
- **PENDING** - Waiting for payment
- **COMPLETED** - Payment successful
- **CANCELLED** - Payment failed
- **All** - Show everything

**Info Displayed:**
- ✅ Order number
- ✅ Customer details
- ✅ Payment status
- ✅ Booking date & time
- ✅ Total amount
- ✅ Transaction ID (if paid)

**Screenshots:**
```
┌─────────────────────────────────────────────┐
│ ORDER NO    | STATUS    | CUSTOMER | AMOUNT │
├─────────────────────────────────────────────┤
│ ORD-001     | COMPLETED | Ahmad    | RM50   │
│ ORD-002     | PENDING   | Siti     | RM75   │
│ ORD-003     | CANCELLED | Ali      | RM60   │
└─────────────────────────────────────────────┘
```

---

### **4. 💻 Quick Check Script**

**Usage:**
```bash
./check-payment-status.sh <orderNo or billCode>
```

**Example 1 - Check by Order Number:**
```bash
./check-payment-status.sh ORD-20260215-001
```

**Example 2 - Check by Bill Code:**
```bash
./check-payment-status.sh abc123xyz
```

**Output:**
```
✅ ORDER FOUND
=====================================
Order No: ORD-20260215-001
Customer: Ahmad bin Ali
Phone: 0123456789
Email: ahmad@example.com

📍 BOOKING DETAILS
Outlet: Ayam Gepuk Pak Antok - Lagenda
Date: 2026-03-15
Time: 18:00
Type: DINE_IN
Pax: 4

💰 PAYMENT STATUS
Order Status: COMPLETED
Total Amount: RM50.00
Payment Status: SUCCESS
Bill Code: abc123xyz
Transaction ID: TXN-123456
Paid At: 2026-02-15T10:30:00.000Z
=====================================
```

---

## 📊 **Payment Status Types**

| Status | Description | Order Status | Action Taken |
|--------|-------------|--------------|--------------|
| **SUCCESS** | Payment completed | COMPLETED | Email sent, reminder scheduled |
| **PENDING** | Waiting for payment | PENDING | No action yet |
| **FAILED** | Payment declined/cancelled | CANCELLED | Slot released, order cancelled |

---

## 🔍 **Check Payment Status in Database**

### **Query by Order Number:**
```sql
SELECT
  o.orderNo,
  o.customerName,
  o.status AS orderStatus,
  p.status AS paymentStatus,
  p.billCode,
  p.transactionId,
  p.paidAt
FROM `Order` o
LEFT JOIN Payment p ON p.orderId = o.id
WHERE o.orderNo = 'ORD-20260215-001';
```

### **Query by Bill Code:**
```sql
SELECT
  p.billCode,
  p.status AS paymentStatus,
  p.transactionId,
  p.paidAt,
  o.orderNo,
  o.customerName,
  o.status AS orderStatus
FROM Payment p
LEFT JOIN `Order` o ON o.id = p.orderId
WHERE p.billCode = 'abc123xyz';
```

### **Check All Pending Payments:**
```sql
SELECT
  o.orderNo,
  o.customerName,
  o.createdAt,
  p.billCode,
  p.status AS paymentStatus,
  TIMESTAMPDIFF(MINUTE, o.createdAt, NOW()) AS minutesWaiting
FROM `Order` o
LEFT JOIN Payment p ON p.orderId = o.id
WHERE o.status = 'PENDING'
ORDER BY o.createdAt DESC;
```

---

## 🚨 **Troubleshooting**

### **Problem: Payment successful but order still PENDING**

**Possible Causes:**
1. Webhook not received (network issue)
2. Webhook URL incorrect in ToyyibPay settings
3. Server was down when webhook sent

**Solutions:**

**Option 1: Manual Completion (Testing/Emergency)**
```bash
curl -X POST http://72.62.243.23:3001/api/v1/payments/complete/ORD-20260215-001
```

**Option 2: Check ToyyibPay Dashboard**
- Login to https://toyyibpay.com
- Check transaction status
- Verify webhook URL: `http://72.62.243.23:3001/api/v1/payments/callback`

**Option 3: Check Server Logs**
```bash
ssh root@72.62.243.23
pm2 logs agpa-backend | grep callback
```

---

### **Problem: No email confirmation sent**

**Check:**
1. Payment status is SUCCESS ✅
2. SMTP credentials configured ✅
3. Email in order record is valid ✅

**Test Email:**
```bash
cd /var/www/agpa/backend
node test-email.js
```

**Check Email Logs:**
```bash
pm2 logs agpa-backend | grep -i email
```

---

### **Problem: Customer says paid but no record**

**Steps:**
1. Get Bill Code or Transaction ID from customer
2. Check payment status:
   ```bash
   ./check-payment-status.sh <billCode>
   ```
3. If not found, check ToyyibPay dashboard
4. Cross-reference with customer's payment receipt

---

## 📧 **Email Notifications**

### **Confirmation Email (Sent Immediately)**
- ✅ Sent when payment = SUCCESS
- Contains: Order details, booking info, QR code
- Template: `backend/src/utils/email.ts`

### **Reminder Email (Sent 1 Hour Before)**
- ✅ Scheduled automatically
- Sent 1 hour before booking time
- Contains: Reminder + booking details

---

## 🔐 **Security Notes**

### **Webhook Validation:**
Currently, webhook accepts all requests. For production, consider adding:

```javascript
// Verify signature (optional)
const signature = req.headers['x-signature'];
const expectedSignature = crypto
  .createHmac('sha256', TOYYIBPAY_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expectedSignature) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### **Prevent Duplicate Processing:**
Already implemented ✅
```javascript
if (payment.status === 'SUCCESS') {
  return res.json({ success: true, message: 'Already processed' });
}
```

---

## 📱 **Customer Journey**

1. **Place Order** → Order created (PENDING)
2. **Redirect to ToyyibPay** → Customer pays
3. **Payment Success** → ToyyibPay webhook sent
4. **Backend Updates** → Order → COMPLETED
5. **Email Sent** → Confirmation email
6. **Before Booking** → Reminder email (1 hour)

---

## 🎯 **Quick Reference**

### **Check Payment:**
```bash
# By Order Number
./check-payment-status.sh ORD-20260215-001

# By Bill Code
./check-payment-status.sh abc123xyz

# Via API
curl http://72.62.243.23:3001/api/v1/payments/status/abc123xyz
```

### **Manual Complete (Testing Only):**
```bash
curl -X POST http://72.62.243.23:3001/api/v1/payments/complete/ORD-20260215-001
```

### **Check Logs:**
```bash
pm2 logs agpa-backend --lines 50 | grep -i payment
```

### **Monitor Webhooks:**
```bash
pm2 logs agpa-backend --lines 100 | grep callback
```

---

## 📞 **Support During Ramadhan**

**If payment issues occur:**
1. Check payment status using script
2. Verify webhook received in logs
3. Check ToyyibPay dashboard
4. Manual complete if needed (emergency only)
5. Contact customer with order status

**All payment data stored in:**
- Database: `Payment` table
- Logs: PM2 logs
- ToyyibPay dashboard

---

**System automatically handles 99% of payments!** 🚀
Only manual intervention needed if webhook fails to reach server.
