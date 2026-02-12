"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const router = (0, express_1.Router)();
// GET /api/v1/admin/dashboard - Get dashboard stats
router.get('/dashboard', async (req, res) => {
    try {
        const { outletId } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const where = {
            ...(outletId && { outletId: outletId }),
            bookingDate: { gte: today },
        };
        // Get order counts
        const [totalOrders, pendingOrders, confirmedOrders, completedOrders] = await Promise.all([
            prisma_1.default.order.count({ where }),
            prisma_1.default.order.count({ where: { ...where, status: 'PENDING' } }),
            prisma_1.default.order.count({ where: { ...where, status: 'CONFIRMED' } }),
            prisma_1.default.order.count({ where: { ...where, status: 'COMPLETED' } }),
        ]);
        // Get total sales
        const salesData = await prisma_1.default.order.aggregate({
            where: { ...where, status: { in: ['PAID', 'CONFIRMED', 'COMPLETED'] } },
            _sum: { total: true },
        });
        // Get orders by fulfillment type
        const ordersByType = await prisma_1.default.order.groupBy({
            by: ['fulfillmentType'],
            where,
            _count: true,
        });
        // Get recent orders
        const recentOrders = await prisma_1.default.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                outlet: true,
                table: true,
                timeSlot: true,
                payment: true,
            },
        });
        res.json({
            stats: {
                totalOrders,
                pendingOrders,
                confirmedOrders,
                completedOrders,
                totalSales: salesData._sum.total || 0,
            },
            ordersByType: ordersByType.reduce((acc, curr) => {
                acc[curr.fulfillmentType] = curr._count;
                return acc;
            }, {}),
            recentOrders,
        });
    }
    catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
});
// GET /api/v1/admin/sales - Get sales report
router.get('/sales', async (req, res) => {
    try {
        const { outletId, startDate, endDate } = req.query;
        const where = {};
        if (outletId)
            where.outletId = outletId;
        if (startDate && endDate) {
            where.bookingDate = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        // Get daily sales
        const orders = await prisma_1.default.order.findMany({
            where: { ...where, status: { in: ['PAID', 'CONFIRMED', 'COMPLETED'] } },
            include: { outlet: true },
            orderBy: { bookingDate: 'asc' },
        });
        // Group by date
        const salesByDate = orders.reduce((acc, order) => {
            const date = order.bookingDate.toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = { date, total: 0, count: 0 };
            }
            acc[date].total += Number(order.total);
            acc[date].count += 1;
            return acc;
        }, {});
        // Sales by outlet
        const salesByOutlet = orders.reduce((acc, order) => {
            const outletName = order.outlet.name;
            if (!acc[outletName]) {
                acc[outletName] = { outlet: outletName, total: 0, count: 0 };
            }
            acc[outletName].total += Number(order.total);
            acc[outletName].count += 1;
            return acc;
        }, {});
        res.json({
            salesByDate: Object.values(salesByDate),
            salesByOutlet: Object.values(salesByOutlet),
            totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
            totalOrders: orders.length,
        });
    }
    catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});
// GET /api/v1/admin/orders - Get all orders
router.get('/orders', async (req, res) => {
    try {
        const { outletId, status, fulfillmentType, page = '1', limit = '20' } = req.query;
        const where = {};
        if (outletId)
            where.outletId = outletId;
        if (status)
            where.status = status;
        if (fulfillmentType)
            where.fulfillmentType = fulfillmentType;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [orders, total] = await Promise.all([
            prisma_1.default.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
                include: {
                    outlet: true,
                    table: true,
                    timeSlot: true,
                    payment: true,
                },
            }),
            prisma_1.default.order.count({ where }),
        ]);
        res.json({
            orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
// PUT /api/v1/admin/orders/:id/status - Update order status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await prisma_1.default.order.update({
            where: { id: req.params.id },
            data: { status },
            include: {
                outlet: true,
                table: true,
                timeSlot: true,
                payment: true,
            },
        });
        res.json(order);
    }
    catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});
// GET /api/v1/admin/outlets - Get all outlets for admin
router.get('/outlets', async (req, res) => {
    try {
        const outlets = await prisma_1.default.outlet.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        tables: true,
                        timeSlots: true,
                        orders: true,
                    },
                },
            },
        });
        res.json(outlets);
    }
    catch (error) {
        console.error('Error fetching outlets:', error);
        res.status(500).json({ error: 'Failed to fetch outlets' });
    }
});
// PUT /api/v1/admin/tables/:id - Update table configuration
router.put('/tables/:id', async (req, res) => {
    try {
        const { tableNo, capacity, zone, status } = req.body;
        const table = await prisma_1.default.table.update({
            where: { id: req.params.id },
            data: {
                ...(tableNo && { tableNo }),
                ...(capacity && { capacity }),
                ...(zone && { zone }),
                ...(status && { status }),
            },
        });
        res.json(table);
    }
    catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ error: 'Failed to update table' });
    }
});
// PUT /api/v1/admin/slots/:id - Update time slot configuration
router.put('/slots/:id', async (req, res) => {
    try {
        const { time, maxOrders, isActive } = req.body;
        const slot = await prisma_1.default.timeSlot.update({
            where: { id: req.params.id },
            data: {
                ...(time && { time }),
                ...(maxOrders !== undefined && { maxOrders }),
                ...(isActive !== undefined && { isActive }),
            },
        });
        res.json(slot);
    }
    catch (error) {
        console.error('Error updating time slot:', error);
        res.status(500).json({ error: 'Failed to update time slot' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map