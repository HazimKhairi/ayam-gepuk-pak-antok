# Testing Guide - Same-Day Booking Feature

## Overview
This guide covers testing for the same-day booking feature implemented on Feb 21, 2026.

## Test Files Created

### Backend Unit Tests
1. `backend/src/__tests__/same-day-booking.test.ts`
   - Date validation tests
   - Time slot filtering logic
   - Regression tests
   - Integration flow tests

2. `backend/src/__tests__/reservations-same-day.test.ts`
   - API endpoint integration tests
   - Capacity enforcement tests
   - Error handling tests
   - Regression tests for existing features

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- same-day-booking.test.ts
```

### Test Coverage Goals
- **Unit Tests**: 90%+ coverage for date validation logic
- **Integration Tests**: 80%+ coverage for API endpoints
- **Regression Tests**: 100% coverage for critical paths

---

## Manual Test Checklist

### 1. Dine-in Same-Day Booking ✓

#### Test Case 1.1: Book for Today (Morning)
- **Time**: 10:00 AM
- **Steps**:
  1. Navigate to `/book/dine-in`
  2. Select today's date
  3. Observe time slots shown
- **Expected**: Only slots from 11:00 AM onwards are visible
- **Pass/Fail**: ___

#### Test Case 1.2: Book for Today (Afternoon)
- **Time**: 3:00 PM
- **Steps**:
  1. Navigate to `/book/dine-in`
  2. Select today's date
  3. Observe time slots shown
- **Expected**: Only slots from 4:00 PM onwards are visible
- **Pass/Fail**: ___

#### Test Case 1.3: Book for Today (Late Evening)
- **Time**: 9:00 PM
- **Steps**:
  1. Navigate to `/book/dine-in`
  2. Select today's date
  3. Observe time slots shown
- **Expected**: If last slot is 5:00 PM, no slots should be shown with message "No available slots"
- **Pass/Fail**: ___

#### Test Case 1.4: Book for Tomorrow
- **Steps**:
  1. Navigate to `/book/dine-in`
  2. Select tomorrow's date
  3. Observe time slots shown
- **Expected**: All active time slots are visible (10:00 AM - 5:00 PM)
- **Pass/Fail**: ___

#### Test Case 1.5: Capacity Enforcement
- **Steps**:
  1. Create booking for 30 pax at a slot
  2. Try to create another booking for 25 pax at same slot (total would exceed 50)
- **Expected**: Error "Not enough capacity for this time slot"
- **Pass/Fail**: ___

---

### 2. Takeaway Same-Day Booking ✓

#### Test Case 2.1: UI Simplification
- **Steps**:
  1. Navigate to `/book/takeaway`
  2. Observe the UI
- **Expected**:
  - No complex slot selection UI
  - Operating hours displayed prominently
  - Simple time button grid (e.g., 14:00, 15:00, 16:00...)
  - Cart summary visible
- **Pass/Fail**: ___

#### Test Case 2.2: Same-Day Takeaway Order
- **Steps**:
  1. Navigate to `/book/takeaway`
  2. Select today's date
  3. Select pickup time (e.g., 6:00 PM)
  4. Fill in customer details
  5. Submit order
- **Expected**:
  - Order created successfully
  - Backend assigns to appropriate time slot
  - Payment URL returned
- **Pass/Fail**: ___

#### Test Case 2.3: Slot Capacity Tracking
- **Steps**:
  1. Create multiple takeaway orders for same time slot
  2. Continue until maxOrders limit is reached
  3. Try to create one more order
- **Expected**:
  - First N orders succeed (where N = maxOrders)
  - Last order fails with "Time slot is fully booked"
- **Pass/Fail**: ___

#### Test Case 2.4: Cart Items Required
- **Steps**:
  1. Navigate to `/book/takeaway`
  2. Try to submit without adding items to cart
- **Expected**: Error message "Please add items to your cart from the menu before ordering"
- **Pass/Fail**: ___

---

### 3. Delivery Booking (Unchanged) ✓

#### Test Case 3.1: Same-Day Rejection
- **Steps**:
  1. Navigate to `/book/delivery`
  2. Try to select today's date
- **Expected**: Today is disabled, minimum date is tomorrow
- **Pass/Fail**: ___

#### Test Case 3.2: Tomorrow Booking
- **Steps**:
  1. Navigate to `/book/delivery`
  2. Select tomorrow's date
  3. Fill in delivery details
  4. Submit order
- **Expected**: Order created successfully
- **Pass/Fail**: ___

---

### 4. Regression Tests ✓

#### Test Case 4.1: 14-Day Maximum Window
- **Steps**:
  1. Try to book for 15 days from now
- **Expected**: Error "Cannot book more than 14 days ahead"
- **Pass/Fail**: ___

#### Test Case 4.2: Past Date Rejection
- **Steps**:
  1. Manually try to create booking for yesterday (via API)
- **Expected**: Error "Cannot book for past dates"
- **Pass/Fail**: ___

#### Test Case 4.3: Server-Side Price Calculation
- **Steps**:
  1. Add items to cart (e.g., 2x Set A @ RM20 = RM40)
  2. Create booking
  3. Check order total in database
- **Expected**:
  - Subtotal: RM40.00
  - SST (6%): RM2.40
  - Booking Fee: RM1.00
  - Total: RM43.40
- **Pass/Fail**: ___

#### Test Case 4.4: ToyyibPay Integration
- **Steps**:
  1. Create booking
  2. Check payment record
- **Expected**:
  - Payment record created with correct amount
  - billCode stored
  - paymentUrl returned
- **Pass/Fail**: ___

---

### 5. Edge Cases ✓

#### Test Case 5.1: Midnight Booking
- **Time**: 11:59 PM
- **Steps**:
  1. Try to book for "today" at 11:59 PM
  2. Check available slots
- **Expected**: No slots available (all past)
- **Pass/Fail**: ___

#### Test Case 5.2: Exactly at Slot Time
- **Time**: 2:00 PM
- **Steps**:
  1. Try to book for 2:00 PM slot at exactly 2:00 PM
- **Expected**: 2:00 PM slot should NOT be available (equal to current time = past)
- **Pass/Fail**: ___

#### Test Case 5.3: Multiple Fulfillment Types Same Slot
- **Steps**:
  1. Create dine-in booking for 3:00 PM
  2. Create takeaway booking for 3:00 PM (same slot time)
- **Expected**: Both should succeed (separate capacity tracking)
- **Pass/Fail**: ___

#### Test Case 5.4: Outlet Hours Validation
- **Steps**:
  1. Select slot outside outlet operating hours
- **Expected**: Error "Selected time is outside outlet operating hours"
- **Pass/Fail**: ___

---

## Performance Tests

### Load Test 1: Concurrent Same-Day Bookings
- **Scenario**: 100 concurrent users booking dine-in for today
- **Expected**: All requests processed within 3 seconds, no overbooking
- **Tool**: Apache JMeter or k6

### Load Test 2: Time Slot API Performance
- **Scenario**: 200 req/min to GET /outlets/:id/slots
- **Expected**: Avg response time < 200ms, cache utilized

---

## Database Verification Queries

### Check Same-Day Bookings
```sql
SELECT
  orderNo,
  fulfillmentType,
  bookingDate,
  createdAt,
  status
FROM "Order"
WHERE bookingDate = CURRENT_DATE
ORDER BY createdAt DESC;
```

### Check Slot Capacity Usage
```sql
SELECT
  ts.time,
  COUNT(o.id) as total_orders,
  SUM(o.paxCount) as total_pax,
  o2.maxCapacity
FROM "TimeSlot" ts
LEFT JOIN "Order" o ON o.timeSlotId = ts.id
  AND o.bookingDate = CURRENT_DATE
  AND o.status IN ('COMPLETED')
LEFT JOIN "Outlet" o2 ON ts.outletId = o2.id
WHERE ts.outletId = '<outlet-id>'
GROUP BY ts.id, ts.time, o2.maxCapacity
ORDER BY ts.time;
```

### Verify No Overbooking
```sql
-- This should return 0 rows
SELECT
  timeSlotId,
  bookingDate,
  SUM(paxCount) as total_pax,
  o.maxCapacity
FROM "Order" ord
JOIN "TimeSlot" ts ON ord.timeSlotId = ts.id
JOIN "Outlet" o ON ts.outletId = o.id
WHERE ord.fulfillmentType = 'DINE_IN'
  AND ord.status IN ('COMPLETED')
GROUP BY timeSlotId, bookingDate, o.maxCapacity
HAVING SUM(paxCount) > o.maxCapacity;
```

---

## Automated Test Execution

### CI/CD Integration
Add to GitHub Actions / GitLab CI:

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd backend
          npm install

      - name: Run tests
        run: |
          cd backend
          npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## Test Results Template

### Test Run: [Date] [Time]
**Tester**: ___________
**Environment**: ☐ Local ☐ Staging ☐ Production

| Test Case | Pass | Fail | Notes |
|-----------|------|------|-------|
| 1.1 Book Today (Morning) | ☐ | ☐ | |
| 1.2 Book Today (Afternoon) | ☐ | ☐ | |
| 1.3 Book Today (Evening) | ☐ | ☐ | |
| 1.4 Book Tomorrow | ☐ | ☐ | |
| 1.5 Capacity Enforcement | ☐ | ☐ | |
| 2.1 UI Simplification | ☐ | ☐ | |
| 2.2 Same-Day Takeaway | ☐ | ☐ | |
| 2.3 Slot Capacity | ☐ | ☐ | |
| 2.4 Cart Required | ☐ | ☐ | |
| 3.1 Same-Day Rejection | ☐ | ☐ | |
| 3.2 Tomorrow Delivery | ☐ | ☐ | |
| 4.1 14-Day Max | ☐ | ☐ | |
| 4.2 Past Date | ☐ | ☐ | |
| 4.3 Price Calc | ☐ | ☐ | |
| 4.4 ToyyibPay | ☐ | ☐ | |

**Overall Result**: ☐ Pass ☐ Fail
**Critical Issues**: ___________
**Notes**: ___________

---

## Known Limitations

1. **Test Database**: Integration tests require proper test database setup
2. **ToyyibPay Mock**: Payment gateway requires mocking for automated tests
3. **Time-Dependent Tests**: Tests involving "current time" may fail at midnight transitions
4. **Frontend E2E**: Playwright/Cypress tests not yet implemented

---

## Next Steps

1. Set up test database with seed data
2. Implement ToyyibPay mock service
3. Add Supertest for API integration tests
4. Create Playwright tests for frontend flows
5. Set up continuous integration pipeline
