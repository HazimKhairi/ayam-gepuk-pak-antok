import { Router } from 'express';
import prisma from '../config/prisma';
import { v4 as uuidv4 } from 'uuid';
import { createBill } from '../utils/toyyibpay';
import { sendConfirmationEmail } from '../utils/email';
import { parseAndValidateBookingDate, isTimeWithinOutletHours } from '../utils/dateValidation';
import { optionalCustomerAuth } from '../middlewares/auth';
import type { Request, Response } from 'express';

const router = Router();

// SST rate (6%)
const SST_RATE = 0.06;

// Generate order number
const generateOrderNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AGP${dateStr}${random}`;
};

/**
 * Server-side price calculation from cart items.
 * Looks up actual prices from DB to prevent client-side manipulation.
 */
async function calculateServerTotals(items: { id: string; quantity: number }[], deliveryFee: number = 0) {
  if (!items || items.length === 0) {
    return { subtotal: 0, sst: 0, deliveryFee: parseFloat(deliveryFee.toFixed(2)), total: parseFloat(deliveryFee.toFixed(2)) };
  }

  const menuItemIds = items.map(i => i.id);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, isActive: true },
    select: { id: true, price: true },
  });

  const priceMap = new Map(menuItems.map(m => [m.id, Number(m.price)]));

  let subtotal = 0;
  for (const item of items) {
    const price = priceMap.get(item.id);
    if (price === undefined) {
      throw new Error(`Some items in your cart are no longer available. Please clear your cart and re-add items from the menu.`);
    }
    if (item.quantity < 1 || item.quantity > 100) {
      throw new Error(`Invalid quantity for item ${item.id}`);
    }
    subtotal += price * item.quantity;
  }

  const sst = subtotal * SST_RATE;
  const total = subtotal + sst + deliveryFee;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    sst: parseFloat(sst.toFixed(2)),
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

// POST /api/v1/reservations/dine-in (pax-based + time slot)
router.post('/dine-in', async (req, res) => {
  try {
    const { outletId, timeSlotId, paxCount, customerName, customerEmail, customerPhone, items, notes, bookingDate: bookingDateStr } = req.body;

    if (!outletId || !timeSlotId || !paxCount || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (paxCount < 1 || paxCount > 50) {
      return res.status(400).json({ error: 'Number of guests must be between 1 and 50' });
    }

    const parsedDate = parseAndValidateBookingDate(bookingDateStr);
    const totals = await calculateServerTotals(items);

    // Use serializable transaction to prevent overbooking capacity
    const result = await prisma.$transaction(async (tx) => {
      // Verify time slot exists and belongs to outlet
      const timeSlot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!timeSlot || timeSlot.outletId !== outletId) {
        throw new Error('SLOT_NOT_FOUND');
      }

      // Get outlet max capacity and operating hours
      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { maxCapacity: true, openTime: true, closeTime: true },
      });

      if (!outlet) {
        throw new Error('OUTLET_NOT_FOUND');
      }

      // Validate time is within outlet hours
      if (!isTimeWithinOutletHours(timeSlot.time, outlet.openTime, outlet.closeTime)) {
        throw new Error('OUTSIDE_HOURS');
      }

      // Sum pax for dine-in orders in this slot on this date
      const paxAggregate = await tx.order.aggregate({
        where: {
          timeSlotId,
          bookingDate: parsedDate,
          fulfillmentType: 'DINE_IN',
          status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
        },
        _sum: { paxCount: true },
      });

      const currentPax = paxAggregate._sum.paxCount || 0;
      if (currentPax + paxCount > outlet.maxCapacity) {
        throw new Error('CAPACITY_FULL');
      }

      // Create order with paxCount (no tableId)
      const order = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          outletId,
          timeSlotId,
          paxCount,
          fulfillmentType: 'DINE_IN',
          customerName,
          customerEmail,
          customerPhone,
          bookingDate: parsedDate,
          ...totals,
          notes,
        },
        include: { outlet: true, timeSlot: true },
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: { orderId: order.id, amount: totals.total },
      });

      return { order, payment };
    }, {
      isolationLevel: 'Serializable',
    });

    // Create ToyyibPay bill (outside transaction)
    const billResult = await createBill(result.order, result.payment.id);

    if (billResult.success) {
      await prisma.payment.update({
        where: { id: result.payment.id },
        data: { billCode: billResult.billCode },
      });

      res.json({ success: true, order: result.order, paymentUrl: billResult.paymentUrl });
    } else {
      res.status(500).json({ error: 'Failed to create payment bill' });
    }
  } catch (error: any) {
    if (error.message === 'CAPACITY_FULL') {
      return res.status(400).json({ error: 'Not enough capacity for this time slot. Please choose a different time or reduce party size.' });
    }
    if (error.message === 'SLOT_NOT_FOUND') {
      return res.status(400).json({ error: 'Time slot not found' });
    }
    if (error.message === 'OUTLET_NOT_FOUND') {
      return res.status(400).json({ error: 'Outlet not found' });
    }
    if (error.message === 'OUTSIDE_HOURS') {
      return res.status(400).json({ error: 'Selected time is outside outlet operating hours' });
    }
    if (error.message === 'PAST_DATE') {
      return res.status(400).json({ error: 'Cannot book for past dates' });
    }
    if (error.message === 'DATE_TOO_FAR') {
      return res.status(400).json({ error: 'Cannot book more than 14 days ahead' });
    }
    if (error.message === 'INVALID_DATE') {
      return res.status(400).json({ error: 'Invalid booking date' });
    }
    if (error.message?.includes('no longer available') || error.message?.includes('Invalid quantity')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating dine-in reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// POST /api/v1/reservations/takeaway
router.post('/takeaway', async (req, res) => {
  try {
    const { outletId, timeSlotId, customerName, customerEmail, customerPhone, items, notes, bookingDate: bookingDateStr } = req.body;

    if (!outletId || !timeSlotId || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const parsedDate = parseAndValidateBookingDate(bookingDateStr);
    const totals = await calculateServerTotals(items);

    // Use transaction with row-level locking to prevent overselling
    const result = await prisma.$transaction(async (tx) => {
      // Check the time slot exists
      const timeSlot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!timeSlot) {
        throw new Error('SLOT_FULL');
      }

      // Get outlet operating hours
      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { openTime: true, closeTime: true },
      });

      if (!outlet) {
        throw new Error('OUTLET_NOT_FOUND');
      }

      // Validate time is within outlet hours
      if (!isTimeWithinOutletHours(timeSlot.time, outlet.openTime, outlet.closeTime)) {
        throw new Error('OUTSIDE_HOURS');
      }

      // Count orders for this slot on the specific date
      const dateOrderCount = await tx.order.count({
        where: {
          timeSlotId,
          bookingDate: parsedDate,
          status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
        },
      });

      if (dateOrderCount >= timeSlot.maxOrders) {
        throw new Error('SLOT_FULL');
      }

      // Create order
      const order = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          outletId,
          timeSlotId,
          fulfillmentType: 'TAKEAWAY',
          customerName,
          customerEmail,
          customerPhone,
          bookingDate: parsedDate,
          ...totals,
          notes,
        },
        include: { outlet: true, timeSlot: true },
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: { orderId: order.id, amount: totals.total },
      });

      return { order, payment };
    }, {
      isolationLevel: 'Serializable',
    });

    // Create ToyyibPay bill (outside transaction)
    const billResult = await createBill(result.order, result.payment.id);

    if (billResult.success) {
      await prisma.payment.update({
        where: { id: result.payment.id },
        data: { billCode: billResult.billCode },
      });

      res.json({ success: true, order: result.order, paymentUrl: billResult.paymentUrl });
    } else {
      res.status(500).json({ error: 'Failed to create payment bill' });
    }
  } catch (error: any) {
    if (error.message === 'SLOT_FULL') {
      return res.status(400).json({ error: 'Time slot is fully booked for this date' });
    }
    if (error.message === 'OUTLET_NOT_FOUND') {
      return res.status(400).json({ error: 'Outlet not found' });
    }
    if (error.message === 'OUTSIDE_HOURS') {
      return res.status(400).json({ error: 'Selected time is outside outlet operating hours' });
    }
    if (error.message === 'PAST_DATE') {
      return res.status(400).json({ error: 'Cannot book for past dates' });
    }
    if (error.message === 'DATE_TOO_FAR') {
      return res.status(400).json({ error: 'Cannot book more than 14 days ahead' });
    }
    if (error.message === 'INVALID_DATE') {
      return res.status(400).json({ error: 'Invalid booking date' });
    }
    if (error.message?.includes('no longer available') || error.message?.includes('Invalid quantity')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating takeaway order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/v1/reservations/delivery
router.post('/delivery', async (req, res) => {
  try {
    const { outletId, deliveryAddress, customerName, customerEmail, customerPhone, items, notes, bookingDate: bookingDateStr } = req.body;

    if (!outletId || !deliveryAddress || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const parsedDate = parseAndValidateBookingDate(bookingDateStr);

    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) {
      return res.status(404).json({ error: 'Outlet not found' });
    }

    const totals = await calculateServerTotals(items, Number(outlet.deliveryFee));

    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(),
        outletId,
        fulfillmentType: 'DELIVERY',
        customerName,
        customerEmail,
        customerPhone,
        bookingDate: parsedDate,
        deliveryAddress,
        ...totals,
        notes,
      },
      include: { outlet: true },
    });

    const payment = await prisma.payment.create({
      data: { orderId: order.id, amount: totals.total },
    });

    const billResult = await createBill(order, payment.id);

    if (billResult.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { billCode: billResult.billCode },
      });

      res.json({ success: true, order, paymentUrl: billResult.paymentUrl });
    } else {
      res.status(500).json({ error: 'Failed to create payment bill' });
    }
  } catch (error: any) {
    if (error.message === 'PAST_DATE') {
      return res.status(400).json({ error: 'Cannot book for past dates' });
    }
    if (error.message === 'DATE_TOO_FAR') {
      return res.status(400).json({ error: 'Cannot book more than 14 days ahead' });
    }
    if (error.message === 'INVALID_DATE') {
      return res.status(400).json({ error: 'Invalid booking date' });
    }
    if (error.message?.includes('no longer available') || error.message?.includes('Invalid quantity')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating delivery order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/v1/reservations/:orderNo - Get order by order number
router.get('/:orderNo', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNo: req.params.orderNo },
      include: { outlet: true, table: true, timeSlot: true, payment: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// GET /api/v1/reservations/customer/orders - Get customer's orders
router.get('/customer/orders', optionalCustomerAuth, async (req: Request, res: Response) => {
  try {
    // Require authentication
    if (!req.customer) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Fetch orders by customer email
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerEmail: req.customer.email },
        include: {
          outlet: { select: { name: true, address: true } },
          table: { select: { tableNo: true } },
          timeSlot: { select: { time: true } },
          payment: { select: { status: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where: { customerEmail: req.customer.email } }),
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/v1/reservations/:id/cancel - Cancel order
router.put('/:id/cancel', optionalCustomerAuth, async (req: Request, res: Response) => {
  try {
    // Require authentication
    if (!req.customer) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify ownership
    if (order.customerEmail !== req.customer.email) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }

    // Check if cancellable (PENDING, PAID, CONFIRMED only)
    if (!['PENDING', 'PAID', 'CONFIRMED'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot cancel order with status ${order.status}`,
      });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    // TODO: Send cancellation email notification
    // TODO: Handle refund if payment was successful

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
