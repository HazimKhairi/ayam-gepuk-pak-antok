"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const toyyibpay_1 = require("../utils/toyyibpay");
const router = (0, express_1.Router)();
// SST rate (6%)
const SST_RATE = 0.06;
// Generate order number
const generateOrderNo = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AGP${dateStr}${random}`;
};
// Calculate totals
const calculateTotals = (subtotal, deliveryFee = 0) => {
    const sst = subtotal * SST_RATE;
    const total = subtotal + sst + deliveryFee;
    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        sst: parseFloat(sst.toFixed(2)),
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
    };
};
// POST /api/v1/reservations/dine-in
router.post('/dine-in', async (req, res) => {
    try {
        const { outletId, tableId, customerName, customerEmail, customerPhone, subtotal, notes } = req.body;
        // Validate required fields
        if (!outletId || !tableId || !customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if table is available
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingBooking = await prisma_1.default.order.findFirst({
            where: {
                tableId,
                bookingDate: today,
                status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
            },
        });
        if (existingBooking) {
            return res.status(400).json({ error: 'Table is already booked for today' });
        }
        const totals = calculateTotals(subtotal || 0);
        // Create order
        const order = await prisma_1.default.order.create({
            data: {
                orderNo: generateOrderNo(),
                outletId,
                tableId,
                fulfillmentType: 'DINE_IN',
                customerName,
                customerEmail,
                customerPhone,
                bookingDate: today,
                ...totals,
                notes,
            },
            include: {
                outlet: true,
                table: true,
            },
        });
        // Create payment record
        const payment = await prisma_1.default.payment.create({
            data: {
                orderId: order.id,
                amount: totals.total,
            },
        });
        // Create ToyyibPay bill
        const billResult = await (0, toyyibpay_1.createBill)(order, payment.id);
        if (billResult.success) {
            await prisma_1.default.payment.update({
                where: { id: payment.id },
                data: { billCode: billResult.billCode },
            });
            res.json({
                success: true,
                order,
                paymentUrl: billResult.paymentUrl,
            });
        }
        else {
            res.status(500).json({ error: 'Failed to create payment bill' });
        }
    }
    catch (error) {
        console.error('Error creating dine-in reservation:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});
// POST /api/v1/reservations/takeaway
router.post('/takeaway', async (req, res) => {
    try {
        const { outletId, timeSlotId, customerName, customerEmail, customerPhone, subtotal, notes } = req.body;
        // Validate required fields
        if (!outletId || !timeSlotId || !customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if time slot is available
        const timeSlot = await prisma_1.default.timeSlot.findUnique({
            where: { id: timeSlotId },
        });
        if (!timeSlot || timeSlot.currentOrders >= timeSlot.maxOrders) {
            return res.status(400).json({ error: 'Time slot is not available' });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totals = calculateTotals(subtotal || 0);
        // Create order
        const order = await prisma_1.default.order.create({
            data: {
                orderNo: generateOrderNo(),
                outletId,
                timeSlotId,
                fulfillmentType: 'TAKEAWAY',
                customerName,
                customerEmail,
                customerPhone,
                bookingDate: today,
                ...totals,
                notes,
            },
            include: {
                outlet: true,
                timeSlot: true,
            },
        });
        // Increment time slot current orders
        await prisma_1.default.timeSlot.update({
            where: { id: timeSlotId },
            data: { currentOrders: { increment: 1 } },
        });
        // Create payment record
        const payment = await prisma_1.default.payment.create({
            data: {
                orderId: order.id,
                amount: totals.total,
            },
        });
        // Create ToyyibPay bill
        const billResult = await (0, toyyibpay_1.createBill)(order, payment.id);
        if (billResult.success) {
            await prisma_1.default.payment.update({
                where: { id: payment.id },
                data: { billCode: billResult.billCode },
            });
            res.json({
                success: true,
                order,
                paymentUrl: billResult.paymentUrl,
            });
        }
        else {
            res.status(500).json({ error: 'Failed to create payment bill' });
        }
    }
    catch (error) {
        console.error('Error creating takeaway order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});
// POST /api/v1/reservations/delivery
router.post('/delivery', async (req, res) => {
    try {
        const { outletId, deliveryAddress, customerName, customerEmail, customerPhone, subtotal, notes } = req.body;
        // Validate required fields
        if (!outletId || !deliveryAddress || !customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Get outlet for delivery fee
        const outlet = await prisma_1.default.outlet.findUnique({
            where: { id: outletId },
        });
        if (!outlet) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totals = calculateTotals(subtotal || 0, Number(outlet.deliveryFee));
        // Create order
        const order = await prisma_1.default.order.create({
            data: {
                orderNo: generateOrderNo(),
                outletId,
                fulfillmentType: 'DELIVERY',
                customerName,
                customerEmail,
                customerPhone,
                bookingDate: today,
                deliveryAddress,
                ...totals,
                notes,
            },
            include: {
                outlet: true,
            },
        });
        // Create payment record
        const payment = await prisma_1.default.payment.create({
            data: {
                orderId: order.id,
                amount: totals.total,
            },
        });
        // Create ToyyibPay bill
        const billResult = await (0, toyyibpay_1.createBill)(order, payment.id);
        if (billResult.success) {
            await prisma_1.default.payment.update({
                where: { id: payment.id },
                data: { billCode: billResult.billCode },
            });
            res.json({
                success: true,
                order,
                paymentUrl: billResult.paymentUrl,
            });
        }
        else {
            res.status(500).json({ error: 'Failed to create payment bill' });
        }
    }
    catch (error) {
        console.error('Error creating delivery order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});
// GET /api/v1/reservations/:orderNo - Get order by order number
router.get('/:orderNo', async (req, res) => {
    try {
        const order = await prisma_1.default.order.findUnique({
            where: { orderNo: req.params.orderNo },
            include: {
                outlet: true,
                table: true,
                timeSlot: true,
                payment: true,
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    }
    catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
exports.default = router;
//# sourceMappingURL=reservations.js.map