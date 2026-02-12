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
        console.log('ToyyibPay Callback:', req.body);
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
                data: { status: 'CONFIRMED' },
            });
            // Send confirmation email
            await (0, email_1.sendConfirmationEmail)(payment.order);
            // Schedule 1-hour reminder
            await (0, email_1.scheduleReminder)(payment.order);
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
        console.error('Error processing payment callback:', error);
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
        res.json({
            status: payment.status,
            order: payment.order,
        });
    }
    catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map