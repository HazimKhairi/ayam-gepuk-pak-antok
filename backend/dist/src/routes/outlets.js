"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const dateValidation_1 = require("../utils/dateValidation");
const redis_1 = require("../config/redis");
const router = (0, express_1.Router)();
// GET /api/v1/outlets - List all active outlets (CACHED)
router.get('/', async (req, res) => {
    try {
        // Try cache first
        const cacheKey = 'outlets:all';
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        // Cache miss - fetch from database
        const outlets = await prisma_1.default.outlet.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        // Store in cache for 5 minutes
        await redis_1.cache.set(cacheKey, outlets, 300);
        res.json(outlets);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch outlets' });
    }
});
// GET /api/v1/outlets/:id - Get single outlet with details (CACHED)
router.get('/:id', async (req, res) => {
    try {
        // Try cache first
        const cacheKey = `outlets:${req.params.id}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        // Cache miss - fetch from database
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
        // Store in cache for 5 minutes
        await redis_1.cache.set(cacheKey, outlet, 300);
        res.json(outlet);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch outlet' });
    }
});
// GET /api/v1/outlets/:id/tables - Get available tables for a specific date
router.get('/:id/tables', async (req, res) => {
    try {
        const { zone, date } = req.query;
        // Parse date (defaults to today)
        const bookingDate = date ? new Date(date) : new Date();
        bookingDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (bookingDate < today) {
            return res.status(400).json({ error: 'Cannot view tables for past dates' });
        }
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 14);
        if (bookingDate > maxDate) {
            return res.status(400).json({ error: 'Cannot book more than 14 days ahead' });
        }
        // Get all tables for the outlet
        const tables = await prisma_1.default.table.findMany({
            where: {
                outletId: req.params.id,
                ...(zone && { zone: zone }),
            },
            orderBy: [{ zone: 'asc' }, { tableNo: 'asc' }],
        });
        // Get booked tables for the selected date with customer info
        const bookedOrders = await prisma_1.default.order.findMany({
            where: {
                outletId: req.params.id,
                fulfillmentType: 'DINE_IN',
                bookingDate: bookingDate,
                status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
            },
            select: {
                tableId: true,
                customerName: true,
                customerPhone: true,
                customerEmail: true,
                createdAt: true,
                status: true,
            },
        });
        // Create a map of table bookings
        const tableBookings = new Map(bookedOrders.map(o => [o.tableId, {
                customerName: o.customerName,
                customerPhone: o.customerPhone,
                customerEmail: o.customerEmail,
                bookingTime: o.createdAt,
                orderStatus: o.status,
            }]));
        // Add availability status and booking info to each table
        const tablesWithStatus = tables.map(table => ({
            ...table,
            isAvailable: !tableBookings.has(table.id) && table.status === 'AVAILABLE',
            booking: tableBookings.get(table.id) || null,
        }));
        res.json(tablesWithStatus);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});
// GET /api/v1/outlets/:id/slots - Get available time slots for a specific date
// Query params: date (YYYY-MM-DD), type ('dine_in' for pax-based capacity)
router.get('/:id/slots', async (req, res) => {
    try {
        const { date, type } = req.query;
        // Parse date (defaults to today)
        const bookingDate = date ? new Date(date) : new Date();
        bookingDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (bookingDate < today) {
            return res.status(400).json({ error: 'Cannot view slots for past dates' });
        }
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 14);
        if (bookingDate > maxDate) {
            return res.status(400).json({ error: 'Cannot book more than 14 days ahead' });
        }
        const timeSlots = await prisma_1.default.timeSlot.findMany({
            where: {
                outletId: req.params.id,
                isActive: true,
            },
            orderBy: { time: 'asc' },
        });
        // Dine-in: return pax-based capacity per slot
        if (type === 'dine_in') {
            const outlet = await prisma_1.default.outlet.findUnique({
                where: { id: req.params.id },
                select: { maxCapacity: true, openTime: true, closeTime: true },
            });
            if (!outlet) {
                return res.status(404).json({ error: 'Outlet not found' });
            }
            const paxSums = await prisma_1.default.order.groupBy({
                by: ['timeSlotId'],
                where: {
                    outletId: req.params.id,
                    bookingDate: bookingDate,
                    fulfillmentType: 'DINE_IN',
                    status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
                    timeSlotId: { not: null },
                },
                _sum: { paxCount: true },
            });
            const paxMap = new Map(paxSums.map(p => [p.timeSlotId, p._sum.paxCount || 0]));
            const slotsWithCapacity = timeSlots.map(slot => {
                const currentPax = paxMap.get(slot.id) || 0;
                const remainingPax = outlet.maxCapacity - currentPax;
                const isDisabled = !(0, dateValidation_1.isTimeWithinOutletHours)(slot.time, outlet.openTime, outlet.closeTime);
                return {
                    ...slot,
                    currentPax,
                    maxCapacity: outlet.maxCapacity,
                    remainingPax,
                    isAvailable: remainingPax > 0,
                    isDisabled,
                };
            });
            return res.json(slotsWithCapacity);
        }
        // Takeaway (default): return order-count-based availability
        const outlet = await prisma_1.default.outlet.findUnique({
            where: { id: req.params.id },
            select: { openTime: true, closeTime: true },
        });
        if (!outlet) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        const orderCounts = await prisma_1.default.order.groupBy({
            by: ['timeSlotId'],
            where: {
                outletId: req.params.id,
                bookingDate: bookingDate,
                status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
                timeSlotId: { not: null },
            },
            _count: true,
        });
        const countMap = new Map(orderCounts.map(o => [o.timeSlotId, o._count]));
        const slotsWithStatus = timeSlots.map(slot => {
            const currentOrders = countMap.get(slot.id) || 0;
            const isDisabled = !(0, dateValidation_1.isTimeWithinOutletHours)(slot.time, outlet.openTime, outlet.closeTime);
            return {
                ...slot,
                currentOrders,
                isAvailable: currentOrders < slot.maxOrders,
                remainingSlots: slot.maxOrders - currentOrders,
                isDisabled,
            };
        });
        res.json(slotsWithStatus);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch time slots' });
    }
});
// PUT /api/v1/outlets/:id - Update outlet (admin only)
router.put('/:id', async (req, res) => {
    try {
        const { name, address, phone, openTime, closeTime, deliveryFee, isActive, maxCapacity, deliveryEnabled } = req.body;
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
                ...(maxCapacity !== undefined && { maxCapacity }),
                ...(deliveryEnabled !== undefined && { deliveryEnabled }),
            },
        });
        // Invalidate cache for this outlet and all outlets list
        await redis_1.cache.del(`outlets:${req.params.id}`);
        await redis_1.cache.del('outlets:all');
        res.json(outlet);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update outlet' });
    }
});
exports.default = router;
//# sourceMappingURL=outlets.js.map