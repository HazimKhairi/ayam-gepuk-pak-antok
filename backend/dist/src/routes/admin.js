"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// All admin routes require authentication
router.use(auth_1.requireAdmin);
// GET /api/v1/admin/dashboard - Get dashboard stats
router.get('/dashboard', async (req, res) => {
    try {
        const { outletId } = req.query;
        // Show all orders, not just future ones
        const where = {
            ...(outletId && { outletId: outletId }),
        };
        // Get order counts
        const [totalOrders, pendingOrders, confirmedOrders, completedOrders] = await Promise.all([
            prisma_1.default.order.count({ where }),
            prisma_1.default.order.count({ where: { ...where, status: 'PENDING' } }),
            prisma_1.default.order.count({ where: { ...where, status: 'CONFIRMED' } }),
            prisma_1.default.order.count({ where: { ...where, status: 'COMPLETED' } }),
        ]);
        // Get total sales - only count COMPLETED orders (paid orders)
        const salesData = await prisma_1.default.order.aggregate({
            where: { ...where, status: 'COMPLETED' },
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
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
});
// GET /api/v1/admin/sales - Get sales report
router.get('/sales', async (req, res) => {
    try {
        const { outletId, startDate, endDate, groupBy = 'month' } = req.query;
        const where = {};
        if (outletId)
            where.outletId = outletId;
        if (startDate && endDate) {
            // Set start date to beginning of day
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            // Set end date to end of day (23:59:59.999)
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.bookingDate = {
                gte: start,
                lte: end,
            };
        }
        // Get sales orders - only count COMPLETED orders (successfully paid)
        const orders = await prisma_1.default.order.findMany({
            where: { ...where, status: 'COMPLETED' },
            include: { outlet: true },
            orderBy: { bookingDate: 'asc' },
        });
        // Group by date or month based on groupBy parameter
        const salesByPeriod = orders.reduce((acc, order) => {
            let period;
            if (groupBy === 'month') {
                // Format as "YYYY-MM" for grouping, but store full date for display
                const date = new Date(order.bookingDate);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                period = `${year}-${month}`;
            }
            else {
                // Daily grouping
                period = order.bookingDate.toISOString().split('T')[0];
            }
            if (!acc[period]) {
                acc[period] = { period, total: 0, count: 0 };
            }
            acc[period].total += Number(order.total);
            acc[period].count += 1;
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
            salesByPeriod: Object.values(salesByPeriod),
            salesByOutlet: Object.values(salesByOutlet),
            totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
            totalOrders: orders.length,
            groupBy: groupBy,
        });
    }
    catch (error) {
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
        // Enrich orderItems with menu item images
        const enrichedOrders = await Promise.all(orders.map(async (order) => {
            if (order.orderItems && Array.isArray(order.orderItems)) {
                const menuItemNames = order.orderItems.map((item) => item.menuItemName);
                // Fetch menu items for this order
                const menuItems = await prisma_1.default.menuItem.findMany({
                    where: {
                        name: { in: menuItemNames },
                    },
                    select: {
                        name: true,
                        image: true,
                    },
                });
                // Create a map for quick lookup
                const menuItemMap = new Map(menuItems.map((item) => [item.name, item.image]));
                // Add image to each order item
                const enrichedItems = order.orderItems.map((item) => ({
                    ...item,
                    menuItemImage: menuItemMap.get(item.menuItemName) || '',
                }));
                return {
                    ...order,
                    orderItems: enrichedItems,
                };
            }
            return order;
        }));
        res.json({
            orders: enrichedOrders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
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
        res.status(500).json({ error: 'Failed to update order' });
    }
});
// GET /api/v1/admin/outlets - Get all outlets for admin
router.get('/outlets', async (req, res) => {
    try {
        const { page = '1', limit = '10' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [outlets, total] = await Promise.all([
            prisma_1.default.outlet.findMany({
                orderBy: { name: 'asc' },
                skip,
                take: parseInt(limit),
                include: {
                    _count: {
                        select: {
                            tables: true,
                            timeSlots: true,
                            orders: true,
                        },
                    },
                },
            }),
            prisma_1.default.outlet.count(),
        ]);
        res.json({
            outlets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch outlets' });
    }
});
// POST /api/v1/admin/outlets - Create a new outlet
router.post('/outlets', async (req, res) => {
    try {
        const { name, address, phone, googleMapsUrl, openTime, closeTime, deliveryFee, maxCapacity, deliveryEnabled, isActive } = req.body;
        // Validate required fields
        if (!name || !address || !phone) {
            return res.status(400).json({ error: 'Name, address, and phone are required' });
        }
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (openTime && !timeRegex.test(openTime)) {
            return res.status(400).json({ error: 'Invalid openTime format. Use HH:MM' });
        }
        if (closeTime && !timeRegex.test(closeTime)) {
            return res.status(400).json({ error: 'Invalid closeTime format. Use HH:MM' });
        }
        // Create outlet with defaults
        const outlet = await prisma_1.default.outlet.create({
            data: {
                name,
                address,
                phone,
                googleMapsUrl: googleMapsUrl || '',
                openTime: openTime || '10:00',
                closeTime: closeTime || '22:00',
                deliveryFee: deliveryFee ?? 0,
                maxCapacity: maxCapacity ?? 50,
                deliveryEnabled: deliveryEnabled ?? false,
                isActive: isActive ?? true,
            },
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
        res.status(201).json(outlet);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create outlet' });
    }
});
// PUT /api/v1/admin/outlets/:id - Update an outlet
router.put('/outlets/:id', async (req, res) => {
    try {
        const { name, address, phone, googleMapsUrl, openTime, closeTime, deliveryFee, maxCapacity, deliveryEnabled, isActive } = req.body;
        // Validate time format if provided
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (openTime && !timeRegex.test(openTime)) {
            return res.status(400).json({ error: 'Invalid openTime format. Use HH:MM' });
        }
        if (closeTime && !timeRegex.test(closeTime)) {
            return res.status(400).json({ error: 'Invalid closeTime format. Use HH:MM' });
        }
        // Check if outlet exists
        const existingOutlet = await prisma_1.default.outlet.findUnique({
            where: { id: req.params.id },
        });
        if (!existingOutlet) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        const outlet = await prisma_1.default.outlet.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(address && { address }),
                ...(phone && { phone }),
                ...(googleMapsUrl !== undefined && { googleMapsUrl }),
                ...(openTime && { openTime }),
                ...(closeTime && { closeTime }),
                ...(deliveryFee !== undefined && { deliveryFee }),
                ...(maxCapacity !== undefined && { maxCapacity }),
                ...(deliveryEnabled !== undefined && { deliveryEnabled }),
                ...(isActive !== undefined && { isActive }),
            },
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
        res.json(outlet);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update outlet' });
    }
});
// GET /api/v1/admin/tables/:outletId - Get all tables for an outlet (admin view)
router.get('/tables/:outletId', async (req, res) => {
    try {
        const tables = await prisma_1.default.table.findMany({
            where: { outletId: req.params.outletId },
            orderBy: [{ zone: 'asc' }, { tableNo: 'asc' }],
        });
        res.json(tables);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});
// POST /api/v1/admin/tables - Create a new table
router.post('/tables', async (req, res) => {
    try {
        const { outletId, tableNo, capacity, zone } = req.body;
        // Check if table number already exists for this outlet
        const existingTable = await prisma_1.default.table.findUnique({
            where: { outletId_tableNo: { outletId, tableNo } },
        });
        if (existingTable) {
            return res.status(400).json({ error: 'Table number already exists for this outlet' });
        }
        const table = await prisma_1.default.table.create({
            data: {
                outletId,
                tableNo,
                capacity: capacity || 4,
                zone: zone || 'Regular',
            },
        });
        res.status(201).json(table);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create table' });
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
                ...(capacity !== undefined && { capacity }),
                ...(zone && { zone }),
                ...(status && { status }),
            },
        });
        res.json(table);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update table' });
    }
});
// DELETE /api/v1/admin/tables/:id - Delete a table
router.delete('/tables/:id', async (req, res) => {
    try {
        // Check if table has any active bookings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeBookings = await prisma_1.default.order.count({
            where: {
                tableId: req.params.id,
                bookingDate: { gte: today },
                status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
            },
        });
        if (activeBookings > 0) {
            return res.status(400).json({ error: 'Cannot delete table with active bookings' });
        }
        await prisma_1.default.table.delete({
            where: { id: req.params.id },
        });
        res.json({ success: true, message: 'Table deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete table' });
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
        res.status(500).json({ error: 'Failed to update time slot' });
    }
});
// Create time slot
router.post('/slots', async (req, res) => {
    try {
        const { outletId, time, maxOrders, isActive } = req.body;
        // Validate required fields
        if (!outletId || !time) {
            return res.status(400).json({ error: 'Outlet ID and time are required' });
        }
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(time)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:MM format' });
        }
        // Verify outlet exists
        const outlet = await prisma_1.default.outlet.findUnique({
            where: { id: outletId },
        });
        if (!outlet) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        // Check for duplicate time slot
        const existingSlot = await prisma_1.default.timeSlot.findUnique({
            where: {
                outletId_time: {
                    outletId,
                    time,
                },
            },
        });
        if (existingSlot) {
            return res.status(400).json({ error: 'Time slot already exists for this outlet' });
        }
        // Create time slot with defaults
        const slot = await prisma_1.default.timeSlot.create({
            data: {
                outletId,
                time,
                maxOrders: maxOrders ?? 10,
                isActive: isActive ?? true,
            },
        });
        res.status(201).json(slot);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create time slot' });
    }
});
// Delete time slot
router.delete('/slots/:id', async (req, res) => {
    try {
        // Check if slot exists
        const slot = await prisma_1.default.timeSlot.findUnique({
            where: { id: req.params.id },
        });
        if (!slot) {
            return res.status(404).json({ error: 'Time slot not found' });
        }
        // Check for active bookings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeBookings = await prisma_1.default.order.count({
            where: {
                timeSlotId: req.params.id,
                status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
                bookingDate: { gte: today }, // Today or future
            },
        });
        if (activeBookings > 0) {
            return res.status(400).json({
                error: `Cannot delete time slot with ${activeBookings} active booking(s)`,
            });
        }
        // Delete the time slot
        await prisma_1.default.timeSlot.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Time slot deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete time slot' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map