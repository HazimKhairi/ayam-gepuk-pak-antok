"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const toyyibpay_1 = require("../utils/toyyibpay");
const dateValidation_1 = require("../utils/dateValidation");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// SST rate (6%)
const SST_RATE = 0.06;
// Booking fee (RM1)
const BOOKING_FEE = 1.00;
// Generate order number
const generateOrderNo = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AGP${dateStr}${random}`;
};
/**
 * Server-side price calculation from cart items with customizations.
 * Looks up actual prices from DB to prevent client-side manipulation.
 */
async function calculateServerTotals(items, deliveryFee = 0) {
    if (!items || items.length === 0) {
        return {
            subtotal: 0,
            sst: 0,
            bookingFee: BOOKING_FEE,
            deliveryFee: parseFloat(deliveryFee.toFixed(2)),
            total: parseFloat((BOOKING_FEE + deliveryFee).toFixed(2)),
            orderItems: [],
        };
    }
    const menuItemIds = items.map(i => i.id);
    const menuItems = await prisma_1.default.menuItem.findMany({
        where: { id: { in: menuItemIds }, isActive: true },
        select: { id: true, name: true, price: true, hasCustomization: true, customizationOptions: true },
    });
    const menuItemMap = new Map(menuItems.map(m => [m.id, m]));
    const orderItems = [];
    let subtotal = 0;
    for (const item of items) {
        const menuItem = menuItemMap.get(item.id);
        if (!menuItem) {
            throw new Error(`Some items in your cart are no longer available. Please clear your cart and re-add items from the menu.`);
        }
        if (item.quantity < 1 || item.quantity > 100) {
            throw new Error(`Invalid quantity for item ${item.id}`);
        }
        const basePrice = Number(menuItem.price);
        let customizationTotal = 0;
        // Calculate customization price modifiers
        if (item.customizations && menuItem.hasCustomization) {
            const customizationOptions = menuItem.customizationOptions;
            // Validate and sum price modifiers from customizations
            if (item.customizations.ayamType) {
                customizationTotal += item.customizations.ayamType.priceModifier || 0;
            }
            if (item.customizations.sambalLevel) {
                customizationTotal += item.customizations.sambalLevel.priceModifier || 0;
            }
            if (item.customizations.drink) {
                customizationTotal += item.customizations.drink.priceModifier || 0;
            }
        }
        const itemTotalPrice = (basePrice + customizationTotal) * item.quantity;
        subtotal += itemTotalPrice;
        orderItems.push({
            menuItemId: menuItem.id,
            menuItemName: menuItem.name,
            basePrice,
            quantity: item.quantity,
            customizations: item.customizations,
            totalPrice: parseFloat(itemTotalPrice.toFixed(2)),
        });
    }
    const sst = subtotal * SST_RATE;
    const total = subtotal + sst + BOOKING_FEE + deliveryFee;
    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        sst: parseFloat(sst.toFixed(2)),
        bookingFee: BOOKING_FEE,
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        orderItems,
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
        const parsedDate = (0, dateValidation_1.parseAndValidateBookingDate)(bookingDateStr);
        const { orderItems, ...totals } = await calculateServerTotals(items);
        // Use serializable transaction to prevent overbooking capacity
        const result = await prisma_1.default.$transaction(async (tx) => {
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
            if (!(0, dateValidation_1.isTimeWithinOutletHours)(timeSlot.time, outlet.openTime, outlet.closeTime)) {
                throw new Error('OUTSIDE_HOURS');
            }
            // Sum pax for dine-in orders in this slot on this date (exclude PENDING - not yet paid)
            const paxAggregate = await tx.order.aggregate({
                where: {
                    timeSlotId,
                    bookingDate: parsedDate,
                    fulfillmentType: 'DINE_IN',
                    status: { in: ['PAID', 'CONFIRMED', 'COMPLETED'] }, // PENDING orders don't count until paid
                },
                _sum: { paxCount: true },
            });
            const currentPax = paxAggregate._sum.paxCount || 0;
            if (currentPax + paxCount > outlet.maxCapacity) {
                throw new Error('CAPACITY_FULL');
            }
            // Create order with paxCount and orderItems (no tableId)
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
                    orderItems: orderItems, // Store customized items
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
        const billResult = await (0, toyyibpay_1.createBill)(result.order, result.payment.id);
        if (billResult.success) {
            await prisma_1.default.payment.update({
                where: { id: result.payment.id },
                data: { billCode: billResult.billCode },
            });
            res.json({ success: true, order: result.order, paymentUrl: billResult.paymentUrl });
        }
        else {
            res.status(500).json({ error: 'Failed to create payment bill' });
        }
    }
    catch (error) {
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
        const parsedDate = (0, dateValidation_1.parseAndValidateBookingDate)(bookingDateStr);
        const { orderItems, ...totals } = await calculateServerTotals(items);
        // Use transaction with row-level locking to prevent overselling
        const result = await prisma_1.default.$transaction(async (tx) => {
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
            if (!(0, dateValidation_1.isTimeWithinOutletHours)(timeSlot.time, outlet.openTime, outlet.closeTime)) {
                throw new Error('OUTSIDE_HOURS');
            }
            // Count orders for this slot on the specific date (exclude PENDING - not yet paid)
            const dateOrderCount = await tx.order.count({
                where: {
                    timeSlotId,
                    bookingDate: parsedDate,
                    status: { in: ['PAID', 'CONFIRMED', 'COMPLETED'] }, // PENDING orders don't count until paid
                },
            });
            if (dateOrderCount >= timeSlot.maxOrders) {
                throw new Error('SLOT_FULL');
            }
            // Create order with orderItems
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
                    orderItems: orderItems, // Store customized items
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
        const billResult = await (0, toyyibpay_1.createBill)(result.order, result.payment.id);
        if (billResult.success) {
            await prisma_1.default.payment.update({
                where: { id: result.payment.id },
                data: { billCode: billResult.billCode },
            });
            res.json({ success: true, order: result.order, paymentUrl: billResult.paymentUrl });
        }
        else {
            res.status(500).json({ error: 'Failed to create payment bill' });
        }
    }
    catch (error) {
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
        const parsedDate = (0, dateValidation_1.parseAndValidateBookingDate)(bookingDateStr);
        const outlet = await prisma_1.default.outlet.findUnique({ where: { id: outletId } });
        if (!outlet) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        const { orderItems, ...totals } = await calculateServerTotals(items, Number(outlet.deliveryFee));
        const order = await prisma_1.default.order.create({
            data: {
                orderNo: generateOrderNo(),
                outletId,
                fulfillmentType: 'DELIVERY',
                customerName,
                customerEmail,
                customerPhone,
                bookingDate: parsedDate,
                deliveryAddress,
                orderItems: orderItems, // Store customized items
                ...totals,
                notes,
            },
            include: { outlet: true },
        });
        const payment = await prisma_1.default.payment.create({
            data: { orderId: order.id, amount: totals.total },
        });
        const billResult = await (0, toyyibpay_1.createBill)(order, payment.id);
        if (billResult.success) {
            await prisma_1.default.payment.update({
                where: { id: payment.id },
                data: { billCode: billResult.billCode },
            });
            res.json({ success: true, order, paymentUrl: billResult.paymentUrl });
        }
        else {
            res.status(500).json({ error: 'Failed to create payment bill' });
        }
    }
    catch (error) {
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
        res.status(500).json({ error: 'Failed to create order' });
    }
});
// GET /api/v1/reservations/:orderNo - Get order by order number
router.get('/:orderNo', async (req, res) => {
    try {
        const order = await prisma_1.default.order.findUnique({
            where: { orderNo: req.params.orderNo },
            include: { outlet: true, table: true, timeSlot: true, payment: true },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
// GET /api/v1/reservations/customer/orders - Get customer's orders
router.get('/customer/orders', auth_1.optionalCustomerAuth, async (req, res) => {
    try {
        // Require authentication
        if (!req.customer) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { page = '1', limit = '10' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Fetch orders by customer email
        const [orders, total] = await Promise.all([
            prisma_1.default.order.findMany({
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
            prisma_1.default.order.count({ where: { customerEmail: req.customer.email } }),
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
// PUT /api/v1/reservations/:id/cancel - Cancel order
router.put('/:id/cancel', auth_1.optionalCustomerAuth, async (req, res) => {
    try {
        // Require authentication
        if (!req.customer) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const order = await prisma_1.default.order.findUnique({
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
        const updatedOrder = await prisma_1.default.order.update({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});
exports.default = router;
//# sourceMappingURL=reservations.js.map