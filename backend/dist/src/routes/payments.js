"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const email_1 = require("../utils/email");
const router = (0, express_1.Router)();
// POST /api/v1/payments/callback - ToyyibPay callback
router.post('/callback', async (req, res) => {
    try {
        const { billcode, order_id, status_id, transaction_id } = req.body;
        if (!billcode || !status_id) {
            return res.status(400).json({ error: 'Missing required callback parameters' });
        }
        // Find payment by billCode
        const payment = await prisma_1.default.payment.findFirst({
            where: { billCode: billcode },
            include: {
                order: {
                    include: {
                        outlet: true,
                        table: true,
                        timeSlot: true,
                    },
                },
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        // Prevent duplicate processing
        if (payment.status === 'SUCCESS') {
            return res.json({ success: true, message: 'Already processed' });
        }
        // Update payment status
        const paymentStatus = status_id === '1' ? 'SUCCESS' : status_id === '3' ? 'FAILED' : 'PENDING';
        await prisma_1.default.payment.update({
            where: { id: payment.id },
            data: {
                transactionId: transaction_id,
                status: paymentStatus,
                paidAt: paymentStatus === 'SUCCESS' ? new Date() : null,
                callbackData: req.body,
            },
        });
        // Update order status if payment successful
        if (paymentStatus === 'SUCCESS') {
            await prisma_1.default.order.update({
                where: { id: payment.orderId },
                data: { status: 'COMPLETED' },
            });
            // Send confirmation email (non-blocking)
            (0, email_1.sendConfirmationEmail)(payment.order).catch(() => { });
            // Schedule reminder (non-blocking)
            (0, email_1.scheduleReminder)(payment.order).catch(() => { });
        }
        else if (paymentStatus === 'FAILED') {
            await prisma_1.default.order.update({
                where: { id: payment.orderId },
                data: { status: 'CANCELLED' },
            });
            // If takeaway, decrement time slot
            if (payment.order.timeSlotId) {
                await prisma_1.default.timeSlot.update({
                    where: { id: payment.order.timeSlotId },
                    data: { currentOrders: { decrement: 1 } },
                });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to process callback' });
    }
});
// GET /api/v1/payments/status/:billCode - Check payment status
router.get('/status/:billCode', async (req, res) => {
    try {
        const payment = await prisma_1.default.payment.findFirst({
            where: { billCode: req.params.billCode },
            include: {
                order: {
                    include: { outlet: true, table: true, timeSlot: true },
                },
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        res.json({ status: payment.status, order: payment.order });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check status' });
    }
});
// POST /api/v1/payments/complete/:orderNo - Manual payment completion for testing
router.post('/complete/:orderNo', async (req, res) => {
    try {
        const order = await prisma_1.default.order.findUnique({
            where: { orderNo: req.params.orderNo },
            include: {
                payment: true,
                outlet: true,
                table: true,
                timeSlot: true,
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (!order.payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        // Prevent duplicate processing
        if (order.payment.status === 'SUCCESS') {
            return res.json({ success: true, message: 'Payment already completed', order });
        }
        // Update payment status
        await prisma_1.default.payment.update({
            where: { id: order.payment.id },
            data: {
                status: 'SUCCESS',
                paidAt: new Date(),
                transactionId: `MANUAL_${Date.now()}`,
            },
        });
        // Update order status to COMPLETED
        const updatedOrder = await prisma_1.default.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
            include: {
                outlet: true,
                table: true,
                timeSlot: true,
                payment: true,
            },
        });
        // Send confirmation email (non-blocking)
        (0, email_1.sendConfirmationEmail)(updatedOrder).catch(() => { });
        // Schedule reminder (non-blocking)
        (0, email_1.scheduleReminder)(updatedOrder).catch(() => { });
        res.json({
            success: true,
            message: 'Payment completed successfully',
            order: updatedOrder
        });
    }
    catch (error) {
        console.error('Manual payment completion error:', error);
        res.status(500).json({ error: 'Failed to complete payment' });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map