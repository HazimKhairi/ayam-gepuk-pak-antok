"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const router = (0, express_1.Router)();
// GET /api/v1/outlets - List all active outlets
router.get('/', async (req, res) => {
    try {
        const outlets = await prisma_1.default.outlet.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        res.json(outlets);
    }
    catch (error) {
        console.error('Error fetching outlets:', error);
        res.status(500).json({ error: 'Failed to fetch outlets' });
    }
});
// GET /api/v1/outlets/:id - Get single outlet with details
router.get('/:id', async (req, res) => {
    try {
        const outlet = await prisma_1.default.outlet.findUnique({
            where: { id: req.params.id },
            include: {
                tables: true,
                timeSlots: true,
            },
        });
        if (!outlet) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        res.json(outlet);
    }
    catch (error) {
        console.error('Error fetching outlet:', error);
        res.status(500).json({ error: 'Failed to fetch outlet' });
    }
});
// GET /api/v1/outlets/:id/tables - Get available tables for today
router.get('/:id/tables', async (req, res) => {
    try {
        const { zone } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Get all tables for the outlet
        const tables = await prisma_1.default.table.findMany({
            where: {
                outletId: req.params.id,
                ...(zone && { zone: zone }),
            },
            orderBy: [{ zone: 'asc' }, { tableNo: 'asc' }],
        });
        // Get booked tables for today
        const bookedOrders = await prisma_1.default.order.findMany({
            where: {
                outletId: req.params.id,
                fulfillmentType: 'DINE_IN',
                bookingDate: today,
                status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
            },
            select: { tableId: true },
        });
        const bookedTableIds = new Set(bookedOrders.map(o => o.tableId));
        // Add availability status to each table
        const tablesWithStatus = tables.map(table => ({
            ...table,
            isAvailable: !bookedTableIds.has(table.id),
        }));
        res.json(tablesWithStatus);
    }
    catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});
// GET /api/v1/outlets/:id/slots - Get available time slots for today
router.get('/:id/slots', async (req, res) => {
    try {
        const timeSlots = await prisma_1.default.timeSlot.findMany({
            where: {
                outletId: req.params.id,
                isActive: true,
            },
            orderBy: { time: 'asc' },
        });
        // Add availability based on current orders
        const slotsWithStatus = timeSlots.map(slot => ({
            ...slot,
            isAvailable: slot.currentOrders < slot.maxOrders,
            remainingSlots: slot.maxOrders - slot.currentOrders,
        }));
        res.json(slotsWithStatus);
    }
    catch (error) {
        console.error('Error fetching time slots:', error);
        res.status(500).json({ error: 'Failed to fetch time slots' });
    }
});
// PUT /api/v1/outlets/:id - Update outlet (admin only)
router.put('/:id', async (req, res) => {
    try {
        const { name, address, phone, openTime, closeTime, deliveryFee, isActive } = req.body;
        const outlet = await prisma_1.default.outlet.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(address && { address }),
                ...(phone && { phone }),
                ...(openTime && { openTime }),
                ...(closeTime && { closeTime }),
                ...(deliveryFee !== undefined && { deliveryFee }),
                ...(isActive !== undefined && { isActive }),
            },
        });
        res.json(outlet);
    }
    catch (error) {
        console.error('Error updating outlet:', error);
        res.status(500).json({ error: 'Failed to update outlet' });
    }
});
exports.default = router;
//# sourceMappingURL=outlets.js.map