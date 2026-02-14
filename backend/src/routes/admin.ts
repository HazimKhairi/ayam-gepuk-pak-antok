import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { requireAdmin } from '../middlewares/auth';

const router = Router();

// All admin routes require authentication
router.use(requireAdmin);

// GET /api/v1/admin/dashboard - Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const { outletId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      ...(outletId && { outletId: outletId as string }),
      bookingDate: { gte: today },
    };

    // Get order counts
    const [totalOrders, pendingOrders, confirmedOrders, completedOrders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: 'PENDING' } }),
      prisma.order.count({ where: { ...where, status: 'CONFIRMED' } }),
      prisma.order.count({ where: { ...where, status: 'COMPLETED' } }),
    ]);

    // Get total sales
    const salesData = await prisma.order.aggregate({
      where: { ...where, status: { in: ['PAID', 'CONFIRMED', 'COMPLETED'] } },
      _sum: { total: true },
    });

    // Get orders by fulfillment type
    const ordersByType = await prisma.order.groupBy({
      by: ['fulfillmentType'],
      where,
      _count: true,
    });

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
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
      }, {} as Record<string, number>),
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET /api/v1/admin/sales - Get sales report
router.get('/sales', async (req, res) => {
  try {
    const { outletId, startDate, endDate } = req.query;

    const where: any = {};

    if (outletId) where.outletId = outletId;
    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Get daily sales
    const orders = await prisma.order.findMany({
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
    }, {} as Record<string, { date: string; total: number; count: number }>);

    // Sales by outlet
    const salesByOutlet = orders.reduce((acc, order) => {
      const outletName = order.outlet.name;
      if (!acc[outletName]) {
        acc[outletName] = { outlet: outletName, total: 0, count: 0 };
      }
      acc[outletName].total += Number(order.total);
      acc[outletName].count += 1;
      return acc;
    }, {} as Record<string, { outlet: string; total: number; count: number }>);

    res.json({
      salesByDate: Object.values(salesByDate),
      salesByOutlet: Object.values(salesByOutlet),
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
      totalOrders: orders.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/v1/admin/orders - Get all orders
router.get('/orders', async (req, res) => {
  try {
    const { outletId, status, fulfillmentType, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (outletId) where.outletId = outletId;
    if (status) where.status = status;
    if (fulfillmentType) where.fulfillmentType = fulfillmentType;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: {
          outlet: true,
          table: true,
          timeSlot: true,
          payment: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Enrich orderItems with menu item images
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        if (order.orderItems && Array.isArray(order.orderItems)) {
          const menuItemNames = order.orderItems.map((item: any) => item.menuItemName);

          // Fetch menu items for this order
          const menuItems = await prisma.menuItem.findMany({
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
          const enrichedItems = order.orderItems.map((item: any) => ({
            ...item,
            menuItemImage: menuItemMap.get(item.menuItemName) || '',
          }));

          return {
            ...order,
            orderItems: enrichedItems,
          };
        }
        return order;
      })
    );

    res.json({
      orders: enrichedOrders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/v1/admin/orders/:id/status - Update order status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    const order = await prisma.order.update({
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// GET /api/v1/admin/outlets - Get all outlets for admin
router.get('/outlets', async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [outlets, total] = await Promise.all([
      prisma.outlet.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit as string),
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
      prisma.outlet.count(),
    ]);

    res.json({
      outlets,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch outlets' });
  }
});

// POST /api/v1/admin/outlets - Create a new outlet
router.post('/outlets', async (req: Request, res: Response) => {
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
    const outlet = await prisma.outlet.create({
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to create outlet' });
  }
});

// PUT /api/v1/admin/outlets/:id - Update an outlet
router.put('/outlets/:id', async (req: Request, res: Response) => {
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
    const existingOutlet = await prisma.outlet.findUnique({
      where: { id: req.params.id },
    });

    if (!existingOutlet) {
      return res.status(404).json({ error: 'Outlet not found' });
    }

    const outlet = await prisma.outlet.update({
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update outlet' });
  }
});

// GET /api/v1/admin/tables/:outletId - Get all tables for an outlet (admin view)
router.get('/tables/:outletId', async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { outletId: req.params.outletId },
      orderBy: [{ zone: 'asc' }, { tableNo: 'asc' }],
    });

    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// POST /api/v1/admin/tables - Create a new table
router.post('/tables', async (req, res) => {
  try {
    const { outletId, tableNo, capacity, zone } = req.body;

    // Check if table number already exists for this outlet
    const existingTable = await prisma.table.findUnique({
      where: { outletId_tableNo: { outletId, tableNo } },
    });

    if (existingTable) {
      return res.status(400).json({ error: 'Table number already exists for this outlet' });
    }

    const table = await prisma.table.create({
      data: {
        outletId,
        tableNo,
        capacity: capacity || 4,
        zone: zone || 'Regular',
      },
    });

    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/v1/admin/tables/:id - Update table configuration
router.put('/tables/:id', async (req, res) => {
  try {
    const { tableNo, capacity, zone, status } = req.body;

    const table = await prisma.table.update({
      where: { id: req.params.id },
      data: {
        ...(tableNo && { tableNo }),
        ...(capacity !== undefined && { capacity }),
        ...(zone && { zone }),
        ...(status && { status }),
      },
    });

    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// DELETE /api/v1/admin/tables/:id - Delete a table
router.delete('/tables/:id', async (req, res) => {
  try {
    // Check if table has any active bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = await prisma.order.count({
      where: {
        tableId: req.params.id,
        bookingDate: { gte: today },
        status: { in: ['PENDING', 'PAID', 'CONFIRMED'] },
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: 'Cannot delete table with active bookings' });
    }

    await prisma.table.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// PUT /api/v1/admin/slots/:id - Update time slot configuration
router.put('/slots/:id', async (req, res) => {
  try {
    const { time, maxOrders, isActive } = req.body;

    const slot = await prisma.timeSlot.update({
      where: { id: req.params.id },
      data: {
        ...(time && { time }),
        ...(maxOrders !== undefined && { maxOrders }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(slot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update time slot' });
  }
});

// Create time slot
router.post('/slots', async (req: Request, res: Response) => {
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
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });

    if (!outlet) {
      return res.status(404).json({ error: 'Outlet not found' });
    }

    // Check for duplicate time slot
    const existingSlot = await prisma.timeSlot.findUnique({
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
    const slot = await prisma.timeSlot.create({
      data: {
        outletId,
        time,
        maxOrders: maxOrders ?? 10,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create time slot' });
  }
});

// Delete time slot
router.delete('/slots/:id', async (req: Request, res: Response) => {
  try {
    // Check if slot exists
    const slot = await prisma.timeSlot.findUnique({
      where: { id: req.params.id },
    });

    if (!slot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    // Check for active bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = await prisma.order.count({
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
    await prisma.timeSlot.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
});

export default router;
